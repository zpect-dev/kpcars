<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds empresa_id FK to inversiones and populates it from vehiculos.
     */
    public function up(): void
    {
        Schema::table('inversiones', function (Blueprint $table) {
            $table->foreignId('empresa_id')->nullable()->after('nombre')->constrained()->nullOnDelete();
            $table->index('empresa_id');
        });

        // Data migration: derive empresa_id from the vehiculos that belong to each inversion.
        // Each inversion's vehicles should all belong to the same empresa.
        DB::statement('
            UPDATE inversiones
            SET empresa_id = (
                SELECT v.empresa_id
                FROM vehiculos v
                WHERE v.inversion_id = inversiones.id
                  AND v.empresa_id IS NOT NULL
                LIMIT 1
            )
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inversiones', function (Blueprint $table) {
            $table->dropConstrainedForeignId('empresa_id');
        });
    }
};
