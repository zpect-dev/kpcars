<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateGastoAction;
use App\Models\Gasto;
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

        // El branch de inversor queda como código legado: la ruta sólo admite
        // role:administrador, así que isInversor siempre será false. Se elimina
        // junto con la vista vieja en Fase 8.
        $isInversor = false;
        $userId = $request->user()->id;

        // GastoTenantScope ya filtra por empresa activa (gastos globales sin vehiculo +
        // gastos cuyo vehículo pertenece a la empresa activa). El branch del inversor
        // se mantiene como filtro adicional por distribuciones suyas.
        $gastosQuery = Gasto::query()
            ->pendientes()
            ->with([
                'user:id,name',
                'vehiculo:id,patente,marca,modelo,inversion_id,empresa_id',
                'vehiculo.inversion:id,nombre',
                'distribuciones.user:id,name',
            ])
            ->when($isInversor, function ($q) use ($userId) {
                $q->whereHas('distribuciones', fn ($q2) => $q2->where('user_id', $userId));
            })
            ->latest('fecha')
            ->latest('id');

        $gastos = $gastosQuery->get()->map(function (Gasto $g) use ($isInversor, $userId) {
            $miMonto = null;
            if ($isInversor) {
                $miMonto = (float) $g->distribuciones
                    ->where('user_id', $userId)
                    ->sum('monto');
            }

            return [
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
                'distribuciones' => $isInversor
                    ? null
                    : $g->distribuciones->map(fn ($d) => [
                        'user_id' => $d->user_id,
                        'user_name' => $d->user?->name,
                        'monto' => (float) $d->monto,
                    ])->values(),
                'mi_monto' => $miMonto,
            ];
        });

        // Combobox options: categorías fijas + patentes.
        $patentes = $isInversor
            ? collect()
            : Vehiculo::query()
                ->select('id', 'patente', 'marca', 'modelo')
                ->orderBy('patente')
                ->get();

        $totalGeneral = $isInversor
            ? $gastos->sum('mi_monto')
            : $gastos->sum('monto');

        return Inertia::render('Gastos/Index', [
            'gastos' => $gastos,
            'patentes' => $patentes,
            'totalGeneral' => $totalGeneral,
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
