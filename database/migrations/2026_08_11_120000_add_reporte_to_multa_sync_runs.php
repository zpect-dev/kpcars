<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Importes del reporte de cada corrida de sincronización. Los conteos (nuevas,
 * resueltas) ya estaban; faltaba cuánta plata movió cada corrida y cómo quedó la
 * deuda al cerrarla, que es lo que se muestra en el panel de reportes.
 *
 * Se guardan en la corrida (y no se recalculan después) para que el reporte
 * histórico no cambie cuando el feed actualiza el monto de una infracción.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('multa_sync_runs', function (Blueprint $table) {
            // Suma de los montos de las actas dadas de alta en la corrida.
            $table->decimal('monto_nuevas', 14, 2)->default(0)->after('nuevas');
            // Suma de los montos de las actas que pasaron a resueltas.
            $table->decimal('monto_resueltas', 14, 2)->default(0)->after('resueltas');
            // Deuda vigente total al cerrar la corrida (todas las actas vigentes).
            $table->decimal('deuda_vigente', 14, 2)->default(0)->after('reabiertas');
        });
    }

    public function down(): void
    {
        Schema::table('multa_sync_runs', function (Blueprint $table) {
            $table->dropColumn(['monto_nuevas', 'monto_resueltas', 'deuda_vigente']);
        });
    }
};
