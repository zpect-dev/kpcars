<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add empresa_id to cobros for direct empresa-level isolation.
     * Inversiones with the same name from different empresas must not be mixed.
     */
    public function up(): void
    {
        Schema::table('cobros', function (Blueprint $table) {
            $table->foreignId('empresa_id')->nullable()->after('inversion_id')->constrained()->nullOnDelete();
            $table->index('empresa_id');
        });

        // Backfill empresa_id from the inversion's empresa
        DB::statement('
            UPDATE cobros
            SET empresa_id = (
                SELECT i.empresa_id
                FROM inversiones i
                WHERE i.id = cobros.inversion_id
            )
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cobros', function (Blueprint $table) {
            $table->dropConstrainedForeignId('empresa_id');
        });
    }
};
