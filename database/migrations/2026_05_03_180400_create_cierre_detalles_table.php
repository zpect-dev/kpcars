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
        Schema::create('cierre_detalles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_id')->constrained('cierres_caja')->cascadeOnDelete();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            $table->decimal('total', 12, 2);
            $table->timestamps();

            $table->index(['cierre_id', 'inversion_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cierre_detalles');
    }
};
