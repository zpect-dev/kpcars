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
        Schema::create('revisiones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehiculo_id')->constrained('vehiculos')->cascadeOnDelete();
            $table->date('fecha_vencimiento_vtv')->nullable();
            $table->date('fecha_vencimiento_gnc')->nullable();
            $table->string('limpieza', 10); // mala, buena
            $table->string('nivel_nafta', 10); // bajo, optimo
            $table->unsignedInteger('kilometraje');
            $table->boolean('rueda_auxiliar')->default(false);
            $table->boolean('kit_seguridad')->default(false);
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index(['vehiculo_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('revisiones');
    }
};
