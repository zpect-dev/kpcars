<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * "Deudor" pasa a ser un flag explícito (`es_deudor`), no derivado de que la
 * deuda sea > 0. Así una inversión INCOMPLETA (sin sus 10 autos, sin monto de
 * deuda fijado todavía) puede tener deudores marcados a mano. Se replica en la
 * foto del cierre (`cierre_sueldo_participaciones`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inversion_user', function (Blueprint $table) {
            $table->boolean('es_deudor')->default(false)->after('deuda');
        });

        Schema::table('cierre_sueldo_participaciones', function (Blueprint $table) {
            $table->boolean('es_deudor')->default(false)->after('saldo');
        });

        // Backfill: quien tenía deuda > 0 ya era deudor.
        DB::table('inversion_user')->where('deuda', '>', 0)->update(['es_deudor' => true]);
        DB::table('cierre_sueldo_participaciones')->where('saldo', '>', 0)->update(['es_deudor' => true]);
    }

    public function down(): void
    {
        Schema::table('inversion_user', function (Blueprint $table) {
            $table->dropColumn('es_deudor');
        });

        Schema::table('cierre_sueldo_participaciones', function (Blueprint $table) {
            $table->dropColumn('es_deudor');
        });
    }
};
