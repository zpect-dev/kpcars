<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehiculo_id')->constrained('vehiculos')->cascadeOnDelete();
            $table->foreignId('realizado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('kilometraje');
            $table->date('fecha');
            $table->string('observaciones', 1000)->nullable();
            $table->timestamps();

            $table->index(['vehiculo_id', 'fecha']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
