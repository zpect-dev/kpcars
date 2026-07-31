<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\CierreSueldo;
use App\Models\CierreSueldoAbono;
use App\Models\CierreSueldoPago;
use App\Models\CierreSueldoParticipacion;
use App\Models\Inversion;
use App\Models\Scopes\TenantScope;
use Illuminate\Support\Facades\DB;

/**
 * Recalcula los pagos (sueldos) y los abonos (baja de deuda) de un cierre de
 * sueldo EDITABLE, a partir de:
 *  - la foto de la composición de cada inversión (cierre_sueldo_participaciones),
 *  - las decisiones por socio (cierre_sueldo_socios: abona / abono_monto),
 *  - y el recaudado congelado por este cierre.
 *
 * Fórmula por inversión: parte = recaudado / cantidad de inversores.
 *  - Sin deuda → parte completa.
 *  - Con deuda:
 *      · Abona y está 1º/2º en su ranking de deudas (por empresa, orden natural)
 *        → media parte; la otra mitad se cede.
 *      · Si no abona, o está 3º+ → 0 (cede la parte completa).
 *  - Lo cedido se redistribuye en partes iguales entre los financiadores.
 *
 * Deuda: está denominada en DÓLARES. El abono (porción del sueldo en pesos) se
 * convierte a USD a la tasa del cierre y baja la deuda en dólares. Se REVIERTEN
 * los abonos previos y se re-aplican según las decisiones actuales, así el saldo
 * vivo (USD) queda consistente en cada edición.
 */
