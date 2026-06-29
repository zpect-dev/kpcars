<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Vincula un cierre de gastos a su cierre de caja padre dentro del modelo
     * unificado. Las filas legacy (cierres de gasto previos al refactor, que se
     * cerraban por separado) quedan en null y se siguen mostrando como cierres
     * autónomos en el historial.
     */
    public function up(): void
    {
        Schema::table('cierres_gastos', function (Blueprint $table) {
            $table->foreignId('cierre_caja_id')->nullable()->after('empresa_id')
                ->constrained('cierres_caja')->nullOnDelete();

            $table->index('cierre_caja_id');
        });
    }

    public function down(): void
    {
        Schema::table('cierres_gastos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cierre_caja_id');
        });
    }
};
