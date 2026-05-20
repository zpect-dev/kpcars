<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gastos', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->decimal('monto', 14, 2);
            $table->foreignId('user_id')->constrained('users');
            $table->string('recibio');
            $table->enum('metodo_pago', ['efectivo', 'transferencia']);
            $table->text('descripcion')->nullable();
            $table->enum('tipo', ['galpon', 'taller', 'oficina', 'kevin', 'stock', 'vehiculo']);
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();
            $table->timestamps();

            $table->index('fecha');
            $table->index('tipo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gastos');
    }
};
