<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Revision;
use App\Models\Scopes\TenantScope;
use App\Models\Service;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ServiceController extends Controller
{
    /**
     * Panel de service: lista global de vehículos con el km de su último
     * service comparado contra el km más reciente de las revisiones.
     */
    public function index(Request $request): Response
    {
        $this->authorize('view-service');

        // Service es global: todos los carros de todas las empresas.
        // Se excluye el vehículo sintético "EXTERNO" (no es un carro real).
        $vehiculos = Vehiculo::withoutGlobalScope(TenantScope::class)
            ->with(['user:id,name', 'inversion:id,nombre', 'empresa:id,nombre', 'services.realizadoPor:id,name'])
            ->where('patente', '!=', 'EXTERNO')
            ->orderBy('patente')
            ->get();

        $vehiculoIds = $vehiculos->pluck('id');

        // Km más reciente de las revisiones por vehículo (cerrada o no).
        $ultimaRevision = Revision::select('vehiculo_id', 'kilometraje', 'created_at')
            ->whereIn('vehiculo_id', $vehiculoIds)
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('vehiculo_id');

        $payload = $vehiculos->map(function (Vehiculo $vehiculo) use ($ultimaRevision): array {
            $kmActual = $ultimaRevision->get($vehiculo->id)?->first()?->kilometraje;
            $ultimoService = $vehiculo->services->first(); // ya ordenado desc por la relación

            $kmRecorridos = null;
            $kmRestantes = null;
            $estado = 'sin_km';

            if ($kmActual === null) {
                $estado = 'sin_km';
            } elseif ($ultimoService === null) {
                $estado = 'sin_service';
            } else {
                $kmRecorridos = max(0, $kmActual - $ultimoService->kilometraje);
                $kmRestantes = max(0, Service::INTERVALO_KM - $kmRecorridos);
                $estado = $kmRecorridos >= Service::INTERVALO_KM ? 'vencido' : 'al_dia';
            }

            return [
                'id' => $vehiculo->id,
                'patente' => $vehiculo->patente,
                'marca' => $vehiculo->marca,
                'modelo' => $vehiculo->modelo,
                'anio' => $vehiculo->anio,
                'empresa' => $vehiculo->empresa?->nombre,
                'inversion' => $vehiculo->inversion?->nombre,
                'conductor' => $vehiculo->user?->name,
                'km_actual' => $kmActual,
                'ultimo_service' => $ultimoService ? [
                    'kilometraje' => $ultimoService->kilometraje,
                    'fecha' => $ultimoService->fecha->toDateString(),
                    'realizado_por' => $ultimoService->realizadoPor?->name,
                ] : null,
                'km_recorridos' => $kmRecorridos,
                'km_restantes' => $kmRestantes,
                'estado' => $estado,
                'historial' => $vehiculo->services->map(fn (Service $s) => [
                    'id' => $s->id,
                    'kilometraje' => $s->kilometraje,
                    'fecha' => $s->fecha->toDateString(),
                    'realizado_por' => $s->realizadoPor?->name,
                ])->values(),
            ];
        });

        return Inertia::render('Service/Index', [
            'vehiculos' => $payload,
            'intervaloKm' => Service::INTERVALO_KM,
        ]);
    }

    /**
     * Registra un service para un vehículo.
     */
    public function store(Request $request, int $vehiculo): RedirectResponse
    {
        $this->authorize('manage-service');

        // Service es global: el carro puede ser de cualquier empresa.
        $vehiculo = Vehiculo::withoutGlobalScope(TenantScope::class)->findOrFail($vehiculo);

        $validated = $request->validate([
            'kilometraje' => ['required', 'integer', 'min:0'],
            'fecha' => ['nullable', 'date'],
        ]);

        Service::create([
            'vehiculo_id' => $vehiculo->id,
            'realizado_por' => $request->user()->id,
            'kilometraje' => $validated['kilometraje'],
            'fecha' => $validated['fecha'] ?? now()->toDateString(),
        ]);

        return redirect()->back()->with('success', "Service registrado para {$vehiculo->patente}.");
    }

    /**
     * Elimina un registro de service (corrección de carga).
     */
    public function destroy(Request $request, Service $service): RedirectResponse
    {
        $this->authorize('manage-service');

        $service->delete();

        return redirect()->back()->with('success', 'Registro de service eliminado.');
    }
}
