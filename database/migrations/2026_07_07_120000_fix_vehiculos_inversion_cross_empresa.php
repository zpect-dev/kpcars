<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Data-fix: vehículos cuya inversión pertenece a OTRA empresa.
     *
     * Ese cruce hacía que la recaudación de una empresa se atribuyera a una
     * inversión de la otra en el cierre de sueldos (se detectó en local con
     * los autos de la empresa 2 apuntando a INV_01 de la empresa 1).
     *
     * Regla conservadora: sólo se reasigna automáticamente cuando la empresa
     * del vehículo tiene EXACTAMENTE UNA inversión (no hay ambigüedad).
     * Si tiene varias, se deja como está: el cierre unificado ahora rechaza
     * la inconsistencia con un mensaje claro y el admin la corrige a mano.
     */
    public function up(): void
    {
        $cruzados = DB::table('vehiculos')
            ->join('inversiones', 'vehiculos.inversion_id', '=', 'inversiones.id')
            ->whereNotNull('vehiculos.empresa_id')
            ->whereColumn('inversiones.empresa_id', '!=', 'vehiculos.empresa_id')
            ->get(['vehiculos.id as vehiculo_id', 'vehiculos.empresa_id as empresa_id']);

        foreach ($cruzados->groupBy('empresa_id') as $empresaId => $vehiculos) {
            $inversionesEmpresa = DB::table('inversiones')
                ->where('empresa_id', $empresaId)
                ->pluck('id');

            if ($inversionesEmpresa->count() !== 1) {
                continue; // Ambiguo: lo resuelve el admin manualmente.
            }

            DB::table('vehiculos')
                ->whereIn('id', $vehiculos->pluck('vehiculo_id'))
                ->update(['inversion_id' => $inversionesEmpresa->first()]);
        }
    }

    public function down(): void
    {
        // Data-fix: no se revierte (no hay forma de conocer el valor anterior).
    }
};
