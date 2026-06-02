<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            // Estado de la patente: buen_estado | mal_estado | provisional | null (vacío).
            $table->string('estado_patente', 20)->nullable()->after('propietario');
        });

        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn('patente_buen_estado');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->boolean('patente_buen_estado')->default(true)->after('propietario');
        });

        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn('estado_patente');
        });
    }
};
