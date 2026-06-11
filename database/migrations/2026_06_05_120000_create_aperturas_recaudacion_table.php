<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cabecera de una apertura de recaudaciones: marca el inicio de un período
        // y congela la lista de vehículos/choferes en ese instante (la "foto").
        // cierre_id null = período abierto en curso; con valor = ya cerrado.
        Schema::create('aperturas_recaudacion', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cierre_id')->nullable()->constrained('cierres_recaudacion')->nullOnDelete();
            $table->timestamps();

            $table->index(['empresa_id', 'cierre_id']);
        });

        Schema::table('recaudaciones', function (Blueprint $table) {
            // Apertura a la que pertenece la fila (foto en la que fue creada).
            $table->foreignId('apertura_id')->nullable()->after('cierre_id')
                ->constrained('aperturas_recaudacion')->nullOnDelete();
            // Chofer congelado al momento de la apertura: el histórico no cambia
            // aunque luego se reasigne o desasigne el vehículo.
            $table->foreignId('user_id')->nullable()->after('vehiculo_id')
                ->constrained('users')->nullOnDelete();

            $table->index(['apertura_id']);
        });

        // Backfill: las filas abiertas existentes (cierre_id null) no tienen apertura.
        // Creamos una apertura retroactiva por empresa y las vinculamos, y rellenamos
        // el chofer snapshot con el chofer actual del vehículo.
        $this->backfill();
    }

    public function down(): void
    {
        Schema::table('recaudaciones', function (Blueprint $table) {
            $table->dropConstrainedForeignId('apertura_id');
            $table->dropConstrainedForeignId('user_id');
        });

        Schema::dropIfExists('aperturas_recaudacion');
    }

    private function backfill(): void
    {
        // Rellena el chofer snapshot de TODAS las recaudaciones (abiertas y cerradas)
        // a partir del chofer actual del vehículo, para coherencia del histórico.
        // Subconsulta correlacionada (portable MySQL/SQLite) en vez de UPDATE..JOIN.
        DB::statement(<<<'SQL'
            UPDATE recaudaciones
            SET user_id = (
                SELECT v.user_id FROM vehiculos v WHERE v.id = recaudaciones.vehiculo_id
            )
            WHERE user_id IS NULL
        SQL);

        // Por cada empresa con filas abiertas sin apertura, crea una apertura
        // retroactiva (atribuida al primer usuario admin de la empresa) y las vincula.
        $empresas = DB::table('recaudaciones')
            ->whereNull('cierre_id')
            ->whereNull('apertura_id')
            ->distinct()
            ->pluck('empresa_id');

        // Usuario al que atribuir las aperturas retroactivas: primer admin, o cualquiera.
        $userId = DB::table('users')->where('role', 'administrador')->value('id')
            ?? DB::table('users')->value('id');

        foreach ($empresas as $empresaId) {
            $aperturaId = DB::table('aperturas_recaudacion')->insertGetId([
                'empresa_id' => $empresaId,
                'user_id' => $userId,
                'cierre_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('recaudaciones')
                ->where('empresa_id', $empresaId)
                ->whereNull('cierre_id')
                ->whereNull('apertura_id')
                ->update(['apertura_id' => $aperturaId]);
        }
    }
};
