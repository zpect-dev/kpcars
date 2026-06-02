<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cabecera del cierre de un período de recaudaciones (foto histórica).
        Schema::create('cierres_recaudacion', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
        });

        // Recaudación por vehículo. cierre_id null = período abierto actual;
        // con valor = fila congelada perteneciente a un cierre.
        Schema::create('recaudaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehiculo_id')->constrained('vehiculos')->cascadeOnDelete();
            $table->foreignId('empresa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cierre_id')->nullable()->constrained('cierres_recaudacion')->nullOnDelete();
            $table->decimal('efectivo', 12, 2)->default(0);
            $table->decimal('transferencia', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->decimal('descuento', 12, 2)->default(0);
            // Snapshot del precio del vehículo al momento, para que el historial
            // no cambie si luego se edita el precio del vehículo.
            $table->decimal('precio', 12, 2)->default(0);
            $table->text('descripcion')->nullable();
            $table->timestamps();

            $table->index(['empresa_id', 'cierre_id']);
            $table->index(['vehiculo_id', 'cierre_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recaudaciones');
        Schema::dropIfExists('cierres_recaudacion');
    }
};
