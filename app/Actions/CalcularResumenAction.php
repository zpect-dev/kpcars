<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Gasto;
use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Resumen financiero: ingresos (recaudaciones) vs egresos (gastos) para un
 * rango de fechas, con filtros combinables de empresa, inversión, vehículos
 * y tipo de gasto. Es la única fuente de cifras del módulo Resumen: la vista
 * Inertia y las exportaciones PDF/Excel consumen esta misma Action.
 *
 * Reglas de atribución:
 *  - Ingresos: recaudaciones de los cierres cuya fecha (created_at del
 *    cierre) cae dentro del rango. La granularidad real es el período: un
 *    período cerrado dentro del rango cuenta completo. El período abierto se
 *    reporta aparte y sólo suma si `incluir_abierto` es true.
 *  - Egresos: gastos por su columna `fecha` (día exacto).
 *  - Gastos globales (galpón/taller/oficina/kevin/stock) no se prorratean
 *    por vehículo: aparecen sólo en los totales y en el desglose por tipo.
 *  - Con filtro de empresa, los globales aportan la parte de esa empresa
 *    según el reparto congelado (`distribucion_empresas`); kevin/stock no
 *    tienen dimensión de empresa y quedan fuera.
 *  - Con filtro de inversión o vehículos, sólo cuentan gastos de flota
 *    (tipo `vehiculo`) de ese subconjunto.
 */
class CalcularResumenAction
{
    public const TIPO_LABELS = [
        'galpon' => 'Galpón',
        'taller' => 'Taller',
        'oficina' => 'Oficina',
        'kevin' => 'Kevin',
        'stock' => 'Stock',
        'vehiculo' => 'Vehículo',
    ];

    /**
     * @param  array{
     *     desde: string,
     *     hasta: string,
     *     empresa_id: ?int,
     *     inversion_id: ?int,
     *     vehiculo_ids: array<int, int>,
     *     tipo: ?string,
     *     incluir_abierto: bool,
     * }  $filtros
     * @return array{
     *     totales: array{ingresos: float, egresos: float, neto: float},
     *     abierto: array{total: float, incluido: bool},
     *     cierres_en_rango: int,
     *     por_vehiculo: Collection<int, array<string, mixed>>,
     *     por_tipo: Collection<int, array<string, mixed>>,
     * }
     */
    public function execute(array $filtros): array
    {
        $desde = CarbonImmutable::parse($filtros['desde'])->startOfDay();
        $hasta = CarbonImmutable::parse($filtros['hasta'])->endOfDay();
        $empresaId = $filtros['empresa_id'] ?? null;
        $inversionId = $filtros['inversion_id'] ?? null;
        $vehiculoIds = array_map('intval', $filtros['vehiculo_ids'] ?? []);
        $tipo = $filtros['tipo'] ?? null;
        $incluirAbierto = (bool) ($filtros['incluir_abierto'] ?? false);

        // ── Ingresos ────────────────────────────────────────────────────────
        $ingresosPorVehiculo = $this->recaudadoPorVehiculo(true, $desde, $hasta, $empresaId, $inversionId, $vehiculoIds);
        $abiertoPorVehiculo = $this->recaudadoPorVehiculo(false, null, null, $empresaId, $inversionId, $vehiculoIds);
        $totalAbierto = round((float) $abiertoPorVehiculo->sum(), 2);

        if ($incluirAbierto) {
            foreach ($abiertoPorVehiculo as $vehiculoId => $total) {
                $ingresosPorVehiculo[$vehiculoId] = ($ingresosPorVehiculo[$vehiculoId] ?? 0.0) + $total;
            }
        }

        $cierresEnRango = DB::table('cierres_recaudacion')
            ->whereBetween('created_at', [$desde, $hasta])
            ->when($empresaId !== null, fn ($q) => $q->where('empresa_id', $empresaId))
            ->count();

        // ── Egresos ─────────────────────────────────────────────────────────
        $egresosPorVehiculo = $this->gastosDeFlotaPorVehiculo($desde, $hasta, $empresaId, $inversionId, $vehiculoIds, $tipo);
        $egresosPorTipo = $this->egresosPorTipo($desde, $hasta, $empresaId, $inversionId, $vehiculoIds, $tipo);

        // ── Armado de filas ─────────────────────────────────────────────────
        $totalIngresos = round((float) $ingresosPorVehiculo->sum(), 2);
        $totalEgresos = round((float) $egresosPorTipo->sum(), 2);

        $porVehiculo = $this->filasPorVehiculo($ingresosPorVehiculo, $egresosPorVehiculo);

        $porTipo = $egresosPorTipo
            ->map(fn (float $total, string $t) => [
                'tipo' => $t,
                'label' => self::TIPO_LABELS[$t] ?? ucfirst($t),
                'total' => round($total, 2),
                'porcentaje' => $totalEgresos > 0 ? round($total / $totalEgresos * 100, 1) : 0.0,
            ])
            ->sortByDesc('total')
            ->values();

        return [
            'totales' => [
                'ingresos' => $totalIngresos,
                'egresos' => $totalEgresos,
                'neto' => round($totalIngresos - $totalEgresos, 2),
            ],
            'abierto' => [
                'total' => $totalAbierto,
                'incluido' => $incluirAbierto,
            ],
            'cierres_en_rango' => $cierresEnRango,
            'por_vehiculo' => $porVehiculo,
            'por_tipo' => $porTipo,
        ];
    }

