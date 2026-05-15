<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inversion_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('tiene_deuda')->default(false);
            $table->boolean('es_financiador')->default(false);
            $table->timestamps();

            $table->unique(['inversion_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inversion_user');
    }
};
