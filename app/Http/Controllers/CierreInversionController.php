<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessCierreInversionAction;
use App\Models\CierreInversion;
use App\Models\CierreInversionPago;
use App\Models\Inversion;
use App\Models\User;
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
        $this->authorize('viewAny', CierreInversion::class);

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
        $this->authorize('create', CierreInversion::class);

        $inversiones = Inversion::with([
            'inversores:id,name',
        ])->get()
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->map(function (Inversion $inv) {
            $deudores = $inv->inversores->filter(fn ($u) => (bool) $u->pivot->tiene_deuda)->count();
            $financiadores = $inv->inversores->filter(fn ($u) => (bool) $u->pivot->es_financiador)->count();

            $count = $inv->inversores->count();

            return [
                'id' => $inv->id,
                'nombre' => $inv->nombre,
                'inversores_count' => $count,
                'deudores' => $deudores,
                'financiadores' => $financiadores,
                // El mínimo es 0 (se saltea). El máximo es MAX_INVERSORES.
                // Si hay deudores, debe haber al menos un financiador.
                'puede_procesar' => $count <= Inversion::MAX_INVERSORES
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
        $this->authorize('create', CierreInversion::class);

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
        $this->authorize('view', $cierreInversion);

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
            ->sortBy(fn ($row) => mb_strtolower($row['user']['name']))
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
            'recaudaciones' => $cierreInversion->recaudaciones
                ->sortBy(fn ($r) => (string) $r->inversion?->nombre, SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->map(fn ($r) => [
                    'inversion' => $r->inversion?->nombre,
                    'monto' => (float) $r->monto,
                ]),
            'porInversor' => $porInversor,
        ]);
    }

    /**
     * Detalle del sueldo de un inversor en un cierre puntual + histórico de pagos pasados.
     */
    public function showInversor(Request $request, CierreInversion $cierreInversion, User $user): Response
    {
        $this->authorize('view', $cierreInversion);

        // Pagos del cierre actual
        $pagosCierre = CierreInversionPago::with('inversion:id,nombre')
            ->where('cierre_id', $cierreInversion->id)
            ->where('user_id', $user->id)
            ->get();

        abort_if($pagosCierre->isEmpty(), 404);

        $detalleCierre = $pagosCierre
            ->map(fn (CierreInversionPago $p) => [
                'inversion' => $p->inversion?->nombre,
                'concepto' => $p->concepto,
                'monto' => (float) $p->monto,
            ])
            ->sortBy(fn ($d) => (string) $d['inversion'], SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $totalCierre = (float) $pagosCierre->sum(fn (CierreInversionPago $p) => (float) $p->monto);

        $totalCierreFinanciador = (float) $pagosCierre
            ->where('concepto', CierreInversionPago::CONCEPTO_REDISTRIBUCION)
            ->sum(fn (CierreInversionPago $p) => (float) $p->monto);

        $totalCierrePropio = $totalCierre - $totalCierreFinanciador;

        // Histórico: pagos del inversor en cierres anteriores (excluye el actual)
        $historico = CierreInversionPago::with(['cierre:id,periodo_inicio,periodo_fin,tasa', 'inversion:id,nombre'])
            ->where('user_id', $user->id)
            ->where('cierre_id', '!=', $cierreInversion->id)
            ->get()
            ->groupBy('cierre_id')
            ->map(function ($pagos) {
                $cierre = $pagos->first()->cierre;

                return [
                    'cierre' => [
                        'id' => $cierre->id,
                        'periodo_inicio' => $cierre->periodo_inicio?->toIso8601String(),
                        'periodo_fin' => $cierre->periodo_fin?->toIso8601String(),
                        'tasa' => $cierre->tasa ? (float) $cierre->tasa : null,
                    ],
                    'total' => (float) $pagos->sum(fn (CierreInversionPago $p) => (float) $p->monto),
                    'detalles' => $pagos
                        ->map(fn (CierreInversionPago $p) => [
                            'inversion' => $p->inversion?->nombre,
                            'concepto' => $p->concepto,
                            'monto' => (float) $p->monto,
                        ])
                        ->sortBy(fn ($d) => (string) $d['inversion'], SORT_NATURAL | SORT_FLAG_CASE)
                        ->values(),
                ];
            })
            ->sortByDesc(fn ($row) => $row['cierre']['periodo_fin'])
            ->values();

        return Inertia::render('CierresInversion/Inversor', [
            'cierre' => [
                'id' => $cierreInversion->id,
                'periodo_inicio' => $cierreInversion->periodo_inicio?->toIso8601String(),
                'periodo_fin' => $cierreInversion->periodo_fin?->toIso8601String(),
                'tasa' => $cierreInversion->tasa ? (float) $cierreInversion->tasa : null,
            ],
            'inversor' => [
                'id' => $user->id,
                'name' => $user->name,
                'dni' => $user->dni,
            ],
            'detalleCierre' => $detalleCierre,
            'totalCierre' => $totalCierre,
            'totalCierrePropio' => $totalCierrePropio,
            'totalCierreFinanciador' => $totalCierreFinanciador,
            'historico' => $historico,
            'totalHistorico' => (float) $historico->sum('total'),
        ]);
    }
}
