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
            // Precio objetivo de recaudación por vehículo. Default 360.000 para
            // todos (incluidos los existentes, que el default cubre).
            $table->decimal('precio', 12, 2)->default(360000)->after('propietario');
        });
    }

    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn('precio');
        });
    }
};
