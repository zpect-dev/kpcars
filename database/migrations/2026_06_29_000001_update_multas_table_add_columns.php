<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('multas', function (Blueprint $table) {
            // Renombrar pagada → pagado
            $table->renameColumn('pagada', 'pagado');

            // Nuevas columnas
            $table->date('fecha_vencimiento')->nullable()->after('fecha');
            $table->boolean('punto_rojo')->default(false)->after('descripcion');
            $table->string('jurisdiccion', 4)->nullable()->after('punto_rojo');
            $table->string('pdf_path')->nullable()->after('jurisdiccion');
            $table->boolean('cobrado')->default(false)->after('pagado');
        });

        // Actualizar índices (los viejos apuntan a 'pagada' que ya no existe)
        Schema::table('multas', function (Blueprint $table) {
            $table->index(['vehiculo_id', 'pagado']);
            $table->index(['conductor_id', 'cobrado']);
        });
    }

    public function down(): void
    {
        Schema::table('multas', function (Blueprint $table) {
            $table->dropIndex(['vehiculo_id', 'pagado']);
            $table->dropIndex(['conductor_id', 'cobrado']);
            $table->dropColumn(['fecha_vencimiento', 'punto_rojo', 'jurisdiccion', 'pdf_path', 'cobrado']);
            $table->renameColumn('pagado', 'pagada');
        });
    }
};
