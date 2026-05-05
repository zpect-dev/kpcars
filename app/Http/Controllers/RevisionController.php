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
        abort_if($request->user()->isInversor(), 403);

        $vehiculos = Vehiculo::with(['user', 'inversion', 'empresa'])
            ->visibleTo($request->user())
            ->where('patente', '!=', 'EXTERNO')
            ->whereNotNull('user_id')
            ->orderBy('patente')
            ->get()
            ->map(function (Vehiculo $vehiculo): array {
                $revision = Revision::with('revisor:id,name')
                    ->where('vehiculo_id', $vehiculo->id)
                    ->whereNull('cierre_revision_id')
                    ->latest()
                    ->first();

                $lastRevision = $revision ?? Revision::where('vehiculo_id', $vehiculo->id)
                    ->latest()
                    ->first();

                return [
                    'vehiculo' => $vehiculo,
                    'revision_semanal' => $revision,
                    'ultimo_kilometraje' => $lastRevision?->kilometraje,
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
        abort_if($request->user()->isInversor(), 403);

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
        abort_if(!$request->user()->isAdmin(), 403, 'Solo administradores pueden cerrar revisiones.');

        $action->execute($request->user());

        return redirect()->back()->with('success', 'Revisiones cerradas exitosamente.');
    }

    public function historial(Request $request): Response
    {
        abort_if($request->user()->isInversor(), 403);

        $cierres = \App\Models\CierreRevision::with('user:id,name')
            ->latest('periodo_fin')
            ->paginate(15);

        return Inertia::render('Revisiones/Historial', [
            'cierres' => $cierres,
        ]);
    }

    public function historialShow(Request $request, \App\Models\CierreRevision $cierre): Response
    {
        abort_if($request->user()->isInversor(), 403);

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
