<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CalcularResumenAction;
use App\Http\Requests\ResumenFiltrosRequest;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ResumenController extends Controller
{
    /**
     * Resumen financiero (ingresos vs egresos). Vista GLOBAL: los catálogos y
     * las cifras ignoran la empresa activa de la sesión; la empresa es un
     * filtro más del reporte. La autorización vive en el FormRequest
     * (gate view-resumen) más el middleware role:administrador de la ruta.
     */
    public function index(ResumenFiltrosRequest $request, CalcularResumenAction $action): Response
    {
        $filtros = $request->filtros();

        // Catálogos globales para los filtros (todas las empresas).
        $empresas = Empresa::orderBy('nombre')->get(['id', 'nombre']);

        $inversiones = Inversion::query()
            ->withoutGlobalScope(TenantScope::class)
            ->with('empresa:id,nombre')
            ->get(['id', 'nombre', 'empresa_id'])
            ->map(fn (Inversion $i) => [
                'id' => $i->id,
                'nombre' => $i->nombre,
                'empresa_nombre' => $i->empresa?->nombre,
            ])
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $vehiculos = Vehiculo::query()
            ->withoutGlobalScope(TenantScope::class)
            ->where('patente', '!=', 'EXTERNO')
            ->orderBy('patente')
            ->get(['id', 'patente', 'marca', 'modelo']);

        return Inertia::render('Resumen/Index', [
            'filters' => $filtros,
            'resumen' => $action->execute($filtros),
            'empresas' => $empresas,
            'inversiones' => $inversiones,
            'vehiculos' => $vehiculos,
            'tipos' => CalcularResumenAction::TIPO_LABELS,
        ]);
    }

    /**
     * Detalle de UN vehículo: el desglose línea a línea de sus ingresos
     * (recaudaciones) y egresos (gastos de flota + repuestos de inventario) con
     * su fecha, dentro del rango de fechas del reporte. Mismas fuentes y filtros
     * de fecha que {@see CalcularResumenAction} para que las cifras cuadren.
     */
    public function vehiculo(ResumenFiltrosRequest $request, int $vehiculo): Response
    {
        $filtros = $request->filtros();
        $desde = CarbonImmutable::parse($filtros['desde'])->startOfDay();
        $hasta = CarbonImmutable::parse($filtros['hasta'])->endOfDay();

        $veh = Vehiculo::query()
            ->withoutGlobalScope(TenantScope::class)
            ->with([
                'inversion' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)->select('id', 'nombre'),
                'empresa:id,nombre',
            ])
            ->findOrFail($vehiculo);

        $soloFecha = fn ($f) => $f ? substr((string) $f, 0, 10) : null;

        // ── Ingresos: recaudaciones cerradas (cierre en rango) + abiertas ──────
        $ingresos = DB::table('recaudaciones')
            ->join('cierres_recaudacion', 'recaudaciones.cierre_id', '=', 'cierres_recaudacion.id')
            ->where('recaudaciones.vehiculo_id', $veh->id)
            ->whereBetween('cierres_recaudacion.created_at', [$desde, $hasta])
            ->orderBy('cierres_recaudacion.created_at')
            ->get(['recaudaciones.total', 'cierres_recaudacion.created_at as fecha'])
            ->map(fn ($r) => [
                'fecha' => $soloFecha($r->fecha),
                'concepto' => 'Recaudación (cerrada)',
                'en_curso' => false,
                'monto' => (float) $r->total,
            ]);

        if ($filtros['incluir_abierto']) {
            $abiertas = DB::table('recaudaciones')
                ->where('vehiculo_id', $veh->id)
                ->whereNull('cierre_id')
                ->orderBy('created_at')
                ->get(['total', 'created_at as fecha'])
                ->map(fn ($r) => [
                    'fecha' => $soloFecha($r->fecha),
                    'concepto' => 'Recaudación en curso',
                    'en_curso' => true,
                    'monto' => (float) $r->total,
                ]);

            $ingresos = $ingresos->concat($abiertas);
        }

        // ── Egresos: gastos de flota (por fecha) + repuestos (por transacción) ─
        $gastos = DB::table('gastos')
            ->where('gastos.tipo', 'vehiculo')
            ->where('gastos.vehiculo_id', $veh->id)
            ->whereBetween('gastos.fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->orderBy('gastos.fecha')
            ->get(['gastos.fecha', 'gastos.descripcion', 'gastos.recibio', 'gastos.monto'])
            ->map(fn ($g) => [
                'fecha' => $soloFecha($g->fecha),
                'tipo' => 'gasto',
                'descripcion' => trim((string) $g->descripcion) !== ''
                    ? $g->descripcion
                    : ('Gasto'.($g->recibio ? " · {$g->recibio}" : '')),
                'monto' => (float) $g->monto,
            ]);

        $repuestos = DB::table('cobros')
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->where('transacciones.vehiculo_id', $veh->id)
            ->where('transacciones.inactiva', false)
            ->whereBetween('transacciones.created_at', [$desde, $hasta])
            ->orderBy('transacciones.created_at')
            ->get([
                'transacciones.created_at as fecha',
                'transacciones.cantidad',
                'articulos.descripcion as articulo',
                'articulos.precio',
            ])
            ->map(fn ($r) => [
                'fecha' => $soloFecha($r->fecha),
                'tipo' => 'repuesto',
                'descripcion' => (int) $r->cantidad > 1
                    ? "{$r->articulo} ×{$r->cantidad}"
                    : $r->articulo,
                'monto' => round((float) $r->precio * (int) $r->cantidad, 2),
            ]);

        $egresos = $gastos->concat($repuestos)
            ->sortBy('fecha')
            ->values();

        $totalIngresos = round((float) $ingresos->sum('monto'), 2);
        $totalEgresos = round((float) $egresos->sum('monto'), 2);

        return Inertia::render('Resumen/Vehiculo', [
            'filtros' => $filtros,
            'vehiculo' => [
                'id' => $veh->id,
                'patente' => $veh->patente,
                'marca' => $veh->marca,
                'modelo' => $veh->modelo,
                'inversion' => $veh->inversion?->nombre,
                'empresa' => $veh->empresa?->nombre,
            ],
            'ingresos' => $ingresos->values(),
            'egresos' => $egresos,
            'totales' => [
                'ingresos' => $totalIngresos,
                'egresos' => $totalEgresos,
                'neto' => round($totalIngresos - $totalEgresos, 2),
            ],
        ]);
    }
}
