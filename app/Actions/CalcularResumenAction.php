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
 * Resumen financiero: ingresos (recaudaciones) vs egresos para un rango de
 * fechas, con filtros combinables de empresa, inversión, vehículos y
 * categoría. Es la única fuente de cifras del módulo Resumen: la vista
 * Inertia y las exportaciones PDF/Excel consumen esta misma Action.
 *
 * Reglas de atribución:
 *  - Ingresos: recaudaciones de los cierres cuya fecha (created_at del
 *    cierre) cae dentro del rango. La granularidad real es el período: un
 *    período cerrado dentro del rango cuenta completo. El período abierto se
 *    reporta aparte y sólo suma si `incluir_abierto` es true.
 *  - Egresos de un vehículo = gastos de tipo `vehiculo` (por su columna
 *    `fecha`) MÁS los repuestos que se le colocaron desde inventario,
 *    valuados a precio de venta (el mismo importe que se le cobra a la
 *    inversión y que muestra el módulo de Cobros).
 *  - Categorías del resumen (ver TIPO_LABELS): los gastos de galpón, taller
 *    y oficina se presentan unificados bajo "Galpón"; kevin y stock quedan
 *    excluidos del reporte. Nada de esto altera cómo se cargan los gastos:
 *    es agrupación de presentación, los datos siguen intactos.
 *  - Galpón no se prorratea por vehículo: aparece sólo en los totales y en
 *    el desglose por categoría. Con filtro de empresa aporta la parte de esa
 *    empresa según el reparto congelado (`distribucion_empresas`).
 *  - Con filtro de inversión o vehículos sólo cuentan los conceptos
 *    atribuibles a esa flota (gastos de vehículo y repuestos).
 */
