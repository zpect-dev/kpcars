<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateGastoAction;
use App\Models\AperturaCaja;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class GastoController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Gasto::class);

        // Vista GLOBAL: ignora la empresa activa para mostrar en simultáneo los
        // totales de todas las empresas. Pendiente = gasto aún sin cierre.
        $gastosColl = Gasto::query()
            ->withoutGlobalScope(GastoTenantScope::class)
            ->pendientes()
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
            ])
            ->latest('fecha')
            ->latest('id')
            ->get();

        // Nombres de los inversores presentes en los repartos (un solo query).
        $userIds = $gastosColl
            ->flatMap(fn (Gasto $g) => array_keys($g->distribucion ?? []))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->all();
        $nombres = $userIds === []
            ? collect()
            : User::whereIn('id', $userIds)->pluck('name', 'id');

        $mapDistribucion = fn (?array $dist) => collect($dist ?? [])
            ->map(fn ($monto, $userId) => [
                'user_id' => (int) $userId,
                'user_name' => $nombres[(int) $userId] ?? null,
                'monto' => (float) $monto,
            ])
            ->values();

        // Empresas (id => nombre) para los cards y el reparto por empresa.
        $empresas = Empresa::orderBy('id')->get(['id', 'nombre']);
        $empresaNombres = $empresas->pluck('nombre', 'id');

        $mapDistribucionEmpresas = fn (?array $dist) => collect($dist ?? [])
            ->map(fn ($monto, $empresaId) => [
                'empresa_id' => (int) $empresaId,
                'empresa_nombre' => $empresaNombres[(int) $empresaId] ?? null,
                'monto' => (float) $monto,
            ])
            ->values();

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
            'distribuciones' => $mapDistribucion($g->distribucion),
            'distribuciones_empresas' => $mapDistribucionEmpresas($g->distribucion_empresas),
            'mi_monto' => null,
        ];

        $gastos = $gastosColl->map($mapGasto)->values();

        // Sección 1: cards de totales del período pendiente. Cada empresa suma
        // sus gastos de flota (tipo vehículo) más la parte que le toca de los
        // gastos globales (galpón/taller/oficina), según el reparto por empresa.
        $cards = $empresas->map(function (Empresa $emp) use ($gastosColl) {
            $flota = (float) $gastosColl
                ->filter(fn (Gasto $g) => $g->tipo === 'vehiculo' && $g->vehiculo?->empresa_id === $emp->id)
                ->sum(fn (Gasto $g) => (float) $g->monto);

            $globales = (float) $gastosColl
                ->filter(fn (Gasto $g) => in_array($g->tipo, Gasto::TIPOS_GLOBALES, true))
                ->sum(fn (Gasto $g) => (float) (($g->distribucion_empresas ?? [])[$emp->id] ?? 0));

            return [
                'key' => 'empresa_'.$emp->id,
                'label' => $emp->nombre,
                'total' => $flota + $globales,
            ];
        })->values()->all();

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

        // Exigir un período de caja abierto para registrar el gasto. Un gasto de
        // vehículo pertenece a la empresa del vehículo; uno global, a la activa.
        $empresaGasto = $validated['tipo'] === 'vehiculo'
            ? Vehiculo::withoutGlobalScope(TenantScope::class)->find($validated['vehiculo_id'])?->empresa_id
            : (session('active_company_id') !== null ? (int) session('active_company_id') : null);

        if (! AperturaCaja::hayPeriodoAbierto($empresaGasto)) {
            throw ValidationException::withMessages([
                'tipo' => 'No hay un período de caja abierto para esta empresa. Abrí un período en Cobros antes de registrar el gasto.',
            ]);
        }

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
