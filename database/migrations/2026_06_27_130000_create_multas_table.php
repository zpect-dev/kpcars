<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('multas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehiculo_id')->constrained('vehiculos')->cascadeOnDelete();
            $table->foreignId('conductor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('fecha');
            // Antes de esta fecha la multa tiene un 50% de descuento sobre el monto.
            $table->date('fecha_vencimiento')->nullable();
            $table->decimal('monto', 12, 2);
            $table->text('descripcion');
            // Marca de seguimiento ("punto rojo"). Estas multas no tienen importe.
            $table->boolean('punto_rojo')->default(false);
            // Jurisdicción de la infracción: CABA o GBA.
            $table->string('jurisdiccion', 4)->nullable();
            // PDF de la multa (obligatorio al registrar). Ruta en el disco public.
            $table->string('pdf_path')->nullable();
            // Estados independientes:
            // - pagado: la multa se pagó al organismo.
            // - cobrado: la empresa le cobró el monto al chofer.
            $table->boolean('pagado')->default(false);
            $table->boolean('cobrado')->default(false);
            $table->timestamp('pagada_en')->nullable();
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['vehiculo_id', 'pagado']);
            $table->index(['conductor_id', 'cobrado']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('multas');
    }
};
