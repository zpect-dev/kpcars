<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Revision;
use App\Models\Vehiculo;
use Illuminate\Support\Facades\DB;

class StoreRevisionAction
{
    /**
     * Store a new weekly revision for a vehicle.
     *
     * Atomically creates the revision record and updates
     * the vehicle's VTV/GNC expiration dates if provided.
     *
     * @param  array<string, mixed>  $data  Validated revision data.
     */
    public function execute(Vehiculo $vehiculo, array $data): Revision
    {
        return DB::transaction(function () use ($vehiculo, $data): Revision {
            $revision = Revision::create([
                'vehiculo_id' => $vehiculo->id,
                'fecha_vencimiento_vtv' => $data['fecha_vencimiento_vtv'] ?? null,
                'fecha_vencimiento_gnc' => $data['fecha_vencimiento_gnc'] ?? null,
                'limpieza' => $data['limpieza'],
                'nivel_nafta' => $data['nivel_nafta'],
                'kilometraje' => (int) $data['kilometraje'],
                'rueda_auxiliar' => (bool) ($data['rueda_auxiliar'] ?? false),
                'kit_seguridad' => (bool) ($data['kit_seguridad'] ?? false),
                'observaciones' => $data['observaciones'] ?? null,
            ]);

            // Sync VTV/GNC dates back to the vehicle
            $vehiculoUpdates = [];

            if (! empty($data['fecha_vencimiento_vtv'])) {
                $vehiculoUpdates['fecha_vencimiento_vtv'] = $data['fecha_vencimiento_vtv'];
            }

            if (! empty($data['fecha_vencimiento_gnc'])) {
                $vehiculoUpdates['fecha_vencimiento_gnc'] = $data['fecha_vencimiento_gnc'];
            }

            if (! empty($vehiculoUpdates)) {
                $vehiculo->update($vehiculoUpdates);
            }

            return $revision;
        });
    }
}
