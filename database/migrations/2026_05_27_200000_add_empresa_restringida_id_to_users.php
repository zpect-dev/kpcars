<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Restricción opcional de empresa para administradores/administrativos.
 *
 * - empresa_restringida_id != null  → el usuario queda FIJADO a esa empresa
 *   (no ve el switcher, no puede cambiar de contexto).
 * - empresa_restringida_id == null  → puede cambiar entre todas las empresas
 *   (comportamiento por defecto).
 *
 * No aplica a inversores (su acceso lo define la pivot empresa_user) ni a
 * mecánicos/choferes (sin contexto de empresa).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('empresa_restringida_id')
                ->nullable()
                ->after('empresa_default_id')
                ->constrained('empresas')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('empresa_restringida_id');
        });
    }
};
