<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\CierreInversion;
use App\Models\CierreInversionPago;
use App\Models\CierreInversionRecaudacion;
use App\Models\Inversion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProcessCierreInversionAction
{
    /**
     * Ejecuta el cierre semanal de inversiones.
     *
     * Reglas:
     *  - Toda inversión debe tener exactamente MAX_INVERSORES (6) inversores asignados.
     *  - Toda inversión con deudores debe tener ≥1 financiador.
     *  - Debe cargarse recaudación para TODAS las inversiones (cero permitido).
     *  - El ranking de deuda de cada inversor se computa sobre TODAS las inversiones donde
     *    el inversor tiene tiene_deuda=true, ordenadas por nombre (orden natural).
     *  - 1ra y 2da del ranking: deudor cobra parte/2; la otra mitad se redistribuye entre
     *    los financiadores de esa misma inversión.
     *  - 3ra+ del ranking: deudor cobra 0; la parte completa se redistribuye.
     *  - Inversor sin deuda en I: cobra parte completa.
     *
     * @param  array<int, numeric>  $recaudaciones  Mapa [inversion_id => monto]
     * @param  User  $admin  Usuario que ejecuta el cierre
     *
     * @throws RuntimeException Si alguna pre-condición falla.
     */
    public function execute(array $recaudaciones, User $admin, ?float $tasa = null): CierreInversion
    {
        return DB::transaction(function () use ($recaudaciones, $admin, $tasa) {
            // 1. Cargar todas las inversiones (orden natural determina el ranking)
            $inversiones = Inversion::with([
                'inversores' => fn ($q) => $q->orderBy('users.name'),
            ])->orderByRaw('LENGTH(nombre), nombre')->get();

            // 2. Validar que recaudaciones cubre TODAS las inversiones
            $inversionIds = $inversiones->pluck('id')->all();
            $faltantes = array_diff($inversionIds, array_keys($recaudaciones));
            if (! empty($faltantes)) {
                throw new RuntimeException(
                    'Falta cargar recaudación para algunas inversiones. Use 0 si no hubo.'
                );
            }

            // 3. Validar pre-condiciones por inversión
            foreach ($inversiones as $inv) {
                $count = $inv->inversores->count();
                if ($count !== Inversion::MAX_INVERSORES) {
                    throw new RuntimeException(
                        "La inversión \"{$inv->nombre}\" tiene {$count} inversores; se requieren ".Inversion::MAX_INVERSORES.'.'
                    );
                }

                $deudores = $inv->inversores->filter(fn (User $u) => (bool) $u->pivot->tiene_deuda);
                $financiadores = $inv->inversores->filter(fn (User $u) => (bool) $u->pivot->es_financiador);

                if ($deudores->isNotEmpty() && $financiadores->isEmpty()) {
                    throw new RuntimeException(
                        "La inversión \"{$inv->nombre}\" tiene deudores pero no financiadores asignados."
                    );
                }
            }

            // 4. Ranking de deuda por inversor: todas las inversiones donde tiene_deuda=true,
            //    ordenadas alfabéticamente por nombre de inversión.
            //    Map: user_id => [inversion_id, ...] en orden.
            $rankingPorUser = [];
            foreach ($inversiones as $inv) {
                foreach ($inv->inversores as $u) {
                    if ((bool) $u->pivot->tiene_deuda) {
                        $rankingPorUser[$u->id][] = $inv->id;
                    }
                }
            }

            $ultimoCierre = CierreInversion::latest('periodo_fin')->first();
            $periodoInicio = $ultimoCierre?->periodo_fin;
            $periodoFin = now();

            $totalRecaudado = 0.0;
            $totalDistribuido = 0.0;

            $cierre = CierreInversion::create([
                'empresa_id' => session('active_company_id'),
                'ejecutado_por' => $admin->id,
                'periodo_inicio' => $periodoInicio,
                'periodo_fin' => $periodoFin,
                'total_recaudado' => 0,
                'tasa' => $tasa,
                'total_distribuido' => 0,
            ]);

            $pagos = []; // Acumulador para insert masivo

            foreach ($inversiones as $inv) {
                $monto = (float) ($recaudaciones[$inv->id] ?? 0);
                $totalRecaudado += $monto;

                CierreInversionRecaudacion::create([
                    'cierre_id' => $cierre->id,
                    'inversion_id' => $inv->id,
                    'monto' => $monto,
                ]);

                if ($monto <= 0) {
                    continue; // Nada que distribuir
                }

                // Todo lo recaudado se distribuye íntegro
                $totalDistribuido += $monto;

                $parte = $monto / Inversion::MAX_INVERSORES;

                $financiadores = $inv->inversores
                    ->filter(fn (User $u) => (bool) $u->pivot->es_financiador)
                    ->values();
                $financiadoresCount = $financiadores->count();

                $totalCedidoEnInversion = 0.0;
                $pagosInversion = []; // Pagos de esta inversión (sin redondear aún)

                // Calcular pagos a deudores y no-deudores
                foreach ($inv->inversores as $u) {
                    $tieneDeuda = (bool) $u->pivot->tiene_deuda;

                    if (! $tieneDeuda) {
                        $pagosInversion[] = [
                            'cierre_id' => $cierre->id,
                            'user_id' => $u->id,
                            'inversion_id' => $inv->id,
                            'concepto' => CierreInversionPago::CONCEPTO_PARTE_COMPLETA,
                            'monto' => $parte,
                            'created_at' => $periodoFin,
                            'updated_at' => $periodoFin,
                        ];
                        continue;
                    }

                    // Tiene deuda: determinar posición en su ranking
                    $ranking = $rankingPorUser[$u->id] ?? [];
                    $pos = array_search($inv->id, $ranking, true); // 0-indexed

                    if ($pos === 0 || $pos === 1) {
                        // 1ra o 2da: mitad al deudor, mitad cedida
                        $mitad = $parte / 2;
                        $pagosInversion[] = [
                            'cierre_id' => $cierre->id,
                            'user_id' => $u->id,
                            'inversion_id' => $inv->id,
                            'concepto' => CierreInversionPago::CONCEPTO_MEDIA_PARTE_DEUDOR,
                            'monto' => $mitad,
                            'created_at' => $periodoFin,
                            'updated_at' => $periodoFin,
                        ];
                        $totalCedidoEnInversion += $mitad;
                    } else {
                        // 3ra+: deudor cobra 0; parte completa va a financiadores
                        $pagosInversion[] = [
                            'cierre_id' => $cierre->id,
                            'user_id' => $u->id,
                            'inversion_id' => $inv->id,
                            'concepto' => CierreInversionPago::CONCEPTO_CERO_DEUDOR,
                            'monto' => 0,
                            'created_at' => $periodoFin,
                            'updated_at' => $periodoFin,
                        ];
                        $totalCedidoEnInversion += $parte;
                    }
                }

                // Redistribución entre financiadores de esta inversión
                if ($totalCedidoEnInversion > 0 && $financiadoresCount > 0) {
                    $porFinanciador = $totalCedidoEnInversion / $financiadoresCount;
                    foreach ($financiadores as $f) {
                        $pagosInversion[] = [
                            'cierre_id' => $cierre->id,
                            'user_id' => $f->id,
                            'inversion_id' => $inv->id,
                            'concepto' => CierreInversionPago::CONCEPTO_REDISTRIBUCION,
                            'monto' => $porFinanciador,
                            'created_at' => $periodoFin,
                            'updated_at' => $periodoFin,
                        ];
                    }
                }

                // Penny shaving: redondear cada pago y ajustar el último no-cero
                // para que la suma exacta coincida con round($monto, 2).
                $objetivo = round($monto, 2);
                $sumaRedondeada = (float) array_sum(
                    array_map(fn ($p) => round($p['monto'], 2), $pagosInversion)
                );
                $diferencia = round($objetivo - $sumaRedondeada, 2);

                if ($diferencia != 0.0) {
                    for ($i = count($pagosInversion) - 1; $i >= 0; $i--) {
                        if ($pagosInversion[$i]['monto'] > 0) {
                            $pagosInversion[$i]['monto'] += $diferencia;
                            break;
                        }
                    }
                }

                foreach ($pagosInversion as &$p) {
                    $p['monto'] = round($p['monto'], 2);
                }
                unset($p);

                $pagos = array_merge($pagos, $pagosInversion);
            }

            if (! empty($pagos)) {
                CierreInversionPago::insert($pagos);
            }

            $cierre->update([
                'total_recaudado' => round($totalRecaudado, 2),
                'total_distribuido' => round($totalDistribuido, 2),
            ]);

            return $cierre->fresh();
        });
    }
}
