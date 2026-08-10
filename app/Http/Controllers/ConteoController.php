<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessConteoAction;
use App\Models\Articulo;
use App\Models\Conteo;
use App\Models\ConteoLinea;
use App\Models\Scopes\TenantScope;
use App\Models\Transaccion;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class ConteoController extends Controller
{
    /**
     * Pantalla de conteo. NO envía el stock esperado (conteo a ciegas): sólo la
     * lista de artículos por zona y el historial de conteos recientes.
     */
    public function index(): Response
    {
        $this->authorize('viewAny', Conteo::class);

        // Inventario es global (sin TenantScope). Se omite `stock` a propósito.
        $articulos = Articulo::orderBy('descripcion')
            ->get(['id', 'codigo', 'descripcion', 'repuestos', 'min_stock']);

        return Inertia::render('Conteo/Index', [
            'items' => $articulos,
            'motivos' => ConteoLinea::MOTIVO_LABELS,
            'historial' => $this->historial(),
        ]);
    }

    /**
     * Calcula esperado y diferencia por línea SIN aplicar nada (solo lectura).
     * Se ejecuta después de cargar el físico, para revelar las diferencias.
     */
    public function preview(Request $request): Response
    {
        $this->authorize('viewAny', Conteo::class);

        $validated = $request->validate([
            'zona' => ['required', Rule::in(Conteo::ZONAS)],
            'lineas' => ['required', 'array', 'min:1'],
            'lineas.*.articulo_id' => ['required', 'integer', 'exists:articulos,id'],
            'lineas.*.fisico' => ['required', 'integer', 'min:0'],
        ]);

        $articulos = Articulo::whereIn('id', collect($validated['lineas'])->pluck('articulo_id'))
            ->get(['id', 'descripcion', 'stock'])
            ->keyBy('id');

        $preview = collect($validated['lineas'])->map(function (array $linea) use ($articulos) {
            $articulo = $articulos->get((int) $linea['articulo_id']);
            $esperado = (int) $articulo->stock;
            $fisico = (int) $linea['fisico'];

            return [
                'articulo_id' => $articulo->id,
                'descripcion' => $articulo->descripcion,
                'esperado' => $esperado,
                'fisico' => $fisico,
                'diferencia' => $fisico - $esperado,
            ];
        })->values();

        return Inertia::render('Conteo/Index', [
            'items' => Articulo::orderBy('descripcion')->get(['id', 'codigo', 'descripcion', 'repuestos', 'min_stock']),
            'motivos' => ConteoLinea::MOTIVO_LABELS,
            'historial' => $this->historial(),
            'preview' => [
                'zona' => $validated['zona'],
                'lineas' => $preview,
            ],
        ]);
    }

    /**
     * Confirma el conteo: aplica los ajustes de stock de forma atómica.
     */
    public function store(Request $request, ProcessConteoAction $action): RedirectResponse
    {
        $this->authorize('create', Conteo::class);

        $validated = $request->validate([
            'zona' => ['required', Rule::in(Conteo::ZONAS)],
            'observaciones' => ['nullable', 'string', 'max:1000'],
            'lineas' => ['required', 'array', 'min:1'],
            'lineas.*.articulo_id' => ['required', 'integer', 'exists:articulos,id'],
            'lineas.*.fisico' => ['required', 'integer', 'min:0'],
            'lineas.*.motivo' => ['nullable', Rule::in(ConteoLinea::MOTIVOS)],
            'lineas.*.nota' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $conteo = $action->execute(
                $validated['lineas'],
                $validated['zona'],
                $validated['observaciones'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return redirect()->back()->withErrors(['lineas' => $e->getMessage()]);
        } catch (Exception $e) {
            return redirect()->back()->withErrors(['lineas' => $e->getMessage()]);
        }

        $ajustes = $conteo->lineas->where('diferencia', '!=', 0)->count();

        return redirect()->route('conteos.index')->with(
            'success',
            $ajustes === 0
                ? 'Conteo registrado: sin diferencias.'
                : "Conteo registrado: {$ajustes} ajuste(s) aplicado(s).",
        );
    }

    /**
     * Movimientos recientes de un artículo, para el panel de investigación de
     * una diferencia. Muestra IN/OUT/AJUSTE con vehículo (global) y usuario.
     */
    public function movimientos(Articulo $articulo): JsonResponse
    {
        $this->authorize('viewAny', Conteo::class);

        $movimientos = Transaccion::withoutGlobalScope('activa')
            ->with([
                'vehiculo' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)->select('id', 'patente', 'marca', 'modelo'),
                'user:id,name',
            ])
            ->where('articulo_id', $articulo->id)
            ->latest()
            ->limit(15)
            ->get(['id', 'tipo', 'cantidad', 'vehiculo_id', 'user_id', 'solicitante', 'descripcion', 'inactiva', 'created_at']);

        return response()->json([
            'articulo' => $articulo->only(['id', 'descripcion', 'codigo']),
            'movimientos' => $movimientos,
        ]);
    }

    /**
     * Últimos conteos con su resumen de diferencias (para el historial en la vista).
     */
    private function historial(): \Illuminate\Support\Collection
    {
        return Conteo::with('user:id,name')
            ->withCount([
                'lineas',
                'lineas as ajustes_count' => fn ($q) => $q->where('diferencia', '!=', 0),
            ])
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (Conteo $c) => [
                'id' => $c->id,
                'zona' => $c->zona,
                'user' => $c->user?->only(['id', 'name']),
                'lineas_count' => $c->lineas_count,
                'ajustes_count' => $c->ajustes_count,
                'created_at' => $c->created_at?->toISOString(),
            ]);
    }
}
