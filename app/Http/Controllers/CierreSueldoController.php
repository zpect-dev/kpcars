<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\RecalcularSueldosAction;
use App\Enums\UserRole;
use App\Models\CierreSueldo;
use App\Models\CierreSueldoPago;
use App\Models\CierreSueldoParticipacion;
use App\Models\CierreSueldoSocio;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
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

        $composicion = $this->buildComposicion($cierreSueldo, $recaudadoPorInversion);

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
            'composicion' => $composicion,
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

    /**
     * Composición editable del cierre: por empresa → inversión, sus socios (con
     * saldo y financiador) más los candidatos que se pueden sumar (inversores de
     * la empresa que aún no participan en esa inversión).
     *
     * @param  Collection<int, object>  $recaudadoPorInversion
     * @return array<int, array<string, mixed>>
     */
    private function buildComposicion(CierreSueldo $cierreSueldo, $recaudadoPorInversion): array
    {
        $participaciones = $cierreSueldo->participaciones()
            ->with('user:id,name,dni')
            ->get();

        $inversionIds = $participaciones->pluck('inversion_id')->unique()->all();

        // Nombre y empresa de cada inversión del cierre (cross-empresa).
        $inversiones = Inversion::withoutGlobalScope(TenantScope::class)
            ->whereIn('id', $inversionIds)
            ->get(['id', 'nombre', 'empresa_id'])
            ->keyBy('id');

        $recaudadoPorInv = $recaudadoPorInversion->keyBy('inversion_id');

        // Pool de inversores por empresa para los candidatos a sumar.
        $empresaIds = $inversiones->pluck('empresa_id')->unique()->all();
        $inversoresPorEmpresa = [];
        if ($empresaIds !== []) {
            User::query()
                ->where('role', UserRole::INVERSOR)
                ->where('inactivo', false)
                ->whereHas('empresas', fn ($q) => $q->whereIn('empresas.id', $empresaIds))
                ->with('empresas:id')
                ->get(['id', 'name', 'dni'])
                ->each(function (User $u) use (&$inversoresPorEmpresa) {
                    foreach ($u->empresas as $e) {
                        $inversoresPorEmpresa[$e->id][] = $u;
                    }
                });
        }

        return Empresa::whereIn('id', $empresaIds)
            ->orderBy('id')
            ->get(['id', 'nombre'])
            ->map(function (Empresa $empresa) use ($participaciones, $inversiones, $recaudadoPorInv, $inversoresPorEmpresa) {
                $invsEmpresa = $inversiones->where('empresa_id', $empresa->id)
                    ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE);

                return [
                    'id' => $empresa->id,
                    'nombre' => $empresa->nombre,
                    'inversiones' => $invsEmpresa->map(function (Inversion $inv) use ($participaciones, $recaudadoPorInv, $inversoresPorEmpresa) {
                        $socios = $participaciones->where('inversion_id', $inv->id)
                            ->sortBy(fn (CierreSueldoParticipacion $p) => mb_strtolower($p->user?->name ?? ''))
                            ->values();

                        $sociosIds = $socios->pluck('user_id')->all();

                        $candidatos = collect($inversoresPorEmpresa[$inv->empresa_id] ?? [])
                            ->reject(fn (User $u) => in_array($u->id, $sociosIds, true))
                            ->sortBy(fn (User $u) => mb_strtolower($u->name))
                            ->values()
                            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'dni' => $u->dni]);

                        return [
                            'id' => $inv->id,
                            'nombre' => $inv->nombre,
                            'recaudado' => (float) ($recaudadoPorInv->get($inv->id)?->total ?? 0),
                            'socios' => $socios->map(fn (CierreSueldoParticipacion $p) => [
                                'user' => [
                                    'id' => $p->user->id,
                                    'name' => $p->user->name,
                                    'dni' => $p->user->dni,
                                ],
                                'saldo' => (float) $p->saldo,
                                'es_financiador' => (bool) $p->es_financiador,
                            ])->values(),
                            'candidatos' => $candidatos,
                        ];
                    })->values(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Configura a un socio dentro de una inversión del cierre: pertenencia,
     * deuda y si es financiador. Muta TANTO la foto del cierre (participaciones)
     * como el registro real (inversion_user), revierte los abonos vigentes para
     * que la deuda tipeada sea la base, y recalcula el sueldo en vivo.
     */
    public function updateComposicion(
        Request $request,
        CierreSueldo $cierreSueldo,
        int $inversion,
        User $user,
        RecalcularSueldosAction $recalc,
    ): RedirectResponse {
        Gate::authorize('manage-cierres-sueldo');

        $validated = $request->validate([
            'pertenece' => ['required', 'boolean'],
            'saldo' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'es_financiador' => ['required', 'boolean'],
        ]);

        $inv = Inversion::withoutGlobalScope(TenantScope::class)
            ->with('inversores:id')
            ->findOrFail($inversion);

        $saldo = round((float) ($validated['saldo'] ?? 0), 2);
        $yaEsta = $inv->inversores->contains('id', $user->id);

        // Tope de inversores por inversión (sólo al sumar uno nuevo).
        if ($validated['pertenece'] && ! $yaEsta
            && $inv->inversores->count() >= Inversion::MAX_INVERSORES) {
            throw ValidationException::withMessages([
                'pertenece' => "La inversión \"{$inv->nombre}\" ya tiene el máximo de ".Inversion::MAX_INVERSORES.' inversores.',
            ]);
        }

        DB::transaction(function () use ($cierreSueldo, $inv, $user, $validated, $saldo, $recalc) {
            // Restaurar la deuda viva a su base antes de tocar montos.
            $recalc->revertirAbonos($cierreSueldo);

            if ($validated['pertenece']) {
                $inv->inversores()->syncWithoutDetaching([
                    $user->id => [
                        'deuda' => $saldo,
                        'es_financiador' => $validated['es_financiador'],
                    ],
                ]);

                CierreSueldoParticipacion::updateOrCreate(
                    [
                        'cierre_sueldo_id' => $cierreSueldo->id,
                        'inversion_id' => $inv->id,
                        'user_id' => $user->id,
                    ],
                    [
                        'empresa_id' => $inv->empresa_id,
                        'saldo' => $saldo,
                        'es_financiador' => $validated['es_financiador'],
                    ],
                );
            } else {
                $inv->inversores()->detach($user->id);

                CierreSueldoParticipacion::where('cierre_sueldo_id', $cierreSueldo->id)
                    ->where('inversion_id', $inv->id)
                    ->where('user_id', $user->id)
                    ->delete();
            }

            // La fila de decisión (abona/monto) existe sólo mientras el socio sea
            // deudor en alguna inversión del cierre.
            $esDeudor = CierreSueldoParticipacion::where('cierre_sueldo_id', $cierreSueldo->id)
                ->where('user_id', $user->id)
                ->where('saldo', '>', 0)
                ->exists();

            if ($esDeudor) {
                CierreSueldoSocio::firstOrCreate(
                    ['cierre_sueldo_id' => $cierreSueldo->id, 'user_id' => $user->id],
                    ['abona' => true, 'abono_monto' => 0],
                );
            } else {
                CierreSueldoSocio::where('cierre_sueldo_id', $cierreSueldo->id)
                    ->where('user_id', $user->id)
                    ->delete();
            }

            $recalc->execute($cierreSueldo->fresh());
        });

        return redirect()->back()->with('success', 'Composición actualizada y cierre recalculado.');
    }
}
