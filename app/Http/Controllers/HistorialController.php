<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\ChoferEvento;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class HistorialController extends Controller
{
    /**
     * Historial editable de movimientos de personal: altas/bajas de choferes y
     * cambios de vehículo, con sus fechas ajustables. Misma fuente que el reporte
     * (chofer_eventos y asignaciones). Global, no acotado por empresa.
     */
    public function index(Request $request): Response
    {
        $this->authorize('view-historial');

        $filters = $request->only(['from', 'to', 'chofer']);

        $from = ! empty($filters['from']) ? Carbon::parse($filters['from'])->startOfDay() : null;
        $to = ! empty($filters['to']) ? Carbon::parse($filters['to'])->endOfDay() : null;
        $choferId = ! empty($filters['chofer']) ? (int) $filters['chofer'] : null;

        $vehiculoEager = fn ($q) => $q->withoutGlobalScope(TenantScope::class)->select('id', 'patente', 'marca', 'modelo');

        $fmtVehiculo = fn (?Asignacion $a) => $a && $a->vehiculo ? [
            'patente' => $a->vehiculo->patente,
            'marca' => $a->vehiculo->marca,
            'modelo' => $a->vehiculo->modelo,
        ] : null;

        // Altas y bajas (chofer_eventos).
        $eventos = ChoferEvento::with('chofer:id,name,dni')
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to))
            ->when($choferId, fn ($q) => $q->where('user_id', $choferId))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (ChoferEvento $e) => [
                'id' => $e->id,
                'tipo' => $e->tipo->value,
                'chofer' => $e->chofer?->name ?? 'N/A',
                'chofer_dni' => $e->chofer?->dni,
                'fecha' => $e->created_at?->toISOString(),
            ]);

        // Cambios de vehículo (asignaciones que son cambios reales de un carro a otro).
        $cambiosRaw = Asignacion::query()
            ->with([
                'conductor:id,name,dni',
                'vehiculo' => $vehiculoEager,
            ])
            ->when($from, fn ($q) => $q->where('fecha_inicio', '>=', $from))
            ->when($to, fn ($q) => $q->where('fecha_inicio', '<=', $to))
            ->when($choferId, fn ($q) => $q->where('conductor_id', $choferId))
            ->orderByDesc('fecha_inicio')
            ->orderByDesc('id')
            ->get();

        $conductorIds = $cambiosRaw->pluck('conductor_id')->filter()->unique()->all();

        $historial = Asignacion::query()
            ->whereIn('conductor_id', $conductorIds)
            ->with(['vehiculo' => $vehiculoEager])
            ->orderBy('fecha_inicio')
            ->orderBy('id')
            ->get()
            ->groupBy('conductor_id');

        $cambios = $cambiosRaw->map(function (Asignacion $a) use ($historial, $fmtVehiculo) {
            $previa = ($historial[$a->conductor_id] ?? collect())
                ->filter(fn (Asignacion $h) => $h->id !== $a->id
                    && ($h->fecha_inicio < $a->fecha_inicio
                        || ($h->fecha_inicio == $a->fecha_inicio && $h->id < $a->id)))
                ->last();

            // Primera asignación (alta) o misma unidad: no es un cambio.
            if ($previa === null || $previa->vehiculo_id === $a->vehiculo_id) {
                return null;
            }

            return [
                'id' => $a->id,
                'conductor' => $a->conductor?->name ?? 'N/A',
                'conductor_dni' => $a->conductor?->dni,
                'vehiculo_anterior' => $fmtVehiculo($previa),
                'vehiculo' => $fmtVehiculo($a),
                'fecha_inicio' => $a->fecha_inicio?->toISOString(),
                'fecha_fin' => $a->fecha_fin?->toISOString(),
            ];
        })->filter()->values();

        $choferes = User::where('role', 'chofer')
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Historial/Index', [
            'filters' => $filters,
            'eventos' => $eventos,
            'cambios' => $cambios,
            'choferes' => $choferes,
            'stats' => [
                'altas' => $eventos->where('tipo', 'alta')->count(),
                'bajas' => $eventos->where('tipo', 'baja')->count(),
                'cambios' => $cambios->count(),
            ],
        ]);
    }

    /**
     * Ajusta la fecha (created_at) de un evento de alta/baja, conservando la hora.
     */
    public function updateChoferEvento(Request $request, ChoferEvento $choferEvento): RedirectResponse
    {
        $this->authorize('manage-historial');

        $data = $request->validate([
            'fecha' => ['required', 'date'],
        ]);

        $hora = ($choferEvento->created_at ?? now())->format('H:i:s');
        $choferEvento->created_at = Carbon::parse($data['fecha'])->setTimeFromTimeString($hora);
        $choferEvento->save();

        return redirect()->back()->with('success', 'Fecha actualizada.');
    }

    /**
     * Ajusta las fechas de inicio/fin de una asignación (cambio de vehículo),
     * conservando la hora original de cada una.
     */
    public function updateAsignacion(Request $request, Asignacion $asignacion): RedirectResponse
    {
        $this->authorize('manage-historial');

        $data = $request->validate([
            'fecha_inicio' => ['required', 'date'],
            'fecha_fin' => ['nullable', 'date', 'after_or_equal:fecha_inicio'],
        ]);

        $horaInicio = ($asignacion->fecha_inicio ?? now())->format('H:i:s');
        $asignacion->fecha_inicio = Carbon::parse($data['fecha_inicio'])->setTimeFromTimeString($horaInicio);

        if (! empty($data['fecha_fin'])) {
            $horaFin = ($asignacion->fecha_fin ?? now())->format('H:i:s');
            $asignacion->fecha_fin = Carbon::parse($data['fecha_fin'])->setTimeFromTimeString($horaFin);
        }

        $asignacion->save();

        return redirect()->back()->with('success', 'Fechas de asignación actualizadas.');
    }
}
