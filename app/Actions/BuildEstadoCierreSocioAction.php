<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\CierreRecaudacion;
use App\Models\CierreSueldo;
use App\Models\CierreSueldoPago;
use App\Models\CierreSueldoParticipacion;
use App\Models\Gasto;
use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Arma el "estado del cierre" para un socio: la foto de un cierre de sueldo
 * desde su punto de vista — cuánto recaudaron sus inversiones (y el total de
 * la empresa), en qué se fueron los gastos (flota por vehículo + globales
 * prorrateados) y cuánto cobró de sueldo.
 *
 * Todo es derivado (no hay tablas de movimientos). La recaudación se ata al
 * cierre por CierreRecaudacion.cierre_sueldo_id; los gastos, por rango de fecha
 * del período (viven en el flujo de caja). Kevin/stock se excluye para el socio.
 */
class BuildEstadoCierreSocioAction
{
    public function execute(CierreSueldo $cierre, User $socio): array
    {
        $hasta = $cierre->created_at->toDateTimeString();
        $desde = CierreSueldo::where('created_at', '<', $cierre->created_at)
            ->latest()
            ->value('created_at')?->toDateTimeString();

        // Inversiones del socio en este cierre (foto congelada).
        $participaciones = CierreSueldoParticipacion::withoutGlobalScope(TenantScope::class)
            ->where('cierre_sueldo_id', $cierre->id)
            ->where('user_id', $socio->id)
            ->get();

        // Cantidad de inversores por inversión (para el peso por partes iguales).
        $inversoresPorInversion = CierreSueldoParticipacion::withoutGlobalScope(TenantScope::class)
            ->where('cierre_sueldo_id', $cierre->id)
            ->selectRaw('inversion_id, COUNT(*) as total')
            ->groupBy('inversion_id')
            ->pluck('total', 'inversion_id');

        // Cierres de recaudación (uno por empresa) atados a este cierre de sueldo.
        $cierresRec = CierreRecaudacion::withoutGlobalScope(TenantScope::class)
            ->where('cierre_sueldo_id', $cierre->id)
            ->get(['id', 'empresa_id']);
        $recIdPorEmpresa = $cierresRec->pluck('id', 'empresa_id');

        // Recaudación por inversión del período (sólo de los cierres de recaudación de este cierre).
        $recaudadoPorInversion = $cierresRec->isEmpty()
            ? collect()
            : DB::table('recaudaciones')
                ->whereIn('recaudaciones.cierre_id', $cierresRec->pluck('id'))
                ->join('vehiculos', 'recaudaciones.vehiculo_id', '=', 'vehiculos.id')
                ->whereNotNull('vehiculos.inversion_id')
                ->groupBy('vehiculos.inversion_id')
                ->selectRaw('vehiculos.inversion_id as inversion_id, SUM(recaudaciones.total) as total')
                ->pluck('total', 'inversion_id');

        // Pagos de sueldo del socio en este cierre.
        $pagos = CierreSueldoPago::withoutGlobalScope(TenantScope::class)
            ->with(['inversion' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)->select('id', 'nombre')])
            ->where('cierre_sueldo_id', $cierre->id)
            ->where('user_id', $socio->id)
            ->get();