class RecalcularSueldosAction
{
    public function execute(CierreSueldo $cierre): void
    {
        DB::transaction(function () use ($cierre) {
            $ahora = now();

            $participaciones = $cierre->participaciones()->get();
            $porInversion = $participaciones->groupBy('inversion_id');

            // Inversiones de la foto en orden natural (ranking + cascada).
            $inversiones = Inversion::withoutGlobalScope(TenantScope::class)
                ->whereIn('id', $porInversion->keys()->all())
                ->orderByRaw('LENGTH(nombre), nombre')
                ->get(['id', 'nombre', 'empresa_id']);

            // Recaudado por inversión (congelado por este cierre).
            $cierreRecIds = $cierre->cierresRecaudacion()->pluck('id')->all();
            $recaudado = empty($cierreRecIds) ? [] : DB::table('recaudaciones')
                ->whereIn('recaudaciones.cierre_id', $cierreRecIds)
                ->join('vehiculos', 'recaudaciones.vehiculo_id', '=', 'vehiculos.id')
                ->whereNotNull('vehiculos.inversion_id')
                ->groupBy('vehiculos.inversion_id')
                ->selectRaw('vehiculos.inversion_id as inversion_id, SUM(recaudaciones.total) as total')
                ->pluck('total', 'inversion_id')
                ->map(fn ($t) => (float) $t)
                ->all();

            $decisiones = $cierre->socios()->get()->keyBy('user_id');

            // Índices desde la foto.
            // Deudor = flag `es_deudor` (no el monto): una inversión incompleta
            // puede tener deudores sin deuda fijada todavía.
            $deudaSnapshot = [];      // [user_id][inversion_id] = saldo
            $rankingPorEmpresa = [];  // [empresa_id][user_id] = [inversion_id, ...]
            foreach ($inversiones as $inv) {
                foreach ($porInversion->get($inv->id, collect()) as $p) {
                    if ($p->es_deudor) {
                        $deudaSnapshot[$p->user_id][$inv->id] = (float) $p->saldo;
                        $rankingPorEmpresa[$inv->empresa_id][$p->user_id][] = $inv->id;
                    }
                }
            }

            // ---- 1) Pagos (sueldos) ----
            $pagos = [];
            foreach ($inversiones as $inv) {
                $monto = $recaudado[$inv->id] ?? 0.0;
                if ($monto <= 0) {
                    continue;
                }

                $comp = $porInversion->get($inv->id, collect());
                $cantidad = $comp->count();
                if ($cantidad === 0) {
                    continue;
                }

                $parte = $monto / $cantidad;
                $financiadores = $comp->filter(fn (CierreSueldoParticipacion $p) => (bool) $p->es_financiador)->values();

                $totalCedido = 0.0;
                $pagosInv = [];

                foreach ($comp as $p) {
                    $esDeudor = isset($deudaSnapshot[$p->user_id][$inv->id]);

                    if (! $esDeudor) {
                        $pagosInv[] = $this->pago($cierre->id, $p->user_id, $inv, CierreSueldoPago::CONCEPTO_PARTE_COMPLETA, $parte, $ahora);

                        continue;
                    }

                    $ranking = $rankingPorEmpresa[$inv->empresa_id][$p->user_id] ?? [];
                    $pos = array_search($inv->id, $ranking, true);
                    $abona = (bool) ($decisiones->get($p->user_id)?->abona ?? true);

                    if (($pos === 0 || $pos === 1) && $abona) {
                        $mitad = $parte / 2;
                        $pagosInv[] = $this->pago($cierre->id, $p->user_id, $inv, CierreSueldoPago::CONCEPTO_MEDIA_PARTE_DEUDOR, $mitad, $ahora);
                        $totalCedido += $mitad;
                    } else {
                        $pagosInv[] = $this->pago($cierre->id, $p->user_id, $inv, CierreSueldoPago::CONCEPTO_CERO_DEUDOR, 0, $ahora);
                        $totalCedido += $parte;
                    }
                }

                if ($totalCedido > 0 && $financiadores->isNotEmpty()) {
                    $porFinanciador = $totalCedido / $financiadores->count();
                    foreach ($financiadores as $f) {
                        $pagosInv[] = $this->pago($cierre->id, $f->user_id, $inv, CierreSueldoPago::CONCEPTO_REDISTRIBUCION, $porFinanciador, $ahora);
                    }
                }

                // Ajuste de redondeo por inversión.
                $objetivo = round($monto, 2);
                $suma = (float) array_sum(array_map(fn ($p) => round($p['monto'], 2), $pagosInv));
                $diferencia = round($objetivo - $suma, 2);
                if ($diferencia != 0.0) {
                    for ($i = count($pagosInv) - 1; $i >= 0; $i--) {
                        if ($pagosInv[$i]['monto'] > 0) {
                            $pagosInv[$i]['monto'] += $diferencia;
                            break;
                        }
                    }
                }
                foreach ($pagosInv as &$pp) {
                    $pp['monto'] = round($pp['monto'], 2);
                }
                unset($pp);

                $pagos = array_merge($pagos, $pagosInv);
            }

            $cierre->pagos()->delete();
            if (! empty($pagos)) {
                CierreSueldoPago::insert($pagos);
            }

            // ---- 2) Abonos / deuda (revertir prior + re-aplicar) ----
            // La deuda está en DÓLARES. El abono es una porción del sueldo (en
            // pesos) que se convierte a USD a la tasa de ESTE cierre y baja la
            // deuda en dólares. El registro del abono queda en USD (lo restado),
            // así el revert le devuelve dólares a la deuda.
            $this->revertirAbonos($cierre);

            $tasa = (float) $cierre->tasa;

            foreach ($decisiones as $userId => $dec) {
                if (! $dec->abona || $tasa <= 0) {
                    continue;
                }
                // Sueldo destinado a la deuda (pesos) → dólares a la tasa del cierre.
                $pendienteUsd = round((float) $dec->abono_monto / $tasa, 2);
                if ($pendienteUsd <= 0) {
                    continue;
                }

                foreach ($inversiones as $inv) {
                    if ($pendienteUsd <= 0) {
                        break;
                    }
                    if (! isset($deudaSnapshot[$userId][$inv->id])) {
                        continue; // solo en las inversiones donde debe
                    }

                    $vivoUsd = (float) DB::table('inversion_user')
                        ->where('inversion_id', $inv->id)
                        ->where('user_id', $userId)
                        ->value('deuda');
                    if ($vivoUsd <= 0) {
                        continue;
                    }

                    $aplicarUsd = round(min($pendienteUsd, $vivoUsd), 2);

                    DB::table('inversion_user')
                        ->where('inversion_id', $inv->id)
                        ->where('user_id', $userId)
                        ->update(['deuda' => round($vivoUsd - $aplicarUsd, 2), 'updated_at' => $ahora]);

                    CierreSueldoAbono::create([
                        'cierre_sueldo_id' => $cierre->id,
                        'user_id' => $userId,
                        'inversion_id' => $inv->id,
                        'monto' => $aplicarUsd,
                    ]);

                    $pendienteUsd -= $aplicarUsd;
                }
            }
        });
    }

    /**
     * Revierte los abonos vigentes del cierre: devuelve cada monto abonado a la
     * deuda viva (`inversion_user.deuda`) y borra los registros. Deja el saldo
     * vivo en su base, listo para reaplicar. Es idempotente: el recálculo lo
     * llama al inicio, y el endpoint de composición lo usa antes de editar la
     * deuda para que el monto tipeado sea la base real (sin doble conteo).
     */
    public function revertirAbonos(CierreSueldo $cierre): void
    {
        $ahora = now();

        foreach ($cierre->abonos()->get() as $a) {
            DB::table('inversion_user')
                ->where('inversion_id', $a->inversion_id)
                ->where('user_id', $a->user_id)
                ->increment('deuda', (float) $a->monto, ['updated_at' => $ahora]);
        }

        $cierre->abonos()->delete();
    }

    /**
     * @return array<string, mixed>
     */
    private function pago(int $cierreId, int $userId, Inversion $inv, string $concepto, float $monto, \DateTimeInterface $ahora): array
    {
        return [
            'cierre_sueldo_id' => $cierreId,
            'user_id' => $userId,
            'inversion_id' => $inv->id,
            'empresa_id' => $inv->empresa_id,
            'concepto' => $concepto,
            'monto' => $monto,
            'created_at' => $ahora,
            'updated_at' => $ahora,
        ];
    }
}
