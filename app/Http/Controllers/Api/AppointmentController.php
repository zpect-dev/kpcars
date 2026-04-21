<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Actions\ScheduleAppointmentAction;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use RuntimeException;

class AppointmentController extends Controller
{
    /**
     * List appointments for the driver's currently assigned vehicle.
     *
     * Filters by the license plate of the active assignment.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $asignacion = $user->asignacionActiva()->with('vehiculo')->first();

        if (! $asignacion) {
            return response()->json([
                'appointments' => [],
                'message' => 'No tiene un vehículo asignado actualmente.',
            ]);
        }

        $patente = $asignacion->vehiculo->patente;

        $appointments = Appointment::where('license_plate', $patente)
            ->orderByDesc('scheduled_date')
            ->paginate(20);

        return response()->json($appointments);
    }

    /**
     * Schedule a new appointment for the driver's assigned vehicle.
     *
     * The license_plate and applicant are auto-filled from the active assignment.
     * Reuses the existing ScheduleAppointmentAction for business logic.
     */
    public function store(Request $request, ScheduleAppointmentAction $action): JsonResponse
    {
        $user = $request->user();

        $asignacion = $user->asignacionActiva()->with('vehiculo')->first();

        if (! $asignacion) {
            return response()->json([
                'message' => 'No puede solicitar un turno sin un vehículo asignado.',
            ], 422);
        }

        $validated = $request->validate([
            'service' => ['required', 'string', 'max:255'],
            'preferred_date' => ['required', 'date'],
            'type' => ['sometimes', 'in:normal,emergencia'],
        ]);

        $preferred = Carbon::parse($validated['preferred_date'])->startOfDay();

        try {
            $appointment = $action->execute(
                trim($validated['service']),
                strtoupper($asignacion->vehiculo->patente),
                $user->id,
                $preferred,
                $validated['type'] ?? 'normal',
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => "Turno agendado exitosamente para el día {$appointment->scheduled_date->translatedFormat('d/m/Y')}.",
            'appointment' => $appointment,
        ], 201);
    }

    /**
     * Schedule a new appointment from an external web system.
     *
     * Requires all fields explicitly (same as the internal web form).
     * No vehicle assignment check — the external system provides everything.
     */
    public function storeExternal(Request $request, ScheduleAppointmentAction $action): JsonResponse
    {
        $validated = $request->validate([
            'service' => ['required', 'string', 'max:255'],
            'license_plate' => ['required', 'string', 'max:20'],
            'applicant' => ['required', 'string', 'max:255'],
            'preferred_date' => ['required', 'date'],
            'type' => ['sometimes', 'in:normal,emergencia'],
        ]);

        $preferred = Carbon::parse($validated['preferred_date'])->startOfDay();

        try {
            $appointment = $action->execute(
                trim($validated['service']),
                strtoupper(trim($validated['license_plate'])),
                null,
                $preferred,
                $validated['type'] ?? 'normal',
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => "Turno agendado exitosamente para el día {$appointment->scheduled_date->translatedFormat('d/m/Y')}.",
            'appointment' => $appointment,
        ], 201);
    }

    /**
     * Cancel an appointment from an external web system.
     */
    public function cancelExternal(Request $request, Appointment $appointment): JsonResponse
    {
        if ($appointment->status === 'cancelado') {
            return response()->json(['message' => 'El turno ya se encuentra cancelado.'], 400);
        }

        $appointment->update(['status' => 'cancelado']);

        return response()->json([
            'message' => 'Turno cancelado exitosamente.',
            'appointment' => $appointment,
        ]);
    }
}
