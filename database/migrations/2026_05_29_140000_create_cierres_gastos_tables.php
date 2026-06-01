<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

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

        Schema::create('cierres_gastos_detalles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_gasto_id')->constrained('cierres_gastos')->cascadeOnDelete();
            // Categoría del gasto (galpon, taller, oficina, kevin, stock, vehiculo).
            $table->string('tipo', 30);
            // Sólo para tipo=vehiculo: identifica el carro. Se guarda la patente
            // como snapshot por si el vehículo se elimina luego.
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();
            $table->string('patente', 20)->nullable();
            $table->decimal('total', 14, 2)->default(0);
            $table->timestamps();

            $table->index(['cierre_gasto_id', 'tipo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cierres_gastos_detalles');
        Schema::dropIfExists('cierres_gastos');
    }
};
