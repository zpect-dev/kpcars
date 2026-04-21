<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VehiculoController extends Controller
{
    /**
     * Return the vehicle currently assigned to the authenticated driver.
     *
     * Uses eager loading on vehiculo to avoid N+1.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        $asignacion = $user->asignacionActiva()
            ->with(['vehiculo'])
            ->first();

        if (! $asignacion) {
            return response()->json([
                'vehiculo' => null,
                'message' => 'No tiene un vehículo asignado actualmente.',
            ]);
        }

        $vehiculo = $asignacion->vehiculo;

        return response()->json([
            'vehiculo' => [
                'id' => $vehiculo->id,
                'patente' => $vehiculo->patente,
                'marca' => $vehiculo->marca,
                'modelo' => $vehiculo->modelo,
                'anio' => $vehiculo->anio,
            ],
            'asignacion' => [
                'fecha_inicio' => $asignacion->fecha_inicio->toDateTimeString(),
            ],
        ]);
    }

    /**
     * Return the vehicle assignment history for the authenticated driver.
     *
     * Uses eager loading on vehiculo to avoid N+1.
     */
    public function history(Request $request): JsonResponse
    {
        $user = $request->user();

        $asignaciones = \App\Models\Asignacion::where('conductor_id', $user->id)
            ->with(['vehiculo'])
            ->orderByDesc('fecha_inicio')
            ->get();

        $history = $asignaciones->map(function ($asignacion) {
            $vehiculo = $asignacion->vehiculo;
            
            return [
                'id' => $asignacion->id,
                'fecha_inicio' => $asignacion->fecha_inicio?->toDateTimeString(),
                'fecha_fin' => $asignacion->fecha_fin?->toDateTimeString(),
                'vehiculo' => $vehiculo ? [
                    'id' => $vehiculo->id,
                    'patente' => $vehiculo->patente,
                    'marca' => $vehiculo->marca,
                    'modelo' => $vehiculo->modelo,
                    'anio' => $vehiculo->anio,
                ] : null,
            ];
        });

        return response()->json([
            'historial' => $history,
        ]);
    }
}

