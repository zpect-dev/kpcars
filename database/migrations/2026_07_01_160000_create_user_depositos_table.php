<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Depósitos (garantía) del chofer. Uno por moneda (USD / ARS); un chofer
     * puede tener varios. Reemplaza a users.deposito / users.deposito_moneda.
     */
    public function up(): void
    {
        Schema::create('user_depositos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('monto', 14, 2);
            $table->string('moneda', 3); // USD | ARS
            $table->timestamps();

            $table->index('user_id');
        });

        // Migrar los depósitos existentes (uno por usuario) a la nueva tabla.
        DB::table('users')
            ->whereNotNull('deposito')
            ->where('deposito', '>', 0)
            ->get(['id', 'deposito', 'deposito_moneda'])
            ->each(fn ($u) => DB::table('user_depositos')->insert([
                'user_id' => $u->id,
                'monto' => $u->deposito,
                'moneda' => $u->deposito_moneda ?: 'ARS',
                'created_at' => now(),
                'updated_at' => now(),
            ]));

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['deposito', 'deposito_moneda']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('deposito', 14, 2)->nullable();
            $table->string('deposito_moneda', 3)->nullable();
        });

        Schema::dropIfExists('user_depositos');
    }
};
