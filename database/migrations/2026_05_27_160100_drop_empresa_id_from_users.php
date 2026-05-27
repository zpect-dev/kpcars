<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cierra la transición a multi-empresa: ahora la pivot empresa_user es la
 * única fuente de verdad para "este usuario pertenece a estas empresas".
 *
 * users.empresa_id (legacy de modelo 1-inversor-1-empresa) deja de existir.
 * El down() lo restaura intentando reconstruir desde el pivot (best-effort:
 * si un inversor ahora tiene 2+ empresas, se persiste la de menor id).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('empresa_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('empresa_id')
                ->nullable()
                ->after('role')
                ->constrained('empresas')
                ->nullOnDelete();
        });

        DB::statement(
            'UPDATE users u
               SET empresa_id = (
                   SELECT MIN(empresa_id) FROM empresa_user
                   WHERE empresa_user.user_id = u.id
               )'
        );
    }
};
