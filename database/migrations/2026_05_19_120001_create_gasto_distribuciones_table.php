<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gasto_distribuciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gasto_id')->constrained('gastos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->decimal('monto', 14, 2);
            $table->timestamps();

            $table->index(['user_id', 'gasto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gasto_distribuciones');
    }
};
