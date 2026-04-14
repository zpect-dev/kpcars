<?php

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
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->index('patente');
        });

        Schema::table('transacciones', function (Blueprint $table) {
            $table->index('solicitante');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropIndex(['patente']);
        });

        Schema::table('transacciones', function (Blueprint $table) {
            $table->dropIndex(['solicitante']);
        });
    }
};
