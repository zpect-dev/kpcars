<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\BuildServiceListadoAction;
use App\Models\KilometrajeLectura;
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
    public function index(Request $request, BuildServiceListadoAction $action): Response
    {
        $this->authorize('view-service');

        // Sin filtros: la pantalla busca y filtra del lado del cliente.
        return Inertia::render('Service/Index', [
            'vehiculos' => $action->execute(),
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
     * Registra una lectura de kilometraje para un vehículo.
     */
    public function storeKilometraje(Request $request, int $vehiculo): RedirectResponse
    {
        $this->authorize('manage-service');

        // Service es global: el carro puede ser de cualquier empresa.
        $vehiculo = Vehiculo::withoutGlobalScope(TenantScope::class)->findOrFail($vehiculo);

        $validated = $request->validate([
            'kilometraje' => ['required', 'integer', 'min:0'],
            'fecha' => ['nullable', 'date'],
        ]);

        KilometrajeLectura::create([
            'vehiculo_id' => $vehiculo->id,
            'registrado_por' => $request->user()->id,
            'kilometraje' => $validated['kilometraje'],
            'fecha' => $validated['fecha'] ?? now()->toDateString(),
        ]);

        return redirect()->back()->with('success', "Kilometraje actualizado para {$vehiculo->patente}.");
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