    /**
     * Total recaudado por vehículo. Cerradas: recaudaciones de cierres cuya
     * fecha cae en el rango. Abiertas: el período en curso (sin cierre).
     *
     * @param  array<int, int>  $vehiculoIds
     * @return Collection<int, float> vehiculo_id => total
     */
    private function recaudadoPorVehiculo(
        bool $cerradas,
        ?CarbonImmutable $desde,
        ?CarbonImmutable $hasta,
        ?int $empresaId,
        ?int $inversionId,
        array $vehiculoIds,
    ): Collection {
        $q = DB::table('recaudaciones');

        if ($cerradas) {
            $q->join('cierres_recaudacion', 'recaudaciones.cierre_id', '=', 'cierres_recaudacion.id')
                ->whereBetween('cierres_recaudacion.created_at', [$desde, $hasta]);
        } else {
            $q->whereNull('recaudaciones.cierre_id');
        }

        if ($empresaId !== null) {
            $q->where('recaudaciones.empresa_id', $empresaId);
        }

        if ($inversionId !== null) {
            $q->join('vehiculos', 'recaudaciones.vehiculo_id', '=', 'vehiculos.id')
                ->where('vehiculos.inversion_id', $inversionId);
        }

        if ($vehiculoIds !== []) {
            $q->whereIn('recaudaciones.vehiculo_id', $vehiculoIds);
        }

        return $q->groupBy('recaudaciones.vehiculo_id')
            ->selectRaw('recaudaciones.vehiculo_id as vehiculo_id, SUM(recaudaciones.total) as total')
            ->pluck('total', 'vehiculo_id')
            ->map(fn ($total) => (float) $total);
    }

