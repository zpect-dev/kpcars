<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla de cierres de gastos: snapshot del período (inicio/fin, total).
 *
 * El desglose por tipo/patente y el reparto por inversor NO viven en tablas
 * aparte: se derivan de los gastos vinculados vía `gastos.cierre_gasto_id`
 * y de `gastos.distribucion` (ver migración refactor_gastos_cierre_linkage).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cierres_gastos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->nullable()->constrained('empresas')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->dateTime('periodo_inicio')->nullable();
            $table->dateTime('periodo_fin');
            $table->decimal('total_general', 14, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cierres_gastos');
    }
};
