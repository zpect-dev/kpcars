<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Liga cada acta a la corrida de sincronización que la dio de alta y a la que la
 * marcó resuelta. Sin esto, el detalle de un reporte solo se podría reconstruir
 * por fecha de snapshot, que no distingue dos corridas del mismo día.
 *
 * Las actas anteriores a esta migración quedan con ambos campos en null: no
 * pertenecen a ningún reporte y no aparecen en el detalle.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('actas', function (Blueprint $table) {
            // Corrida que la dio de alta. No cambia si el acta se reabre.
            $table->foreignId('sync_run_id')->nullable()->after('snapshot_fecha')
                ->constrained('multa_sync_runs')->nullOnDelete();
            // Corrida que la marcó resuelta. Se limpia al reabrirse.
            $table->foreignId('resuelta_run_id')->nullable()->after('sync_run_id')
                ->constrained('multa_sync_runs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('actas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sync_run_id');
            $table->dropConstrainedForeignId('resuelta_run_id');
        });
    }
};
