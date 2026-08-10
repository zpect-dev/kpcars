<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Convierte `transacciones.tipo` de enum('IN','OUT') a string(16) para
     * admitir el nuevo tipo 'AJUSTE' (ajuste de stock por conteo físico).
     *
     * Se usa string en vez de ampliar el enum porque:
     *  - En MySQL (producción) evita futuras migraciones ALTER por cada tipo.
     *  - En SQLite (tests) elimina el CHECK ("tipo" in ('IN','OUT')) que
     *    rechazaría 'AJUSTE'.
     *
     * Los valores válidos (IN, OUT, AJUSTE) se validan en capa de aplicación
     * (ver App\Models\Transaccion::TIPOS).
     */
    public function up(): void
    {
        Schema::table('transacciones', function (Blueprint $table) {
            $table->string('tipo', 16)->change();
        });
    }

    public function down(): void
    {
        Schema::table('transacciones', function (Blueprint $table) {
            $table->enum('tipo', ['IN', 'OUT'])->change();
        });
    }
};
