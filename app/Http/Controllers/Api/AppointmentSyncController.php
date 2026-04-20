<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppointmentSyncController extends Controller
{
    /**
     * Pull appointments data for an external system.
     *
     * Returns all appointments within a given date range, including
     * type (normal/emergencia) and status information.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to'   => ['required', 'date', 'after_or_equal:from'],
        ]);

        $appointments = Appointment::whereBetween('scheduled_date', [
                $validated['from'],
                $validated['to'],
            ])
            ->orderBy('scheduled_date')
            ->orderBy('id')
            ->get(['id', 'service', 'type', 'license_plate', 'applicant', 'scheduled_date', 'status', 'created_at']);

        return response()->json([
            'count'        => $appointments->count(),
            'appointments' => $appointments,
        ]);
    }
}
