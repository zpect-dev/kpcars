<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateGastoAction;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class GastoController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Gasto::class);

        // Vista GLOBAL: ignora la empresa activa para mostrar en simultáneo los
        // totales de todas las empresas. Cada gasto de vehículo se considera
        // pendiente contra el cierre de su propia empresa (scopePendientesGlobal).
        $gastosColl = Gasto::query()
            ->withoutGlobalScope(GastoTenantScope::class)
            ->pendientesGlobal()
            ->with([
                'user:id,name',
                // Vehículo e inversión son globales aquí: hay que ignorar el
                // TenantScope para no perder los de otras empresas.
                'vehiculo' => fn ($q) => $q
                    ->withoutGlobalScope(TenantScope::class)
                    ->select('id', 'patente', 'marca', 'modelo', 'inversion_id', 'empresa_id'),
                'vehiculo.inversion' => fn ($q) => $q
                    ->withoutGlobalScope(TenantScope::class)
                    ->select('id', 'nombre'),
                'distribuciones.user:id,name',
            ])
            ->latest('fecha')
            ->latest('id')
            ->get();

        $mapGasto = fn (Gasto $g) => [
            'id' => $g->id,
            'fecha' => $g->fecha?->format('Y-m-d'),
            'monto' => (float) $g->monto,
            'recibio' => $g->recibio,
            'metodo_pago' => $g->metodo_pago,
            'descripcion' => $g->descripcion,
            'tipo' => $g->tipo,
            'vehiculo' => $g->vehiculo
                ? [
                    'id' => $g->vehiculo->id,
                    'patente' => $g->vehiculo->patente,
                    'marca' => $g->vehiculo->marca,
                    'modelo' => $g->vehiculo->modelo,
                    'inversion_id' => $g->vehiculo->inversion_id,
                    'inversion_nombre' => $g->vehiculo->inversion?->nombre,
                ]
                : null,
            'registrado_por' => $g->user?->name,
            'distribuciones' => $g->distribuciones->map(fn ($d) => [
                'user_id' => $d->user_id,
                'user_name' => $d->user?->name,
                'monto' => (float) $d->monto,
            ])->values(),
            'mi_monto' => null,
        ];

        $gastos = $gastosColl->map($mapGasto)->values();

        // Sección 1: 5 cards de totales del período pendiente.
        $empresas = Empresa::orderBy('id')->get(['id', 'nombre']);

        $cards = $empresas->map(fn (Empresa $emp) => [
            'key' => 'empresa_'.$emp->id,
            'label' => $emp->nombre,
            'total' => (float) $gastosColl
                ->filter(fn (Gasto $g) => $g->tipo === 'vehiculo' && $g->vehiculo?->empresa_id === $emp->id)
                ->sum(fn (Gasto $g) => (float) $g->monto),
        ])->values()->all();

        $cards[] = [
            'key' => 'kevin',
            'label' => 'Kevin',
            'total' => (float) $gastosColl->whereIn('tipo', ['kevin', 'stock'])->sum(fn (Gasto $g) => (float) $g->monto),
        ];
        $cards[] = [
            'key' => 'galpon',
            'label' => 'Galpón',
            'total' => (float) $gastosColl->whereIn('tipo', ['galpon', 'taller', 'oficina'])->sum(fn (Gasto $g) => (float) $g->monto),
        ];
        $cards[] = [
            'key' => 'general',
            'label' => 'Total general',
            'total' => (float) $gastosColl->sum(fn (Gasto $g) => (float) $g->monto),
        ];

        // Sección 2: últimos 10 gastos (de todas las empresas).
        $ultimosGlobales = $gastos->take(10)->values();

        // Combobox del alta: patentes de TODAS las empresas (global).
        $patentes = Vehiculo::query()
            ->withoutGlobalScope(TenantScope::class)
            ->select('id', 'patente', 'marca', 'modelo')
            ->orderBy('patente')
            ->get();

        return Inertia::render('Gastos/Index', [
            'gastos' => $gastos,
            'ultimosGlobales' => $ultimosGlobales,
            'cards' => $cards,
            'patentes' => $patentes,
            'canManage' => $request->user()->isAdmin(),
        ]);
    }

    public function store(Request $request, CreateGastoAction $action): RedirectResponse
    {
        $this->authorize('create', Gasto::class);

        $validated = $request->validate([
            'fecha' => ['required', 'date'],
            'monto' => ['required', 'numeric', 'min:0.01'],
            'recibio' => ['required', 'string', 'max:255'],
            'metodo_pago' => ['required', Rule::in(['efectivo', 'transferencia'])],
            'descripcion' => ['nullable', 'string'],
            'tipo' => ['required', Rule::in(['galpon', 'taller', 'oficina', 'kevin', 'stock', 'vehiculo'])],
            'vehiculo_id' => ['nullable', 'integer', 'exists:vehiculos,id', 'required_if:tipo,vehiculo'],
        ]);

        $action->execute([
            ...$validated,
            'user_id' => $request->user()->id,
            'vehiculo_id' => $validated['tipo'] === 'vehiculo' ? $validated['vehiculo_id'] : null,
        ]);

        return back()->with('success', 'Gasto registrado correctamente.');
    }

    public function destroy(Request $request, Gasto $gasto): RedirectResponse
    {
        $this->authorize('delete', $gasto);

        $gasto->delete();

        return back()->with('success', 'Gasto eliminado correctamente.');
    }
}
