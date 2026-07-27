<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Réplica consultable en SQL del reparto entre inversores de cada gasto.
     *
     * El JSON `gastos.distribucion` sigue siendo la foto congelada que leen
     * Mi Cuenta y los cierres; esta tabla existe para poder agregar por
     * inversor a nivel base de datos (reportes/resumen). Se llena al crear
     * el gasto y las FKs en cascada la limpian al borrarlo.
     */
    public function up(): void
    {
        Schema::create('gasto_distribuciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gasto_id')->constrained('gastos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('monto', 14, 2);
            $table->timestamps();

            $table->unique(['gasto_id', 'user_id']);
            $table->index('user_id');
        });

        // El resumen filtra cierres por fecha: columna de búsqueda frecuente.
        Schema::table('cierres_recaudacion', function (Blueprint $table) {
            $table->index('created_at');
        });

        // Backfill de los gastos existentes desde el JSON congelado. Sólo se
        // insertan inversores que sigan existiendo (la FK lo exige).
        $userIds = DB::table('users')->pluck('id')->flip();

        DB::table('gastos')
            ->whereNotNull('distribucion')
            ->orderBy('id')
            ->chunkById(200, function ($gastos) use ($userIds) {
                $now = now();
                $rows = [];

                foreach ($gastos as $gasto) {
                    $distribucion = json_decode((string) $gasto->distribucion, true) ?: [];

                    foreach ($distribucion as $userId => $monto) {
                        if (! $userIds->has((int) $userId)) {
                            continue;
                        }

                        $rows[] = [
                            'gasto_id' => $gasto->id,
                            'user_id' => (int) $userId,
                            'monto' => round((float) $monto, 2),
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    }
                }

                if ($rows !== []) {
                    DB::table('gasto_distribuciones')->insert($rows);
                }
            });
    }

    public function down(): void
    {
        Schema::table('cierres_recaudacion', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });

        Schema::dropIfExists('gasto_distribuciones');
    }
};
