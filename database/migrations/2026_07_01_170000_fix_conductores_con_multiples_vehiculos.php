<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Corrección de datos: por un bug, un conductor podía quedar asignado a más
     * de un vehículo si estaban en empresas distintas. Se conserva el vehículo
     * de la asignación MÁS RECIENTE y se desasignan los demás (cerrando su
     * asignación activa).
     */
    public function up(): void
    {
        $conductores = DB::table('vehiculos')
            ->whereNotNull('user_id')
            ->where('patente', '!=', 'EXTERNO')
            ->select('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('user_id');

        foreach ($conductores as $conductorId) {
            // Vehículos del conductor con la fecha de inicio de su asignación activa.
            $vehiculos = DB::table('vehiculos')
                ->leftJoin('asignaciones', function ($join) {
                    $join->on('asignaciones.vehiculo_id', '=', 'vehiculos.id')
                        ->whereNull('asignaciones.fecha_fin');
                })
                ->where('vehiculos.user_id', $conductorId)
                ->groupBy('vehiculos.id', 'vehiculos.updated_at')
                ->select('vehiculos.id', 'vehiculos.updated_at', DB::raw('MAX(asignaciones.fecha_inicio) as inicio'))
                ->get();

            // El más reciente (por inicio de asignación, o updated_at) se mantiene;
            // el resto se desasigna.
            $quitar = $vehiculos
                ->sortByDesc(fn ($v) => $v->inicio ?? $v->updated_at)
                ->slice(1)
                ->pluck('id')
                ->all();

            if ($quitar !== []) {
                DB::table('vehiculos')->whereIn('id', $quitar)->update(['user_id' => null]);
                DB::table('asignaciones')
                    ->whereIn('vehiculo_id', $quitar)
                    ->whereNull('fecha_fin')
                    ->update(['fecha_fin' => now()]);
            }
        }
    }

    public function down(): void
    {
        // Corrección de datos puntual: no se revierte.
    }
};