class CalcularResumenAction
{
    /**
     * Categorías de egreso del resumen. `vehiculo` y `repuesto` bajan a nivel
     * vehículo; `galpon` agrupa los gastos globales (galpón/taller/oficina).
     */
    public const TIPO_LABELS = [
        'vehiculo' => 'Vehículo',
        'repuesto' => 'Repuestos (inventario)',
        'galpon' => 'Galpón',
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
        $gastosPorVehiculo = $this->gastosDeFlotaPorVehiculo($desde, $hasta, $empresaId, $inversionId, $vehiculoIds, $tipo);
        $repuestosPorVehiculo = $this->repuestosPorVehiculo($desde, $hasta, $empresaId, $inversionId, $vehiculoIds, $tipo);
        $egresosPorTipo = $this->egresosPorTipo($gastosPorVehiculo, $repuestosPorVehiculo, $desde, $hasta, $empresaId, $inversionId, $vehiculoIds, $tipo);

        // ── Armado de filas ─────────────────────────────────────────────────
        $totalIngresos = round((float) $ingresosPorVehiculo->sum(), 2);
        $totalEgresos = round((float) $egresosPorTipo->sum(), 2);

        $porVehiculo = $this->filasPorVehiculo($ingresosPorVehiculo, $gastosPorVehiculo, $repuestosPorVehiculo);

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
     * Gastos de tipo `vehiculo` agrupados por vehículo, en el rango.
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
     * Repuestos salidos de inventario hacia cada vehículo, valuados a precio
     * de venta (costo + markup) — el mismo importe que se le cobra a la
     * inversión y que muestra el módulo de Cobros.
     *
     * Se parte de `cobros` porque es el registro que vincula la salida de
     * stock con el vehículo y su inversión; anular una transacción borra su
     * cobro, así que las anuladas no cuentan. El filtro explícito sobre
     * `inactiva` protege igual, porque consultar la tabla directamente no
     * aplica el global scope `activa` de Transaccion.
     *
     * @param  array<int, int>  $vehiculoIds
     * @return Collection<int, float> vehiculo_id => total
     */
    private function repuestosPorVehiculo(
        CarbonImmutable $desde,
        CarbonImmutable $hasta,
        ?int $empresaId,
        ?int $inversionId,
        array $vehiculoIds,
        ?string $tipo,
    ): Collection {
        if ($tipo !== null && $tipo !== 'repuesto') {
            return collect();
        }

        return DB::table('cobros')
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->where('transacciones.inactiva', false)
            ->whereBetween('transacciones.created_at', [$desde, $hasta])
            ->when($empresaId !== null, fn ($q) => $q->where('vehiculos.empresa_id', $empresaId))
            ->when($inversionId !== null, fn ($q) => $q->where('vehiculos.inversion_id', $inversionId))
            ->when($vehiculoIds !== [], fn ($q) => $q->whereIn('transacciones.vehiculo_id', $vehiculoIds))
            ->groupBy('transacciones.vehiculo_id')
            ->selectRaw('transacciones.vehiculo_id as vehiculo_id, SUM(articulos.precio * transacciones.cantidad) as total')
            ->pluck('total', 'vehiculo_id')
            ->map(fn ($total) => (float) $total);
    }

    /**
     * Egresos agrupados por categoría del resumen. Su suma es el total de
     * egresos (galpón cuenta acá aunque no baje a nivel vehículo).
     *
     * @param  Collection<int, float>  $gastosPorVehiculo
     * @param  Collection<int, float>  $repuestosPorVehiculo
     * @param  array<int, int>  $vehiculoIds
     * @return Collection<string, float> categoría => total
     */
    private function egresosPorTipo(
        Collection $gastosPorVehiculo,
        Collection $repuestosPorVehiculo,
        CarbonImmutable $desde,
        CarbonImmutable $hasta,
        ?int $empresaId,
        ?int $inversionId,
        array $vehiculoIds,
        ?string $tipo,
    ): Collection {
        $porTipo = collect();

        $flota = round((float) $gastosPorVehiculo->sum(), 2);
        if ($flota > 0) {
            $porTipo->put('vehiculo', $flota);
        }

        $repuestos = round((float) $repuestosPorVehiculo->sum(), 2);
        if ($repuestos > 0) {
            $porTipo->put('repuesto', $repuestos);
        }

        // Galpón no es atribuible a vehículos concretos: un filtro de flota
        // (inversión o patentes) lo deja fuera.
        $pideGalpon = $tipo === null || $tipo === 'galpon';
        if ($pideGalpon && $inversionId === null && $vehiculoIds === []) {
            $galpon = $this->totalGalpon($desde, $hasta, $empresaId);
            if ($galpon > 0) {
                $porTipo->put('galpon', $galpon);
            }
        }

        return $porTipo;
    }

    /**
     * Total de la categoría Galpón (galpón + taller + oficina unificados).
     * Con filtro de empresa toma la parte congelada de esa empresa en cada
     * gasto; kevin y stock nunca entran, quedan fuera del resumen.
     */
    private function totalGalpon(CarbonImmutable $desde, CarbonImmutable $hasta, ?int $empresaId): float
    {
        $rango = [$desde->toDateString(), $hasta->toDateString()];

        if ($empresaId === null) {
            return round((float) DB::table('gastos')
                ->whereIn('tipo', Gasto::TIPOS_GLOBALES)
                ->whereBetween('fecha', $rango)
                ->sum('monto'), 2);
        }

        $total = 0.0;

        $gastos = Gasto::query()
            ->withoutGlobalScope(GastoTenantScope::class)
            ->whereIn('tipo', Gasto::TIPOS_GLOBALES)
            ->whereBetween('fecha', $rango)
            ->cursor();

        foreach ($gastos as $gasto) {
            $total += (float) (($gasto->distribucion_empresas ?? [])[$empresaId] ?? 0);
        }

        return round($total, 2);
    }

    /**
     * Filas por vehículo con el egreso ya unificado (gastos propios más
     * repuestos de inventario), más metadata de inversión y empresa.
     * Ordenadas como el dashboard: inversión natural y patente dentro de
     * cada inversión.
     *
     * @param  Collection<int, float>  $ingresos
     * @param  Collection<int, float>  $gastos
     * @param  Collection<int, float>  $repuestos
     * @return Collection<int, array<string, mixed>>
     */
    private function filasPorVehiculo(Collection $ingresos, Collection $gastos, Collection $repuestos): Collection
    {
        $ids = $ingresos->keys()
            ->merge($gastos->keys())
            ->merge($repuestos->keys())
            ->unique()
            ->values();

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
                'user:id,name',
            ])
            ->whereIn('id', $ids)
            ->get(['id', 'patente', 'marca', 'modelo', 'inversion_id', 'empresa_id', 'user_id'])
            ->map(function (Vehiculo $v) use ($ingresos, $gastos, $repuestos) {
                $ing = round((float) ($ingresos[$v->id] ?? 0), 2);
                $gas = round((float) ($gastos[$v->id] ?? 0), 2);
                $rep = round((float) ($repuestos[$v->id] ?? 0), 2);
                $egr = round($gas + $rep, 2);

                return [
                    'vehiculo_id' => $v->id,
                    'patente' => $v->patente,
                    'marca' => $v->marca,
                    'modelo' => $v->modelo,
                    'inversion_nombre' => $v->inversion?->nombre,
                    'empresa_nombre' => $v->empresa?->nombre,
                    'chofer_nombre' => $v->user?->name,
                    'ingresos' => $ing,
                    'gastos' => $gas,
                    'repuestos' => $rep,
                    'egresos' => $egr,
                    'neto' => round($ing - $egr, 2),
                ];
            })
            ->sort(fn (array $a, array $b) => strnatcasecmp($a['inversion_nombre'] ?? '~', $b['inversion_nombre'] ?? '~')
                ?: strnatcasecmp($a['patente'], $b['patente']))
            ->values();
    }
}
