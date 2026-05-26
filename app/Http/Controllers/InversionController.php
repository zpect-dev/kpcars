<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\CierreInversion;
use App\Models\CierreInversionPago;
use App\Models\CierreInversionRecaudacion;
use App\Models\DeudaMovimiento;
use App\Models\Inversion;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InversionController extends Controller
{
    /**
     * Panel admin: listado de inversiones con sus inversores y saldos de deuda.
     */
    public function index(Request $request): Response
    {
        abort_unless($request->user()->isAdminAbsoluto(), 403);

        // Saldos por inversion+user (cargos - pagos)
        $saldos = DeudaMovimiento::query()
            ->selectRaw("inversion_id, user_id, SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE -monto END) as saldo")
            ->groupBy('inversion_id', 'user_id')
            ->get()
            ->keyBy(fn ($r) => $r->inversion_id.':'.$r->user_id);

        // Recaudación de la última semana (último cierre) por inversion
        $ultimoCierre = CierreInversion::latest('periodo_fin')->first();
        $recaudacionUltimoCierre = $ultimoCierre
            ? CierreInversionRecaudacion::where('cierre_id', $ultimoCierre->id)
                ->pluck('monto', 'inversion_id')
            : collect();

        // Inversion auto-scopea por empresa activa vía TenantScope.
        $inversiones = Inversion::with(['empresa:id,nombre', 'inversores:id,name,dni'])
            ->get()
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->map(function (Inversion $inv) use ($saldos, $recaudacionUltimoCierre) {
                return [
                    'id' => $inv->id,
                    'nombre' => $inv->nombre,
                    'empresa' => $inv->empresa,
                    'recaudacion_semana_anterior' => (float) ($recaudacionUltimoCierre[$inv->id] ?? 0),
                    'inversores' => $inv->inversores->map(fn (User $u) => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'dni' => $u->dni,
                        'tiene_deuda' => (bool) $u->pivot->tiene_deuda,
                        'es_financiador' => (bool) $u->pivot->es_financiador,
                        'saldo_deuda' => (float) ($saldos[$inv->id.':'.$u->id]->saldo ?? 0),
                    ])->values(),
                ];
            });

        $inversoresDisponibles = User::where('role', UserRole::INVERSOR)
            ->where('inactivo', false)
            ->orderBy('name')
            ->get(['id', 'name', 'dni']);

        // Socios: todos los inversores activos con lo cobrado en el último cierre
        $pagosUltimoCierre = $ultimoCierre
            ? CierreInversionPago::where('cierre_id', $ultimoCierre->id)
                ->selectRaw('user_id, SUM(monto) as total')
                ->groupBy('user_id')
                ->pluck('total', 'user_id')
            : collect();

        $socios = $inversoresDisponibles->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name,
            'cobrado_ultimo_cierre' => (float) ($pagosUltimoCierre[$u->id] ?? 0),
        ])->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values();

        return Inertia::render('Inversiones/Index', [
            'inversiones' => $inversiones,
            'inversoresDisponibles' => $inversoresDisponibles,
            'socios' => $socios,
            'ultimoCierre' => $ultimoCierre ? [
                'id' => $ultimoCierre->id,
                'periodo_fin' => $ultimoCierre->periodo_fin?->toIso8601String(),
                'total_recaudado' => (float) $ultimoCierre->total_recaudado,
                'tasa' => $ultimoCierre->tasa ? (float) $ultimoCierre->tasa : null,
            ] : null,
            'maxInversores' => Inversion::MAX_INVERSORES,
        ]);
    }

    /**
     * Agregar un inversor a la inversión.
     */
    public function attachInversor(Request $request, Inversion $inversion): RedirectResponse
    {
        abort_unless($request->user()->isAdminAbsoluto(), 403);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'tiene_deuda' => ['boolean'],
            'es_financiador' => ['boolean'],
        ]);

        // No puede ser deudor y financiador a la vez
        if (! empty($validated['tiene_deuda']) && ! empty($validated['es_financiador'])) {
            return back()->with('error', 'Un inversor no puede ser deudor y financiador al mismo tiempo.');
        }

        $user = User::findOrFail($validated['user_id']);
        if ($user->role !== UserRole::INVERSOR) {
            return back()->with('error', 'El usuario seleccionado no tiene rol de inversor.');
        }

        DB::transaction(function () use ($inversion, $validated) {
            $count = $inversion->inversores()->lockForUpdate()->count();
            if ($count >= Inversion::MAX_INVERSORES) {
                throw new \RuntimeException('Máximo '.Inversion::MAX_INVERSORES.' inversores por inversión.');
            }

            if ($inversion->inversores()->where('user_id', $validated['user_id'])->exists()) {
                throw new \RuntimeException('El inversor ya está asignado a esta inversión.');
            }

            $inversion->inversores()->attach($validated['user_id'], [
                'tiene_deuda' => $validated['tiene_deuda'] ?? false,
                'es_financiador' => $validated['es_financiador'] ?? false,
            ]);
        });

        return back()->with('success', 'Inversor asignado correctamente.');
    }

    /**
     * Actualizar flags (deudor / financiador) de un inversor en la inversión.
     */
    public function updateInversor(Request $request, Inversion $inversion, User $user): RedirectResponse
    {
        abort_unless($request->user()->isAdminAbsoluto(), 403);

        $validated = $request->validate([
            'tiene_deuda' => ['required', 'boolean'],
            'es_financiador' => ['required', 'boolean'],
        ]);

        if ($validated['tiene_deuda'] && $validated['es_financiador']) {
            return back()->with('error', 'Un inversor no puede ser deudor y financiador al mismo tiempo.');
        }

        $inversion->inversores()->updateExistingPivot($user->id, $validated);

        return back()->with('success', 'Estado del inversor actualizado.');
    }

    /**
     * Quitar un inversor de una inversión.
     */
    public function detachInversor(Request $request, Inversion $inversion, User $user): RedirectResponse
    {
        abort_unless($request->user()->isAdminAbsoluto(), 403);

        $inversion->inversores()->detach($user->id);

        return back()->with('success', 'Inversor removido de la inversión.');
    }

    /**
     * Sincronizar masivamente los inversores de una inversión.
     *
     * Recibe el set completo deseado: cada item con user_id, tiene_deuda, es_financiador.
     * Calcula el diff y aplica attach / detach / update en una sola transacción.
     */
    public function syncInversores(Request $request, Inversion $inversion): RedirectResponse
    {
        abort_unless($request->user()->isAdminAbsoluto(), 403);

        $validated = $request->validate([
            'inversores' => ['present', 'array'],
            'inversores.*.user_id' => ['required', 'integer', 'distinct', 'exists:users,id'],
            'inversores.*.tiene_deuda' => ['required', 'boolean'],
            'inversores.*.es_financiador' => ['required', 'boolean'],
        ]);

        $items = collect($validated['inversores'] ?? []);

        // Validaciones de negocio
        if ($items->count() > Inversion::MAX_INVERSORES) {
            return back()->with('error', 'Máximo '.Inversion::MAX_INVERSORES.' inversores por inversión.');
        }

        $invalidFlags = $items->first(fn ($i) => $i['tiene_deuda'] && $i['es_financiador']);
        if ($invalidFlags) {
            return back()->with('error', 'Un inversor no puede ser deudor y financiador al mismo tiempo.');
        }

        $userIds = $items->pluck('user_id')->all();
        if (! empty($userIds)) {
            $invalidUsers = User::whereIn('id', $userIds)
                ->where('role', '!=', UserRole::INVERSOR)
                ->exists();
            if ($invalidUsers) {
                return back()->with('error', 'Uno o más usuarios seleccionados no tienen rol de inversor.');
            }
        }

        DB::transaction(function () use ($inversion, $items) {
            $sync = $items->mapWithKeys(fn ($i) => [
                (int) $i['user_id'] => [
                    'tiene_deuda' => (bool) $i['tiene_deuda'],
                    'es_financiador' => (bool) $i['es_financiador'],
                ],
            ])->toArray();

            $inversion->inversores()->sync($sync);
        });

        return back()->with('success', 'Inversores actualizados correctamente.');
    }

    /**
     * Ver historial de deuda de un inversor en una inversión.
     */
    public function showDeuda(Request $request, Inversion $inversion, User $user): Response
    {
        abort_unless($request->user()->isAdminAbsoluto(), 403);

        abort_unless($inversion->inversores()->where('user_id', $user->id)->exists(), 404);

        $movimientos = DeudaMovimiento::with('registradoPor:id,name')
            ->where('inversion_id', $inversion->id)
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        $saldo = (float) $movimientos->reduce(
            fn (float $carry, DeudaMovimiento $m) => $m->tipo === 'cargo'
                ? $carry + (float) $m->monto
                : $carry - (float) $m->monto,
            0.0,
        );

        $tasaActual = CierreInversion::latest('periodo_fin')->value('tasa');

        return Inertia::render('Inversiones/Deuda', [
            'inversion' => $inversion->only('id', 'nombre'),
            'user' => $user->only('id', 'name', 'dni'),
            'movimientos' => $movimientos,
            'saldo' => $saldo,
            'tasaActual' => $tasaActual ? (float) $tasaActual : null,
        ]);
    }

    /**
     * Aplicar un pago en cascada: se descuenta de la inversión más antigua primero
     * (orden natural por nombre) hasta agotar el monto, luego continúa con la siguiente.
     */
    public function pagoEnCascada(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->isAdminAbsoluto(), 403);

        $validated = $request->validate([
            'monto' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
        ]);

        $montoPendiente = (float) $validated['monto'];

        // Mismo orden que el cierre: LENGTH(nombre), nombre — garantiza ranking consistente
        $inversiones = Inversion::whereHas('inversores', fn ($q) =>
            $q->where('user_id', $user->id)->where('tiene_deuda', true)
        )->orderByRaw('LENGTH(nombre), nombre')->get();

        DB::transaction(function () use ($inversiones, $user, $montoPendiente, $request) {
            foreach ($inversiones as $inversion) {
                if ($montoPendiente <= 0) break;

                // Saldo actual de esta inversión para este usuario
                $saldo = (float) DeudaMovimiento::where('inversion_id', $inversion->id)
                    ->where('user_id', $user->id)
                    ->selectRaw("SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE -monto END) as saldo")
                    ->value('saldo') ?? 0.0;

                if ($saldo <= 0) continue;

                $aplicar = min($montoPendiente, $saldo);

                DeudaMovimiento::create([
                    'inversion_id' => $inversion->id,
                    'user_id'      => $user->id,
                    'tipo'         => 'pago',
                    'monto'        => $aplicar,
                    'descripcion'  => null,
                    'registrado_por' => $request->user()->id,
                ]);

                $montoPendiente -= $aplicar;
            }
        });

        return back()->with('success', 'Pago aplicado correctamente.');
    }

    /**
     * Registrar un nuevo movimiento de deuda (cargo o pago).
     */
    public function storeDeudaMovimiento(Request $request, Inversion $inversion, User $user): RedirectResponse
    {
        abort_unless($request->user()->isAdminAbsoluto(), 403);

        abort_unless($inversion->inversores()->where('user_id', $user->id)->exists(), 404);

        $validated = $request->validate([
            'tipo' => ['required', 'in:cargo,pago'],
            'monto' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'descripcion' => ['nullable', 'string', 'max:500'],
        ]);

        // Un pago no puede superar el saldo de deuda actual
        if ($validated['tipo'] === 'pago') {
            $saldo = (float) DeudaMovimiento::where('inversion_id', $inversion->id)
                ->where('user_id', $user->id)
                ->selectRaw("SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE -monto END) as saldo")
                ->value('saldo') ?? 0.0;

            if ((float) $validated['monto'] > $saldo + 0.005) {
                return back()->withErrors(['monto' => 'El pago ($'.number_format($validated['monto'], 2).') supera el saldo adeudado ($'.number_format($saldo, 2).').']);
            }
        }

        DeudaMovimiento::create([
            'inversion_id' => $inversion->id,
            'user_id' => $user->id,
            'tipo' => $validated['tipo'],
            'monto' => $validated['monto'],
            'descripcion' => $validated['descripcion'] ?? null,
            'registrado_por' => $request->user()->id,
        ]);

        return back()->with('success', 'Movimiento registrado.');
    }
}
