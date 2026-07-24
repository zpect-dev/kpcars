<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Datos de personal:
     * - direccion: domicilio del chofer (dónde vive).
     * - fecha_ingreso: cuándo empezó a trabajar (administrativos y mecánicos).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('direccion')->nullable()->after('telefono');
            $table->date('fecha_ingreso')->nullable()->after('direccion');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['direccion', 'fecha_ingreso']);
        });
    }
};
