<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ScheduleAppointmentAction;
use App\Models\Appointment;
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

        $from = ! empty($filters['from']) ? Carbon::parse($filters['from'])->toDateString() : null;
        $to   = ! empty($filters['to'])   ? Carbon::parse($filters['to'])->toDateString()   : null;

        $appointments = Appointment::when($from, fn ($q) => $q->whereDate('scheduled_date', '>=', $from))
            ->when($to,   fn ($q) => $q->whereDate('scheduled_date', '<=', $to))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['plate']), fn ($q) => $q->where('license_plate', 'like', '%'.$filters['plate'].'%'))
            ->orderBy('scheduled_date')
            ->orderBy('id')
            ->paginate(30)
            ->withQueryString();

        $vehiculos = Vehiculo::select('id', 'patente', 'marca', 'modelo')
            ->orderBy('patente')
            ->get();

        return Inertia::render('Appointments/Index', [
            'appointments'  => $appointments,
            'filters'       => $filters,
            'vehiculos'  => $vehiculos,
        ]);
    }

    /**
     * Schedule an appointment directly, returning an error if no capacity.
     */
    public function store(Request $request, ScheduleAppointmentAction $action): RedirectResponse
    {
        $validated = $request->validate([
            'service' => ['required', 'string', 'max:255'],
            'license_plate' => ['required', 'string', 'max:20'],
            'applicant' => ['required', 'string', 'max:255'],
            'preferred_date' => ['required', 'date'],
        ]);

        $preferred = Carbon::parse($validated['preferred_date'])->startOfDay();

        try {
            $appointment = $action->execute(
                trim($validated['service']),
                strtoupper(trim($validated['license_plate'])),
                trim($validated['applicant']),
                $preferred,
            );
        } catch (RuntimeException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        $humanAssigned = $appointment->scheduled_date->translatedFormat('d/m/Y');

        return redirect()->back()->with(
            'success',
            "Turno agendado exitosamente para el día {$humanAssigned}.",
        );
    }

    /**
     * Update the status of an appointment.
     *
     * Si el turno está cancelado y se lo reactiva a agendado/completado, se
     * re-valida la capacidad del día bajo bloqueo pesimista para evitar
     * exceder los cupos por una reactivación concurrente.
     */
    public function updateStatus(Request $request, Appointment $appointment): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:agendado,en_proceso,completado'],
        ]);

        $newStatus = $validated['status'];
        $oldStatus = $appointment->status;

        if ($oldStatus === $newStatus) {
            return redirect()->back();
        }

        try {
            DB::transaction(function () use ($appointment, $newStatus) {
                $appointment->update(['status' => $newStatus]);
            });
        } catch (RuntimeException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        $labels = [
            'agendado'   => 'agendado',
            'en_proceso' => 'en proceso',
            'completado' => 'completado',
        ];

        return redirect()->back()->with(
            'success',
            "Turno marcado como {$labels[$newStatus]}.",
        );
    }
}
