<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cabecera de una apertura de caja: marca el inicio de un período unificado
     * de cobros (inventario) + gastos. cierre_id null = período abierto en curso;
     * con valor = ya cerrado. Espeja la semántica de aperturas_recaudacion.
     */
    public function up(): void
    {
        Schema::create('aperturas_caja', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cierre_id')->nullable()->constrained('cierres_caja')->nullOnDelete();
            $table->timestamps();

            $table->index(['empresa_id', 'cierre_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('aperturas_caja');
    }
};
