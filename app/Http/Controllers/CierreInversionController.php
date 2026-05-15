<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessCierreInversionAction;
use App\Models\CierreInversion;
use App\Models\Inversion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class CierreInversionController extends Controller
{
    /**
     * Listado de cierres realizados.
     */
    public function index(Request $request): Response
    {
        abort_unless($request->user()->isAdmin(), 403);

        $cierres = CierreInversion::with('ejecutadoPor:id,name')
            ->orderByDesc('periodo_fin')
            ->paginate(20);

        return Inertia::render('CierresInversion/Index', [
            'cierres' => $cierres,
        ]);
    }

    /**
     * Formulario para preparar un nuevo cierre con la recaudación de cada inversión.
     */
    public function create(Request $request): Response
    {
        abort_unless($request->user()->isAdmin(), 403);

        $inversiones = Inversion::with([
            'inversores:id,name',
        ])->orderBy('nombre')->get()->map(function (Inversion $inv) {
            $deudores = $inv->inversores->filter(fn ($u) => (bool) $u->pivot->tiene_deuda)->count();
            $financiadores = $inv->inversores->filter(fn ($u) => (bool) $u->pivot->es_financiador)->count();

            return [
                'id' => $inv->id,
                'nombre' => $inv->nombre,
                'inversores_count' => $inv->inversores->count(),
                'deudores' => $deudores,
                'financiadores' => $financiadores,
                'puede_procesar' => $inv->inversores->count() === Inversion::MAX_INVERSORES
                    && ($deudores === 0 || $financiadores > 0),
            ];
        });

        $ultimoCierre = CierreInversion::latest('periodo_fin')->first();

        return Inertia::render('CierresInversion/Create', [
            'inversiones' => $inversiones,
            'ultimoCierre' => $ultimoCierre ? [
                'id' => $ultimoCierre->id,
                'periodo_fin' => $ultimoCierre->periodo_fin?->toIso8601String(),
            ] : null,
            'maxInversores' => Inversion::MAX_INVERSORES,
        ]);
    }

    /**
     * Ejecuta el cierre.
     */
    public function store(Request $request, ProcessCierreInversionAction $action): RedirectResponse
    {
        abort_unless($request->user()->isAdmin(), 403);

        $validated = $request->validate([
            'recaudaciones' => ['required', 'array'],
            'recaudaciones.*' => ['required', 'numeric', 'min:0', 'max:999999999.99'],
            'tasa' => ['required', 'numeric', 'min:0.0001', 'max:9999999.9999'],
        ]);

        // Las llaves del array son inversion_id (strings vienen del form, las casteamos)
        $recaudaciones = [];
        foreach ($validated['recaudaciones'] as $invId => $monto) {
            $recaudaciones[(int) $invId] = (float) $monto;
        }

        try {
            $cierre = $action->execute($recaudaciones, $request->user(), (float) $validated['tasa']);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage())->withInput();
        }

        return redirect()->route('cierres-inversion.show', $cierre->id)
            ->with('success', 'Cierre ejecutado correctamente.');
    }

    /**
     * Detalle del cierre con desglose por inversor.
     */
    public function show(Request $request, CierreInversion $cierreInversion): Response
    {
        abort_unless($request->user()->isAdmin(), 403);

        $cierreInversion->load([
            'ejecutadoPor:id,name',
            'recaudaciones.inversion:id,nombre',
            'pagos.user:id,name,dni',
            'pagos.inversion:id,nombre',
        ]);

        // Agrupar pagos por usuario para mostrar "sueldo" total por inversor
        $porInversor = $cierreInversion->pagos
            ->groupBy('user_id')
            ->map(function ($pagos) {
                $user = $pagos->first()->user;

                return [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'dni' => $user->dni,
                    ],
                    'total' => (float) $pagos->sum(fn ($p) => (float) $p->monto),
                    'detalles' => $pagos->map(fn ($p) => [
                        'inversion' => $p->inversion?->nombre,
                        'concepto' => $p->concepto,
                        'monto' => (float) $p->monto,
                    ])->values(),
                ];
            })
            ->sortByDesc('total')
            ->values();

        return Inertia::render('CierresInversion/Show', [
            'cierre' => [
                'id' => $cierreInversion->id,
                'periodo_inicio' => $cierreInversion->periodo_inicio?->toIso8601String(),
                'periodo_fin' => $cierreInversion->periodo_fin?->toIso8601String(),
                'total_recaudado' => (float) $cierreInversion->total_recaudado,
                'tasa' => $cierreInversion->tasa ? (float) $cierreInversion->tasa : null,
                'total_distribuido' => (float) $cierreInversion->total_distribuido,
                'ejecutado_por' => $cierreInversion->ejecutadoPor,
                'created_at' => $cierreInversion->created_at?->toIso8601String(),
            ],
            'recaudaciones' => $cierreInversion->recaudaciones->map(fn ($r) => [
                'inversion' => $r->inversion?->nombre,
                'monto' => (float) $r->monto,
            ]),
            'porInversor' => $porInversor,
        ]);
    }
}
