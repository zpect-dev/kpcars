<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\RecalcularSueldosAction;
use App\Models\CierreSueldo;
use App\Models\CierreSueldoPago;
use App\Models\CierreSueldoSocio;
use App\Models\Empresa;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CierreSueldoController extends Controller
{
    /**
     * Histórico de cierres de sueldo (eventos globales, cubren ambas empresas).
     */
    public function index(Request $request): Response
    {
        Gate::authorize('view-cierres-sueldo');

        $cierres = CierreSueldo::with('ejecutadoPor:id,name')
            ->withSum('pagos as total_pagado', 'monto')
            ->withSum('abonos as total_abonado', 'monto')
            ->orderByDesc('created_at')
            ->paginate(20)
            ->through(fn (CierreSueldo $c) => [
                'id' => $c->id,
                'fecha' => $c->created_at?->toIso8601String(),
                'tasa' => (float) $c->tasa,
                'ejecutado_por' => $c->ejecutadoPor,
                'total_pagado' => (float) ($c->total_pagado ?? 0),
                'total_abonado' => (float) ($c->total_abonado ?? 0),
            ]);

        return Inertia::render('CierresSueldo/Index', [
            'cierres' => $cierres,
        ]);
    }

    /**
     * Detalle del cierre: desglose por empresa → inversión → socio, más los
     * abonos de deuda registrados en el modal.
     */
    public function show(Request $request, CierreSueldo $cierreSueldo): Response
    {
        Gate::authorize('view-cierres-sueldo');

        // Los eager-loads de Inversion bypassean TenantScope: el cierre es
        // global y muestra las inversiones de ambas empresas.
        $cierreSueldo->load([
            'ejecutadoPor:id,name',
            'cierresRecaudacion:id,empresa_id,cierre_sueldo_id',
            'pagos.user:id,name,dni',
            'pagos.inversion' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)
                ->select('id', 'nombre'),
            'abonos.user:id,name,dni',
            'abonos.inversion' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)
                ->select('id', 'nombre', 'empresa_id'),
        ]);

        // Recaudado por inversión del período congelado por este cierre.
        $cierreRecIds = $cierreSueldo->cierresRecaudacion->pluck('id')->all();
        $recaudadoPorInversion = empty($cierreRecIds) ? collect() : DB::table('recaudaciones')
            ->whereIn('recaudaciones.cierre_id', $cierreRecIds)
            ->join('vehiculos', 'recaudaciones.vehiculo_id', '=', 'vehiculos.id')
            ->join('inversiones', 'vehiculos.inversion_id', '=', 'inversiones.id')
            ->groupBy('vehiculos.inversion_id', 'inversiones.nombre', 'inversiones.empresa_id')
            ->selectRaw('vehiculos.inversion_id as inversion_id, inversiones.nombre as nombre, inversiones.empresa_id as empresa_id, SUM(recaudaciones.total) as total')
            ->get();

        // Desglose por empresa.
        $empresas = Empresa::orderBy('id')->get()->map(function (Empresa $empresa) use ($cierreSueldo, $recaudadoPorInversion) {
            $pagosEmpresa = $cierreSueldo->pagos->where('empresa_id', $empresa->id);

            $porInversor = $pagosEmpresa
                ->groupBy('user_id')
                ->map(function ($pagos) {
                    $user = $pagos->first()->user;

                    return [
                        'user' => [
                            'id' => $user->id,
                            'name' => $user->name,
                            'dni' => $user->dni,
                        ],
                        'total' => (float) $pagos->sum(fn (CierreSueldoPago $p) => (float) $p->monto),
                        'detalles' => $pagos
                            ->map(fn (CierreSueldoPago $p) => [
                                'inversion' => $p->inversion?->nombre,
                                'concepto' => $p->concepto,
                                'monto' => (float) $p->monto,
                            ])
                            ->sortBy(fn ($d) => (string) $d['inversion'], SORT_NATURAL | SORT_FLAG_CASE)
                            ->values(),
                    ];
                })
                ->sortBy(fn ($row) => mb_strtolower($row['user']['name']))
                ->values();

            $recaudaciones = $recaudadoPorInversion
                ->where('empresa_id', $empresa->id)
                ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->map(fn ($r) => [
                    'inversion' => $r->nombre,
                    'monto' => (float) $r->total,
                ]);

            return [
                'id' => $empresa->id,
                'nombre' => $empresa->nombre,
                'recaudado' => (float) $recaudaciones->sum('monto'),
                'distribuido' => (float) $porInversor->sum('total'),
                'recaudaciones' => $recaudaciones,
                'porInversor' => $porInversor,
            ];
        })->values();

        // Total consolidado por socio (suma de ambas empresas).
        $porSocio = $cierreSueldo->pagos
            ->groupBy('user_id')
            ->map(function ($pagos) {
                $user = $pagos->first()->user;

                return [
                    'user' => ['id' => $user->id, 'name' => $user->name, 'dni' => $user->dni],
                    'total' => (float) $pagos->sum(fn (CierreSueldoPago $p) => (float) $p->monto),
                ];
            })
            ->sortBy(fn ($row) => mb_strtolower($row['user']['name']))
            ->values();

        $abonos = $cierreSueldo->abonos
            ->map(fn ($a) => [
                'user' => ['id' => $a->user->id, 'name' => $a->user->name],
                'inversion' => $a->inversion?->nombre,
                'empresa_id' => $a->inversion?->empresa_id,
                'monto' => (float) $a->monto,
            ])
            ->sortBy(fn ($a) => mb_strtolower($a['user']['name']))
            ->values();

        // Sueldo generado por socio (para el default del abono en la UI).
        $sueldoPorSocio = $cierreSueldo->pagos
            ->groupBy('user_id')
            ->map(fn ($pagos) => (float) $pagos->sum(fn (CierreSueldoPago $p) => (float) $p->monto));

        // Decisiones editables por socio deudor (abona / no abona + abono).
        $socios = $cierreSueldo->socios()->with('user:id,name,dni')->get()
            ->map(fn (CierreSueldoSocio $s) => [
                'user' => ['id' => $s->user->id, 'name' => $s->user->name, 'dni' => $s->user->dni],
                'abona' => $s->abona,
                'abono_monto' => (float) $s->abono_monto,
                'sueldo_generado' => (float) ($sueldoPorSocio[$s->user_id] ?? 0),
            ])
            ->sortBy(fn ($s) => mb_strtolower($s['user']['name']))
            ->values();

        return Inertia::render('CierresSueldo/Show', [
            'cierre' => [
                'id' => $cierreSueldo->id,
                'fecha' => $cierreSueldo->created_at?->toIso8601String(),
                'tasa' => (float) $cierreSueldo->tasa,
                'ejecutado_por' => $cierreSueldo->ejecutadoPor,
            ],
            'empresas' => $empresas,
            'porSocio' => $porSocio,
            'socios' => $socios,
            'abonos' => $abonos,
            'puedeEditar' => Gate::allows('manage-cierres-sueldo'),
            'totales' => [
                'recaudado' => (float) $empresas->sum('recaudado'),
                'distribuido' => (float) $empresas->sum('distribuido'),
                'abonado' => (float) $abonos->sum('monto'),
            ],
        ]);
    }

    /**
     * Actualiza la decisión de un socio deudor (abona / no abona + monto del
     * abono) y recalcula el cierre en vivo.
     */
    public function updateSocio(Request $request, CierreSueldo $cierreSueldo, User $user, RecalcularSueldosAction $recalc): RedirectResponse
    {
        Gate::authorize('manage-cierres-sueldo');

        $validated = $request->validate([
            'abona' => ['required', 'boolean'],
            'abono_monto' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
        ]);

        $socio = CierreSueldoSocio::where('cierre_sueldo_id', $cierreSueldo->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $socio->update([
            'abona' => $validated['abona'],
            'abono_monto' => $validated['abona'] ? (float) ($validated['abono_monto'] ?? 0) : 0,
        ]);

        $recalc->execute($cierreSueldo);

        return redirect()->back()->with('success', 'Cierre recalculado.');
    }
}
