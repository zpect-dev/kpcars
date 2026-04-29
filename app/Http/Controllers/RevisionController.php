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

        $weekStart = self::currentWeekStart();

        $vehiculos = Vehiculo::with(['user', 'inversion', 'empresa'])
            ->visibleTo($request->user())
            ->where('patente', '!=', 'EXTERNO')
            ->orderBy('patente')
            ->get()
            ->map(function (Vehiculo $vehiculo) use ($weekStart): array {
                $revision = Revision::with('revisor:id,name')
                    ->where('vehiculo_id', $vehiculo->id)
                    ->where('created_at', '>=', $weekStart)
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
            'semana_inicio' => $weekStart->toDateString(),
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

    /**
     * Calculate the start of the current "week" (Tuesday).
     *
     * The inspection week runs Tuesday → Monday.
     * If today is Tuesday or later, the week started this Tuesday.
     * If today is Monday, the week started last Tuesday.
     */
    public static function currentWeekStart(): Carbon
    {
        $today = Carbon::today();

        // dayOfWeek: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, ...
        // Days since last Tuesday (0 if today is Tuesday)
        $daysSinceTuesday = ($today->dayOfWeek - Carbon::TUESDAY + 7) % 7;

        return $today->copy()->subDays($daysSinceTuesday)->startOfDay();
    }
}
