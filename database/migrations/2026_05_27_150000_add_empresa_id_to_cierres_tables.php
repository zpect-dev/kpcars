<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cierra el contrato multi-tenant para los flujos de cierre semanal.
 *
 * Los cierres existentes (cierres_inversion, cierres_caja, cierres_revisiones)
 * representan eventos agregados que hasta hoy no estaban atados a una empresa.
 * En el nuevo modelo cada cierre pertenece a una empresa (el admin lo dispara
 * desde su contexto activo), y los listados/queries deben respetar el
 * TenantScope para que los cálculos no mezclen empresas.
 *
 * Backfill: toda la data histórica se asigna a la empresa con id más bajo
 * (EMP_1 en este entorno). Es seguro porque hasta hoy todas las inversiones
 * vivían en una sola empresa.
 */
return new class extends Migration
{
    public function up(): void
    {
        $defaultEmpresaId = DB::table('empresas')->orderBy('id')->value('id');

        foreach (['cierres_inversion', 'cierres_caja', 'cierres_revisiones'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->foreignId('empresa_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('empresas')
                    ->cascadeOnDelete();
            });

            if ($defaultEmpresaId !== null) {
                DB::table($table)->update(['empresa_id' => $defaultEmpresaId]);
            }
        }
    }

    public function down(): void
    {
        foreach (['cierres_inversion', 'cierres_caja', 'cierres_revisiones'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropConstrainedForeignId('empresa_id');
            });
        }
    }
};
