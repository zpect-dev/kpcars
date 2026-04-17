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
        // 1. Eliminar la tabla inversiones vacía actual para evitar conflictos
        Schema::dropIfExists('inversiones');

        // 2. Renombrar la tabla empresas a inversiones
        Schema::rename('empresas', 'inversiones');

        // 3. Actualizar la tabla vehiculos para reflejar el cambio de relación
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->renameColumn('empresa_id', 'inversion_id');
        });

        // 4. Crear la nueva tabla empresas
        Schema::create('empresas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('empresas');

        Schema::table('vehiculos', function (Blueprint $table) {
            $table->renameColumn('inversion_id', 'empresa_id');
        });

        Schema::rename('inversiones', 'empresas');

        Schema::create('inversiones', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->timestamps();
        });
    }
};
