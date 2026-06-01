<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessCierreGastoAction;
use App\Models\CierreGasto;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class CierreGastoController extends Controller
{
    /**
     * Listado de cierres de gastos realizados.
     */
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', CierreGasto::class);

        $cierres = CierreGasto::with('user:id,name')
            ->withCount('detalles')
            ->orderByDesc('periodo_fin')
            ->paginate(20)
            ->through(fn (CierreGasto $c) => [
                'id' => $c->id,
                'periodo_inicio' => $c->periodo_inicio?->toIso8601String(),
                'periodo_fin' => $c->periodo_fin?->toIso8601String(),
                'total_general' => (float) $c->total_general,
                'detalles_count' => $c->detalles_count,
                'ejecutado_por' => $c->user?->name,
                'created_at' => $c->created_at?->toIso8601String(),
            ]);

        return Inertia::render('CierresGasto/Index', [
            'cierres' => $cierres,
        ]);
    }

    /**
     * Ejecuta el cierre del período actual de gastos.
     */
    public function store(Request $request, ProcessCierreGastoAction $action): RedirectResponse
    {
        $this->authorize('create', CierreGasto::class);

        try {
            $cierre = $action->execute($request->user());
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return redirect()->route('cierres-gasto.show', $cierre->id)
            ->with('success', 'Cierre de gastos ejecutado correctamente.');
    }

    /**
     * Detalle de un cierre con el desglose por tipo y por patente.
     */
    public function show(Request $request, CierreGasto $cierreGasto): Response
    {
        $this->authorize('view', $cierreGasto);

        $cierreGasto->load(['user:id,name', 'detalles']);

        $porTipo = $cierreGasto->detalles
            ->where('tipo', '!=', 'vehiculo')
            ->sortBy('tipo')
            ->values()
            ->map(fn ($d) => [
                'tipo' => $d->tipo,
                'total' => (float) $d->total,
            ]);

        $porVehiculo = $cierreGasto->detalles
            ->where('tipo', 'vehiculo')
            ->sortBy('patente', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->map(fn ($d) => [
                'patente' => $d->patente ?? '—',
                'total' => (float) $d->total,
            ]);

        return Inertia::render('CierresGasto/Show', [
            'cierre' => [
                'id' => $cierreGasto->id,
                'periodo_inicio' => $cierreGasto->periodo_inicio?->toIso8601String(),
                'periodo_fin' => $cierreGasto->periodo_fin?->toIso8601String(),
                'total_general' => (float) $cierreGasto->total_general,
                'ejecutado_por' => $cierreGasto->user?->name,
                'created_at' => $cierreGasto->created_at?->toIso8601String(),
            ],
            'porTipo' => $porTipo,
            'porVehiculo' => $porVehiculo,
        ]);
    }
}
