<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Sesión de conteo físico de inventario. Cada conteo agrupa las líneas
     * contadas (una por artículo) y sirve de cabecera para la auditoría de
     * diferencias y ajustes.
     */
    public function up(): void
    {
        Schema::create('conteos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users');
            // Zona contada: 'repuestos' | 'galpon' (conteo cíclico por zona).
            $table->string('zona');
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conteos');
    }
};
