<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cierres_inversion', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ejecutado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('periodo_inicio')->nullable();
            $table->timestamp('periodo_fin');
            $table->decimal('total_recaudado', 14, 2)->default(0);
            $table->decimal('total_distribuido', 14, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('cierres_inversion_recaudaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_id')->constrained('cierres_inversion')->cascadeOnDelete();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            $table->decimal('monto', 14, 2);
            $table->timestamps();

            $table->unique(['cierre_id', 'inversion_id']);
        });

        Schema::create('cierres_inversion_pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_id')->constrained('cierres_inversion')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            // 'parte_completa' | 'media_parte_deudor' | 'cero_deudor' | 'redistribucion_financiador'
            $table->string('concepto', 40);
            $table->decimal('monto', 14, 2);
            $table->timestamps();

            $table->index(['cierre_id', 'user_id']);
            $table->index(['user_id', 'inversion_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cierres_inversion_pagos');
        Schema::dropIfExists('cierres_inversion_recaudaciones');
        Schema::dropIfExists('cierres_inversion');
    }
};
