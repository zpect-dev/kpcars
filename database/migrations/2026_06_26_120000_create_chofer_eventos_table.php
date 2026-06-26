<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('chofer_eventos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('tipo'); // alta | baja
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tipo', 'created_at']);
            $table->index('user_id');
        });

        // ── Backfill histórico ─────────────────────────────────────────────
        // Altas: la fecha de creación de cada chofer es su alta original.
        DB::table('users')
            ->where('role', 'chofer')
            ->orderBy('id')
            ->get(['id', 'created_at', 'inactivo', 'estado_actualizado_en', 'updated_at'])
            ->each(function ($u) {
                DB::table('chofer_eventos')->insert([
                    'user_id' => $u->id,
                    'tipo' => 'alta',
                    'registrado_por' => null,
                    'created_at' => $u->created_at,
                    'updated_at' => $u->created_at,
                ]);

                // Bajas: los choferes actualmente inactivos tienen una baja en la
                // fecha del último cambio de estado (aproximación retroactiva: sólo
                // se conoce el último cambio, no el historial completo previo).
                if ($u->inactivo) {
                    $fechaBaja = $u->estado_actualizado_en ?? $u->updated_at;
                    DB::table('chofer_eventos')->insert([
                        'user_id' => $u->id,
                        'tipo' => 'baja',
                        'registrado_por' => null,
                        'created_at' => $fechaBaja,
                        'updated_at' => $fechaBaja,
                    ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chofer_eventos');
    }
};
