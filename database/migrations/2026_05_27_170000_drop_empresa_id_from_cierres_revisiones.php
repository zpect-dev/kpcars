<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Revisiones es una entidad GLOBAL (ver .agents/rules): el panel lista todos
 * los carros de todas las empresas y "Cerrar revisiones" abarca a todos en un
 * único cierre. Por lo tanto cierres_revisiones NO debe estar scopeado por
 * empresa — revertimos el empresa_id que se había agregado por error en el
 * paquete de "cierres por empresa" (que sí aplica a inversión y caja).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cierres_revisiones', function (Blueprint $table) {
            $table->dropConstrainedForeignId('empresa_id');
        });
    }

    public function down(): void
    {
        $defaultEmpresaId = DB::table('empresas')->orderBy('id')->value('id');

        Schema::table('cierres_revisiones', function (Blueprint $table) {
            $table->foreignId('empresa_id')
                ->nullable()
                ->after('id')
                ->constrained('empresas')
                ->cascadeOnDelete();
        });

        if ($defaultEmpresaId !== null) {
            DB::table('cierres_revisiones')->update(['empresa_id' => $defaultEmpresaId]);
        }
    }
};
