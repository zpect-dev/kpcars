<?php

declare(strict_types=1);

use App\Models\Asignacion;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Resincroniza la tabla asignaciones con vehiculos.user_id (fuente de verdad
 * del dashboard). Imports/seeds históricos dejaron vehículos con conductor
 * asignado (user_id) pero sin una asignación ABIERTA correspondiente, lo que
 * hacía que el chofer apareciera "sin vehículo" en Personal.
 *
 * Para cada vehículo con user_id:
 *   - Si ya existe una asignación abierta (fecha_fin null) de ese conductor a
 *     ESE vehículo → no se toca (ya es consistente).
 *   - Si no → se cierran otras asignaciones abiertas del conductor (apuntan a
 *     otro vehículo o no existen) y se crea la asignación abierta correcta.
 *
 * En contexto consola TenantScope es no-op; igual usamos withoutGlobalScope
 * por claridad.
 */
return new class extends Migration
{
    public function up(): void
    {
        $vehiculos = Vehiculo::withoutGlobalScope(TenantScope::class)
            ->whereNotNull('user_id')
            ->get(['id', 'user_id', 'updated_at']);

        DB::transaction(function () use ($vehiculos) {
            foreach ($vehiculos as $vehiculo) {
                $conductorId = (int) $vehiculo->user_id;

                $yaConsistente = Asignacion::where('conductor_id', $conductorId)
                    ->where('vehiculo_id', $vehiculo->id)
                    ->whereNull('fecha_fin')
                    ->exists();

                if ($yaConsistente) {
                    continue;
                }

                // Cerrar cualquier asignación abierta previa del conductor
                // (mantiene la invariante: 1 asignación abierta por conductor).
                Asignacion::where('conductor_id', $conductorId)
                    ->whereNull('fecha_fin')
                    ->update(['fecha_fin' => now()]);

                Asignacion::create([
                    'vehiculo_id' => $vehiculo->id,
                    'conductor_id' => $conductorId,
                    'asignado_por' => null,
                    'fecha_inicio' => $vehiculo->updated_at ?? now(),
                    'fecha_fin' => null,
                ]);
            }
        });
    }

    public function down(): void
    {
        // Irreversible de forma segura: no se puede saber qué asignaciones
        // fueron creadas/cerradas por este backfill. No-op.
    }
};
