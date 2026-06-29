<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\PrioridadReparacion;
use App\Models\RevisionMecanica;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RevisionMecanicaController extends Controller
{
    /**
     * Dashboard de revisión mecánica: todos los vehículos con chofer asignado y
     * su última revisión (prioridad de reparación). Global a todas las empresas.
     */
    public function index(Request $request): Response
    {
        $this->authorize('view-revision-mecanica');

        $vehiculos = Vehiculo::withoutGlobalScope(TenantScope::class)
            ->with(['user:id,name', 'inversion:id,nombre'])
            ->where('patente', '!=', 'EXTERNO')
            ->whereNotNull('user_id')
            ->orderBy('patente')
            ->get();

        // Última revisión mecánica por vehículo (una sola query).
        $ultimas = RevisionMecanica::with('revisor:id,name')
            ->whereIn('vehiculo_id', $vehiculos->pluck('id'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('vehiculo_id');

        $filas = $vehiculos->map(function (Vehiculo $v) use ($ultimas) {
            $r = $ultimas->get($v->id)?->first();

            return [
                'vehiculo_id' => $v->id,
                'patente' => $v->patente,
                'marca' => $v->marca,
                'modelo' => $v->modelo,
                'chofer' => $v->user?->name ?? 'N/A',
                'inversion' => $v->inversion?->nombre,
                'revision' => $r ? [
                    'promedio' => (float) $r->promedio,
                    'prioridad' => $r->prioridad->value,
                    'items' => $r->items,
                    'observaciones' => $r->observaciones,
                    'revisor' => $r->revisor?->name,
                    'fecha' => $r->created_at?->toISOString(),
                ] : null,
            ];
        })->values();

        return Inertia::render('RevisionMecanica/Index', [
            'filas' => $filas,
            'items' => collect(RevisionMecanica::ITEMS)
                ->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])
                ->values(),
        ]);
    }

    /**
     * Registra una nueva revisión mecánica para un vehículo, calculando el
     * promedio de gravedad y la prioridad de reparación resultante.
     */
    public function store(Request $request, int $vehiculo): RedirectResponse
    {
        $this->authorize('manage-revision-mecanica');

        $veh = Vehiculo::withoutGlobalScope(TenantScope::class)->findOrFail($vehiculo);

        $keys = array_keys(RevisionMecanica::ITEMS);

        $rules = [
            'items' => ['required', 'array'],
            'observaciones' => ['nullable', 'string', 'max:2000'],
        ];
        foreach ($keys as $k) {
            $rules["items.{$k}.gravedad"] = ['required', 'integer', 'min:1', 'max:5'];
            $rules["items.{$k}.descripcion"] = ['nullable', 'string', 'max:1000'];
        }

        $validated = $request->validate($rules);

        $items = [];
        $suma = 0;
        $maximo = 1;
        foreach ($keys as $k) {
            $gravedad = (int) $validated['items'][$k]['gravedad'];
            $items[$k] = [
                'gravedad' => $gravedad,
                'descripcion' => $validated['items'][$k]['descripcion'] ?? null,
            ];
            $suma += $gravedad;
            if ($gravedad > $maximo) $maximo = $gravedad;
        }

        $promedio = round($suma / count($keys), 2);
        $prioridad = PrioridadReparacion::fromMaximo($maximo);

        RevisionMecanica::create([
            'vehiculo_id' => $veh->id,
            'revisado_por' => $request->user()->id,
            'promedio' => $promedio,
            'prioridad' => $prioridad,
            'items' => $items,
            'observaciones' => $validated['observaciones'] ?? null,
        ]);

        return redirect()->back()->with('success', "Revisión mecánica registrada para {$veh->patente} (prioridad {$prioridad->label()}).");
    }
}