    /**
     * Gastos de flota (tipo `vehiculo`) agrupados por vehículo, en el rango.
     * Un filtro de tipo distinto de `vehiculo` vacía esta dimensión.
     *
     * @param  array<int, int>  $vehiculoIds
     * @return Collection<int, float> vehiculo_id => total
     */
    private function gastosDeFlotaPorVehiculo(
        CarbonImmutable $desde,
        CarbonImmutable $hasta,
        ?int $empresaId,
        ?int $inversionId,
        array $vehiculoIds,
        ?string $tipo,
    ): Collection {
        if ($tipo !== null && $tipo !== 'vehiculo') {
            return collect();
        }

        return DB::table('gastos')
            ->where('gastos.tipo', 'vehiculo')
            ->whereBetween('gastos.fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->join('vehiculos', 'gastos.vehiculo_id', '=', 'vehiculos.id')
            ->when($empresaId !== null, fn ($q) => $q->where('vehiculos.empresa_id', $empresaId))
            ->when($inversionId !== null, fn ($q) => $q->where('vehiculos.inversion_id', $inversionId))
            ->when($vehiculoIds !== [], fn ($q) => $q->whereIn('gastos.vehiculo_id', $vehiculoIds))
            ->groupBy('gastos.vehiculo_id')
            ->selectRaw('gastos.vehiculo_id as vehiculo_id, SUM(gastos.monto) as total')
            ->pluck('total', 'vehiculo_id')
            ->map(fn ($total) => (float) $total);
    }

    /**
     * Egresos agrupados por tipo de gasto. Su suma es el total de egresos del
     * resumen (los globales cuentan acá aunque no bajen a nivel vehículo).
     *
     * @param  array<int, int>  $vehiculoIds
     * @return Collection<string, float> tipo => total
     */
    private function egresosPorTipo(
        CarbonImmutable $desde,
        CarbonImmutable $hasta,
        ?int $empresaId,
        ?int $inversionId,
        array $vehiculoIds,
        ?string $tipo,
    ): Collection {
        // Filtro de flota: sólo gastos de vehículo del subconjunto.
        if ($inversionId !== null || $vehiculoIds !== []) {
            $total = (float) $this->gastosDeFlotaPorVehiculo($desde, $hasta, $empresaId, $inversionId, $vehiculoIds, $tipo)->sum();

            return $total > 0 ? collect(['vehiculo' => $total]) : collect();
        }

        // Sin filtro de empresa: agregación directa en SQL.
        if ($empresaId === null) {
            return DB::table('gastos')
                ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
                ->when($tipo !== null, fn ($q) => $q->where('tipo', $tipo))
                ->groupBy('tipo')
                ->selectRaw('tipo, SUM(monto) as total')
                ->pluck('total', 'tipo')
                ->map(fn ($total) => (float) $total);
        }

        // Con filtro de empresa: flota por empresa del vehículo + parte de la
        // empresa en los globales según el reparto congelado. Kevin/stock no
        // son atribuibles a una empresa y quedan fuera.
        $porTipo = collect();

        if ($tipo === null || $tipo === 'vehiculo') {
            $flota = (float) $this->gastosDeFlotaPorVehiculo($desde, $hasta, $empresaId, null, [], 'vehiculo')->sum();
            if ($flota > 0) {
                $porTipo->put('vehiculo', $flota);
            }
        }

        if ($tipo === null || in_array($tipo, Gasto::TIPOS_GLOBALES, true)) {
            $globales = Gasto::query()
                ->withoutGlobalScope(GastoTenantScope::class)
                ->whereIn('tipo', $tipo !== null ? [$tipo] : Gasto::TIPOS_GLOBALES)
                ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
                ->cursor();

            foreach ($globales as $gasto) {
                $parte = (float) (($gasto->distribucion_empresas ?? [])[$empresaId] ?? 0);
                if ($parte > 0) {
                    $porTipo->put($gasto->tipo, (float) $porTipo->get($gasto->tipo, 0) + $parte);
                }
            }
        }

        return $porTipo->map(fn ($total) => (float) $total);
    }

    /**
     * Filas por vehículo (ingresos, egresos directos, neto), con metadata de
     * inversión y empresa, ordenadas como el dashboard: inversión natural y
     * patente dentro de cada inversión.
     *
     * @param  Collection<int, float>  $ingresos
     * @param  Collection<int, float>  $egresos
     * @return Collection<int, array<string, mixed>>
     */
    private function filasPorVehiculo(Collection $ingresos, Collection $egresos): Collection
    {
        $ids = $ingresos->keys()->merge($egresos->keys())->unique()->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return Vehiculo::query()
            ->withoutGlobalScope(TenantScope::class)
            ->with([
                'inversion' => fn ($q) => $q
                    ->withoutGlobalScope(TenantScope::class)
                    ->select('id', 'nombre'),
                'empresa:id,nombre',
            ])
            ->whereIn('id', $ids)
            ->get(['id', 'patente', 'marca', 'modelo', 'inversion_id', 'empresa_id'])
            ->map(function (Vehiculo $v) use ($ingresos, $egresos) {
                $ing = round((float) ($ingresos[$v->id] ?? 0), 2);
                $egr = round((float) ($egresos[$v->id] ?? 0), 2);

                return [
                    'vehiculo_id' => $v->id,
                    'patente' => $v->patente,
                    'marca' => $v->marca,
                    'modelo' => $v->modelo,
                    'inversion_nombre' => $v->inversion?->nombre,
                    'empresa_nombre' => $v->empresa?->nombre,
                    'ingresos' => $ing,
                    'egresos' => $egr,
                    'neto' => round($ing - $egr, 2),
                ];
            })
            ->sort(fn (array $a, array $b) => strnatcasecmp($a['inversion_nombre'] ?? '~', $b['inversion_nombre'] ?? '~')
                ?: strnatcasecmp($a['patente'], $b['patente']))
            ->values();
    }
}
