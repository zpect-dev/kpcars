<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ScheduleAppointmentAction;
use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class AppointmentController extends Controller
{
    /**
     * Display the appointments dashboard with filters and capacity usage.
     */
    public function index(Request $request): Response
    {
        $filters = $request->only(['from', 'to', 'status', 'plate']);

        // Default to today if no date filter is explicitly provided (or cleared)
        if (! $request->has('from') && ! $request->has('to')) {
            $filters['from'] = now()->toDateString();
            $filters['to'] = now()->toDateString();
        }

        $from = ! empty($filters['from']) ? Carbon::parse($filters['from'])->toDateString() : null;
        $to   = ! empty($filters['to'])   ? Carbon::parse($filters['to'])->toDateString()   : null;

        $appointments = Appointment::with(['completedBy:id,name', 'conductor:id,name'])
            ->when($from, fn ($q) => $q->whereDate('scheduled_date', '>=', $from))
            ->when($to,   fn ($q) => $q->whereDate('scheduled_date', '<=', $to))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['plate']), fn ($q) => $q->where('license_plate', 'like', '%'.$filters['plate'].'%'))
            ->orderBy('scheduled_date')
            ->orderBy('id')
            ->paginate(30)
            ->withQueryString();

        $vehiculos = Vehiculo::select('id', 'patente', 'marca', 'modelo', 'user_id')
            ->orderBy('patente')
            ->get();

        $conductores = User::where('inactivo', false)
            ->orderBy('name')
            ->get(['id', 'name']);

        // Cupos normales usados por día (próximos 60 días) para el calendario del frontend
        $dailySlots = Appointment::selectRaw('DATE(scheduled_date) as fecha, COUNT(*) as used')
            ->where('type', 'normal')
            ->whereIn('status', ['agendado', 'en_proceso', 'completado'])
            ->whereDate('scheduled_date', '>=', now()->toDateString())
            ->groupBy(DB::raw('DATE(scheduled_date)'))
            ->pluck('used', 'fecha')
            ->toArray();

        $today = now()->toDateString();
        $usedToday = $dailySlots[$today] ?? 0;
        $remainingToday = max(0, 4 - $usedToday);

        return Inertia::render('Appointments/Index', [
            'appointments'   => $appointments,
            'filters'        => $filters,
            'vehiculos'      => $vehiculos,
            'conductores'    => $conductores,
            'dailySlots'     => $dailySlots,
            'remainingToday' => $remainingToday,
            'maxSlots'       => 4,
        ]);
    }

    /**
     * Schedule an appointment directly, returning an error if no capacity.
     */
    public function store(Request $request, ScheduleAppointmentAction $action): RedirectResponse
    {
        abort_if($request->user()->isMechanic(), 403);
        
        $validated = $request->validate([
            'service'        => ['required', 'string', 'max:255'],
            'license_plate'  => ['required', 'string', 'max:20'],
            'conductor_id'   => ['required', 'integer', 'exists:users,id'],
            'preferred_date' => ['required', 'date'],
            'type'           => ['required', 'in:normal,emergencia'],
        ]);

        $preferred = Carbon::parse($validated['preferred_date'])->startOfDay();

        try {
            $appointment = $action->execute(
                trim($validated['service']),
                strtoupper(trim($validated['license_plate'])),
                (int) $validated['conductor_id'],
                $preferred,
                $validated['type'],
            );
        } catch (RuntimeException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        $humanAssigned = $appointment->scheduled_date->translatedFormat('d/m/Y');
        $typeLabel = $validated['type'] === 'emergencia' ? ' (emergencia)' : '';

        return redirect()->back()->with(
            'success',
            "Turno{$typeLabel} agendado exitosamente para el día {$humanAssigned}.",
        );
    }

    /**
     * Update the status of an appointment.
     */
    public function updateStatus(Request $request, Appointment $appointment): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:agendado,en_proceso,completado,cancelado'],
        ]);

        $newStatus = $validated['status'];
        $oldStatus = $appointment->status;

        if ($newStatus === 'cancelado') {
            abort_if($request->user()->isMechanic(), 403, 'Los mecánicos no pueden cancelar turnos.');
        }

        if ($oldStatus === $newStatus) {
            return redirect()->back();
        }

        try {
            DB::transaction(function () use ($appointment, $newStatus) {
                $payload = ['status' => $newStatus];
                
                if ($newStatus === 'completado') {
                    $payload['completed_by'] = auth()->id();
                }

                $appointment->update($payload);
            });
        } catch (RuntimeException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        $labels = [
            'agendado'   => 'agendado',
            'en_proceso' => 'en proceso',
            'completado' => 'completado',
            'cancelado'  => 'cancelado',
        ];

        return redirect()->back()->with(
            'success',
            "Turno marcado como {$labels[$newStatus]}.",
        );
    }
}
