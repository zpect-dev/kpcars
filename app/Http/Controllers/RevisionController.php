<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\StoreRevisionAction;
use App\Models\Revision;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class RevisionController extends Controller
{
    /**
     * Display the weekly revisions panel.
     */
    public function index(Request $request): Response
    {
        $vehiculos = Vehiculo::with(['user', 'inversion', 'empresa'])
            ->where('patente', '!=', 'EXTERNO')
            ->whereNotNull('user_id')
            ->orderBy('patente')
            ->get();

        $vehiculoIds = $vehiculos->pluck('id');

        // Single query: open weekly revision per vehicle (still pending close)
        $revisionesAbiertas = Revision::with('revisor:id,name')
            ->whereIn('vehiculo_id', $vehiculoIds)
            ->whereNull('cierre_revision_id')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('vehiculo_id');

        // Single query: most recent revision (any state) per vehicle, only kilometraje needed
        $ultimosKm = Revision::select('vehiculo_id', 'kilometraje', 'created_at')
            ->whereIn('vehiculo_id', $vehiculoIds)
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('vehiculo_id');

        $vehiculos = $vehiculos->map(function (Vehiculo $vehiculo) use ($revisionesAbiertas, $ultimosKm): array {
            $revision = $revisionesAbiertas->get($vehiculo->id)?->first();
            $ultimoKm = $revision?->kilometraje ?? $ultimosKm->get($vehiculo->id)?->first()?->kilometraje;

            return [
                'vehiculo' => $vehiculo,
                'revision_semanal' => $revision,
                'ultimo_kilometraje' => $ultimoKm,
            ];
        });

        return Inertia::render('Revisiones/Index', [
            'vehiculos' => $vehiculos,
        ]);
    }

    /**
     * Store a new revision for a vehicle.
     */
    public function store(Request $request, Vehiculo $vehiculo, StoreRevisionAction $action): RedirectResponse
    {
        $this->authorize('create', \App\Models\Revision::class);

        $validated = $request->validate([
            'fecha_vencimiento_vtv' => ['nullable', 'date_format:Y-m'],
            'fecha_vencimiento_gnc' => ['nullable', 'date_format:Y-m'],
            'limpieza' => ['required', 'in:mala,buena'],
            'nivel_nafta' => ['required', 'in:bajo,optimo'],
            'kilometraje' => ['required', 'integer', 'min:0'],
            'rueda_auxiliar' => ['required', 'boolean'],
            'kit_seguridad' => ['required', 'boolean'],
            'sticker' => ['required', 'boolean'],
            'observaciones' => ['nullable', 'string', 'max:1000'],
        ]);

        // Append -01 to month-only dates for storage
        if (! empty($validated['fecha_vencimiento_vtv'])) {
            $validated['fecha_vencimiento_vtv'] .= '-01';
        }

        if (! empty($validated['fecha_vencimiento_gnc'])) {
            $validated['fecha_vencimiento_gnc'] .= '-01';
        }

        $validated['revisado_por'] = $request->user()->id;

        $action->execute($vehiculo, $validated);

        return redirect()->back()->with('success', "Revisión registrada para {$vehiculo->patente}.");
    }
    public function cerrar(Request $request, \App\Actions\CerrarRevisionesAction $action): RedirectResponse
    {
        $this->authorize('cerrar', \App\Models\Revision::class);

        $action->execute($request->user());

        return redirect()->back()->with('success', 'Revisiones cerradas exitosamente.');
    }

    public function historial(Request $request): Response
    {
        $cierres = \App\Models\CierreRevision::with('user:id,name')
            ->latest('periodo_fin')
            ->paginate(15);

        return Inertia::render('Revisiones/Historial', [
            'cierres' => $cierres,
        ]);
    }

    public function historialShow(Request $request, \App\Models\CierreRevision $cierre): Response
    {
        $cierre->load([
            'user:id,name',
            'detalles.vehiculo:id,patente,marca,modelo',
            'detalles.revision.revisor:id,name',
        ]);

        return Inertia::render('Revisiones/HistorialDetalle', [
            'cierre' => $cierre,
        ]);
    }
}
