<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deuda_movimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // 'cargo' = el admin suma deuda; 'pago' = el inversor abonó
            $table->enum('tipo', ['cargo', 'pago']);
            $table->decimal('monto', 14, 2);
            $table->string('descripcion', 500)->nullable();
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['inversion_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deuda_movimientos');
    }
};
