<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\AperturaRecaudacion;
use App\Models\CierreRecaudacion;
use App\Models\CierreSueldo;
use App\Models\CierreSueldoParticipacion;
use App\Models\CierreSueldoSocio;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProcessCierreUnificadoAction
{
    /**
     * Cierre unificado: congela las recaudaciones abiertas de TODAS las empresas
     * y crea el cierre de sueldos EDITABLE.
     *
     * A diferencia del flujo viejo, acá NO se ingresan los abonos: el cierre se
     * crea calculando los sueldos "como si todos los deudores abonaran" (media
     * parte). La decisión "abona / no abona" y el monto del abono se ajustan
     * después, por socio, desde el detalle del cierre (recalcula en vivo).
     *
     * Se guarda una FOTO de la composición de cada inversión (socio, saldo de
     * deuda, financiador) porque la deuda viva cambia con los abonos y el cálculo
     * necesita el estado original.
     *
     * @throws RuntimeException Si alguna pre-condición falla.
     */
    public function execute(float $tasa, User $admin): CierreSueldo
    {
        return DB::transaction(function () use ($tasa, $admin) {
            // 1. Toda empresa debe tener su apertura de recaudación abierta.
            $empresas = Empresa::orderBy('id')->get();

            $aperturas = AperturaRecaudacion::withoutGlobalScope(TenantScope::class)
                ->abierta()
                ->lockForUpdate()
                ->get()
                ->keyBy('empresa_id');

            $sinApertura = $empresas->filter(fn (Empresa $e) => ! $aperturas->has($e->id));
            if ($sinApertura->isNotEmpty()) {
                throw new RuntimeException(
                    'Para el cierre unificado todas las empresas deben tener una recaudación abierta. Falta: '
                    .$sinApertura->pluck('nombre')->implode(', ').'.'
                );
            }

            // 1b. Ningún vehículo del período puede apuntar a una inversión de OTRA
            //     empresa (atribuiría su recaudación a la empresa equivocada).
            $cruzados = DB::table('recaudaciones')
                ->whereIn('recaudaciones.apertura_id', $aperturas->pluck('id'))
                ->whereNull('recaudaciones.cierre_id')
                ->join('vehiculos', 'recaudaciones.vehiculo_id', '=', 'vehiculos.id')
                ->join('inversiones', 'vehiculos.inversion_id', '=', 'inversiones.id')
                ->whereColumn('inversiones.empresa_id', '!=', 'recaudaciones.empresa_id')
                ->pluck('vehiculos.patente')
                ->unique();

            if ($cruzados->isNotEmpty()) {
                throw new RuntimeException(
                    'Hay vehículos asignados a una inversión de otra empresa: '
                    .$cruzados->implode(', ')
                    .'. Corregí la inversión de esos vehículos antes de cerrar.'
                );
            }

            // 2. Inversiones de TODAS las empresas + validaciones de composición.
            $inversiones = Inversion::withoutGlobalScope(TenantScope::class)
                ->with(['inversores' => fn ($q) => $q->orderBy('users.name')])
                ->orderByRaw('LENGTH(nombre), nombre')
                ->get();

            foreach ($inversiones as $inv) {
                $count = $inv->inversores->count();
                if ($count > Inversion::MAX_INVERSORES) {
                    throw new RuntimeException(
                        "La inversión \"{$inv->nombre}\" tiene {$count} inversores; el máximo permitido es ".Inversion::MAX_INVERSORES.'.'
                    );
                }

                $tieneDeudores = $inv->inversores->contains(fn (User $u) => (float) $u->pivot->deuda > 0);
                $tieneFinanciadores = $inv->inversores->contains(fn (User $u) => (bool) $u->pivot->es_financiador);

                if ($tieneDeudores && ! $tieneFinanciadores) {
                    throw new RuntimeException(
                        "La inversión \"{$inv->nombre}\" tiene deudores pero no financiadores asignados."
                    );
                }
            }

            // 3. Crear el cierre y congelar la recaudación de cada empresa.
            $cierre = CierreSueldo::create([
                'ejecutado_por' => $admin->id,
                'tasa' => $tasa,
            ]);

            foreach ($empresas as $empresa) {
                $apertura = $aperturas[$empresa->id];

                $cierreRec = CierreRecaudacion::create([
                    'empresa_id' => $empresa->id,
                    'user_id' => $admin->id,
                    'cierre_sueldo_id' => $cierre->id,
                ]);

                DB::table('recaudaciones')
                    ->where('apertura_id', $apertura->id)
                    ->whereNull('cierre_id')
                    ->update(['cierre_id' => $cierreRec->id]);

                $apertura->update(['cierre_id' => $cierreRec->id]);
            }

            // 4. Foto de la composición de cada inversión + decisiones por deudor.
            $deudorIds = [];
            foreach ($inversiones as $inv) {
                foreach ($inv->inversores as $u) {
                    CierreSueldoParticipacion::create([
                        'cierre_sueldo_id' => $cierre->id,
                        'inversion_id' => $inv->id,
                        'user_id' => $u->id,
                        'empresa_id' => $inv->empresa_id,
                        'saldo' => (float) $u->pivot->deuda,
                        'es_financiador' => (bool) $u->pivot->es_financiador,
                    ]);

                    if ((float) $u->pivot->deuda > 0) {
                        $deudorIds[$u->id] = true;
                    }
                }
            }

            foreach (array_keys($deudorIds) as $userId) {
                CierreSueldoSocio::create([
                    'cierre_sueldo_id' => $cierre->id,
                    'user_id' => $userId,
                    'abona' => true,
                    'abono_monto' => 0,
                ]);
            }

            $recalc = app(RecalcularSueldosAction::class);

            // 5. Primer cálculo (sueldos "como si todos abonaran"; sin abonos aún).
            $recalc->execute($cierre);

            // 6. Preseteo del abono de cada deudor = su sueldo generado, y re-cálculo
            //    para aplicar los abonos a la deuda.
            foreach (array_keys($deudorIds) as $userId) {
                $salario = (float) $cierre->pagos()->where('user_id', $userId)->sum('monto');
                CierreSueldoSocio::where('cierre_sueldo_id', $cierre->id)
                    ->where('user_id', $userId)
                    ->update(['abono_monto' => $salario]);
            }

            $recalc->execute($cierre->fresh());

            return $cierre->fresh();
        });
    }
}
