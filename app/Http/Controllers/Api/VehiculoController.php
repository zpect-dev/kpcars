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
     * Uses eager loading on empresa and inversion to avoid N+1.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        $asignacion = $user->asignacionActiva()
            ->with(['vehiculo.empresa', 'vehiculo.inversion'])
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
                'empresa' => $vehiculo->empresa?->nombre,
                'inversion' => $vehiculo->inversion?->nombre,
            ],
            'asignacion' => [
                'fecha_inicio' => $asignacion->fecha_inicio->toDateTimeString(),
            ],
        ]);
    }
}
