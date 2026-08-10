<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Línea de conteo: el resultado por artículo. Guarda el snapshot del stock
     * esperado al confirmar, el físico contado y la diferencia. Cuando hay
     * diferencia se registra el motivo + nota y se enlaza la transacción AJUSTE
     * generada. Es la fuente autoritativa para los reportes de diferencias.
     */
    public function up(): void
    {
        Schema::create('conteo_lineas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conteo_id')->constrained('conteos')->cascadeOnDelete();
            $table->foreignId('articulo_id')->constrained('articulos');
            $table->integer('stock_esperado');
            $table->integer('stock_fisico');
            // fisico - esperado. Negativo = faltante, positivo = sobrante.
            $table->integer('diferencia');
            // Categoría del ajuste (ver App\Models\ConteoLinea::MOTIVOS). Null si diferencia = 0.
            $table->string('motivo')->nullable();
            $table->text('nota')->nullable();
            // AJUSTE generado por esta línea, si hubo diferencia.
            $table->foreignId('transaccion_id')->nullable()->constrained('transacciones')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conteo_lineas');
    }
};
