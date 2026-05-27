<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pivot empresa_user: declara las empresas a las que pertenece un usuario.
 *
 * Hasta hoy un inversor pertenecía a UNA empresa (users.empresa_id). Con la
 * pivot un inversor puede ser miembro de varias, lo cual habilita:
 *  - Mi Cuenta como vista cross-empresa (unión de sus inversiones).
 *  - Switcher de empresa en el dropdown si tiene >=2 empresas asignadas.
 *  - Listado de socios filtrado correctamente por empresa activa.
 *
 * Backfill: las filas existentes de users.empresa_id se preservan creando
 * la entrada equivalente en el pivot. users.empresa_id se elimina en una
 * migración posterior (mismo batch) una vez completado el backfill.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('empresa_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'empresa_id']);
        });

        // Backfill: cada inversor (u otro usuario con empresa_id != null) pasa
        // a tener una entrada en el pivot equivalente.
        DB::table('users')
            ->whereNotNull('empresa_id')
            ->select('id', 'empresa_id')
            ->orderBy('id')
            ->chunk(200, function ($users) {
                $rows = $users->map(fn ($u) => [
                    'user_id' => $u->id,
                    'empresa_id' => $u->empresa_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ])->all();

                if (! empty($rows)) {
                    DB::table('empresa_user')->insert($rows);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('empresa_user');
    }
};
