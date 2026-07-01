<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reparto por empresa (empresa_id => monto), congelado al crear el gasto.
     * Solo aplica a los gastos globales (galpón / taller / oficina), que se
     * dividen entre empresas según sus autos alquilados.
     */
    public function up(): void
    {
        Schema::table('gastos', function (Blueprint $table) {
            $table->json('distribucion_empresas')->nullable()->after('distribucion');
        });
    }

    public function down(): void
    {
        Schema::table('gastos', function (Blueprint $table) {
            $table->dropColumn('distribucion_empresas');
        });
    }
};
