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
            'from' => ['nullable', 'date'],
            'to'   => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $validated['from'] ?? now()->toDateString();
        $to   = $validated['to']   ?? now()->addMonths(2)->toDateString();

        $appointments = Appointment::with('conductor:id,name')
            ->whereBetween('scheduled_date', [$from, $to])
            ->orderBy('scheduled_date')
            ->orderBy('id')
            ->get(['id', 'service', 'type', 'license_plate', 'conductor_id', 'scheduled_date', 'status', 'created_at']);

        return response()->json([
            'count'        => $appointments->count(),
            'appointments' => $appointments,
        ]);
    }
}
