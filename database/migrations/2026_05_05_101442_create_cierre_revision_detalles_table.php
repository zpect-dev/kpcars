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
        Schema::create('cierres_revisiones_detalles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_revision_id')->constrained('cierres_revisiones')->cascadeOnDelete();
            $table->foreignId('vehiculo_id')->constrained()->cascadeOnDelete();
            $table->foreignId('revision_id')->nullable()->constrained('revisiones')->nullOnDelete();
            $table->enum('estado', ['revisado', 'no_revisado']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cierres_revisiones_detalles');
    }
};
