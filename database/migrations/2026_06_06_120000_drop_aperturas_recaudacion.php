<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Revierte el esquema de "apertura de recaudaciones": deja la tabla
     * recaudaciones como estaba antes (sin apertura_id ni user_id) y elimina
     * la tabla aperturas_recaudacion. Guardado con condicionales para ser
     * idempotente y seguro en bases donde nunca llegó a aplicarse.
     */
    public function up(): void
    {
        Schema::table('recaudaciones', function (Blueprint $table) {
            if (Schema::hasColumn('recaudaciones', 'apertura_id')) {
                $table->dropConstrainedForeignId('apertura_id');
            }
            if (Schema::hasColumn('recaudaciones', 'user_id')) {
                $table->dropConstrainedForeignId('user_id');
            }
        });

        Schema::dropIfExists('aperturas_recaudacion');
    }

    /**
     * No-op: no recreamos el esquema descartado.
     */
    public function down(): void
    {
        // Intencionalmente vacío. El sistema de apertura fue retirado.
    }
};
