<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cleanup final del refactor de roles: las columnas `absoluto` y
 * `empresa_acceso` ya no las lee ningún consumer.
 *
 * - `absoluto`: el discriminador "admin con privilegios totales vs admin
 *   limitado" se traslado al rol ADMINISTRATIVO en Fase 1.
 * - `empresa_acceso`: el contexto de empresa por usuario migró a
 *   `users.empresa_default_id` + `session('active_company_id')` (Fases 1-2).
 *
 * Si en algún ambiente se necesita revertir, `down()` restaura las dos
 * columnas vacías (los datos no se pueden reconstruir a partir del rol).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['absoluto', 'empresa_acceso']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('absoluto')->default(false)->after('role');
            $table->unsignedTinyInteger('empresa_acceso')->nullable()->after('absoluto');
        });
    }
};
