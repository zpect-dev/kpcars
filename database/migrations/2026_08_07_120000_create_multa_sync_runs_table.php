<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bitácora de corridas de sincronización del feed de multas. Cada `fetch()`
 * (manual o programado) inserta una fila con su resultado o su error, para
 * poder ver desde la vista cuándo fue la última sync y si falló.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('multa_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->string('origen', 16)->default('manual'); // manual | schedule
            $table->boolean('ok')->default(false);
            $table->date('snapshot_fecha')->nullable();
            $table->unsignedInteger('procesadas')->default(0);
            $table->unsignedInteger('nuevas')->default(0);
            $table->unsignedInteger('resueltas')->default(0);
            $table->unsignedInteger('reabiertas')->default(0);
            $table->unsignedInteger('duracion_ms')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('multa_sync_runs');
    }
};
