<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Se elimina el manejo de imágenes de artículos: el inventario se vuelve más
 * liviano y dinámico (sin almacenamiento de archivos por ítem).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articulos', function (Blueprint $table) {
            $table->dropColumn('imagen');
        });
    }

    public function down(): void
    {
        Schema::table('articulos', function (Blueprint $table) {
            $table->string('imagen')->nullable()->after('precio');
        });
    }
};