        // Agrupar por empresa (normalmente una sola).
        $empresas = $participaciones
            ->groupBy('empresa_id')
            ->map(function ($parts, $empresaId) use (
                $recIdPorEmpresa, $recaudadoPorInversion, $inversoresPorInversion,
                $pagos, $desde, $hasta,
            ) {
                $empresaId = (int) $empresaId;

                $empresaNombre = DB::table('empresas')->where('id', $empresaId)->value('nombre') ?? 'N/A';

                // Nombres de las inversiones del socio en esta empresa.
                $invIds = $parts->pluck('inversion_id')->map(fn ($id) => (int) $id)->all();
                $invNombres = DB::table('inversiones')->whereIn('id', $invIds)->pluck('nombre', 'id');

                // Recaudación total de la empresa en el cierre (todas sus recaudaciones).
                $recId = $recIdPorEmpresa[$empresaId] ?? null;
                $recaudacionEmpresa = $recId
                    ? (float) DB::table('recaudaciones')->where('cierre_id', $recId)->sum('total')
                    : 0.0;

                // Mis inversiones con su recaudación + peso por partes iguales.
                $misInversiones = $parts
                    ->map(function (CierreSueldoParticipacion $p) use ($recaudadoPorInversion, $inversoresPorInversion, $invNombres) {
                        $recaudado = (float) ($recaudadoPorInversion[$p->inversion_id] ?? 0);
                        $count = (int) ($inversoresPorInversion[$p->inversion_id] ?? 1);

                        return [
                            'inversion_id' => (int) $p->inversion_id,
                            'inversion_nombre' => $invNombres[$p->inversion_id] ?? 'N/A',
                            'recaudado' => $recaudado,
                            'es_financiador' => (bool) $p->es_financiador,
                            'peso' => $count > 0 ? $recaudado / $count : 0.0,
                        ];
                    })
                    ->sortBy('inversion_nombre', SORT_NATURAL | SORT_FLAG_CASE)
                    ->values();

                $miRecaudacion = (float) $misInversiones->sum('recaudado');
                $miPeso = (float) $misInversiones->sum('peso');
                $miFraccion = $recaudacionEmpresa > 0 ? $miPeso / $recaudacionEmpresa : 0.0;

                // ── Gastos del período ───────────────────────────────────
                // Flota: gastos tipo vehículo de los autos de MIS inversiones.
                $flota = Gasto::withoutGlobalScope(GastoTenantScope::class)
                    ->where('gastos.tipo', 'vehiculo')
                    ->whereNotNull('gastos.vehiculo_id')
                    ->when($desde, fn ($q) => $q->where('gastos.created_at', '>', $desde))
                    ->where('gastos.created_at', '<=', $hasta)
                    ->join('vehiculos', 'gastos.vehiculo_id', '=', 'vehiculos.id')
                    ->whereIn('vehiculos.inversion_id', $invIds)
                    ->selectRaw('vehiculos.id as vehiculo_id, vehiculos.patente, vehiculos.marca, vehiculos.modelo, SUM(gastos.monto) as total')
                    ->groupBy('vehiculos.id', 'vehiculos.patente', 'vehiculos.marca', 'vehiculos.modelo')
                    ->orderBy('vehiculos.patente')
                    ->get()
                    ->map(fn ($v) => [
                        'patente' => $v->patente,
                        'vehiculo' => trim($v->marca.' '.$v->modelo),
                        'monto' => (float) $v->total,
                    ]);

                $flotaTotal = (float) $flota->sum('monto');

                // Globales (galpón/taller/oficina): gastos globales sin empresa_id
                // directo; la parte de cada empresa vive en distribucion_empresas
                // (mismo criterio que las cards de Cobros/Gastos).
                $globalesEmpresa = (float) Gasto::withoutGlobalScope(GastoTenantScope::class)
                    ->whereIn('gastos.tipo', Gasto::TIPOS_GLOBALES)
                    ->when($desde, fn ($q) => $q->where('gastos.created_at', '>', $desde))
                    ->where('gastos.created_at', '<=', $hasta)
                    ->get(['distribucion_empresas'])
                    ->sum(fn (Gasto $g) => (float) (($g->distribucion_empresas ?? [])[$empresaId] ?? 0));

                $globalesMiParte = round($globalesEmpresa * $miFraccion, 2);

                // ── Sueldo del socio en esta empresa ─────────────────────
                $misPagos = $pagos->where('empresa_id', $empresaId);
                $sueldoDetalle = $misPagos
                    ->map(fn (CierreSueldoPago $p) => [
                        'inversion' => $p->inversion?->nombre ?? 'N/A',
                        'concepto' => $p->concepto,
                        'monto' => (float) $p->monto,
                    ])
                    ->sortBy(fn ($d) => (string) $d['inversion'], SORT_NATURAL | SORT_FLAG_CASE)
                    ->values();
                $sueldoTotal = (float) $misPagos->sum(fn (CierreSueldoPago $p) => (float) $p->monto);

                return [
                    'empresa_id' => $empresaId,
                    'empresa_nombre' => $empresaNombre,
                    'recaudacion_empresa' => $recaudacionEmpresa,
                    'mi_recaudacion' => $miRecaudacion,
                    'mi_fraccion' => round($miFraccion, 4),
                    'inversiones' => $misInversiones->map(fn ($i) => [
                        'inversion_nombre' => $i['inversion_nombre'],
                        'recaudado' => $i['recaudado'],
                        'es_financiador' => $i['es_financiador'],
                    ])->values(),
                    'gastos' => [
                        'flota' => $flota->values(),
                        'flota_total' => $flotaTotal,
                        'globales_empresa' => $globalesEmpresa,
                        'globales_mi_parte' => $globalesMiParte,
                        'total' => $flotaTotal + $globalesMiParte,
                    ],
                    'sueldo' => [
                        'detalle' => $sueldoDetalle,
                        'total' => $sueldoTotal,
                    ],
                ];
            })
            ->values();

        return [
            'cierre' => [
                'id' => $cierre->id,
                'fecha' => $cierre->created_at?->toIso8601String(),
                'tasa' => (float) $cierre->tasa,
            ],
            'socio' => [
                'id' => $socio->id,
                'name' => $socio->name,
            ],
            'empresas' => $empresas,
            'totales' => [
                'recaudado' => (float) $empresas->sum('mi_recaudacion'),
                'gastos' => (float) $empresas->sum(fn ($e) => $e['gastos']['total']),
                'sueldo' => (float) $empresas->sum(fn ($e) => $e['sueldo']['total']),
            ],
        ];
    }
}
