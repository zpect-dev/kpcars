<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Repara `actas`: agrega las columnas de cobro al chofer que faltaban en algún
 * entorno (la migración 2026_08_07_122000_add_cobro_to_actas quedó marcada como
 * corrida sin haber aplicado el ALTER de `actas`, dejando la tabla sin
 * `cobrado`/`cobrada_en`/`monto_cobrado` — el update en registrarCobro tiraba
 * "Unknown column 'monto_cobrado'").
 *
 * Idempotente: cada columna se agrega sólo si no existe, así es no-op donde la
 * migración original sí aplicó.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('actas', function (Blueprint $table) {
            if (! Schema::hasColumn('actas', 'cobrado')) {
                $table->boolean('cobrado')->default(false)->after('resuelta_en');
            }
            if (! Schema::hasColumn('actas', 'cobrada_en')) {
                $table->date('cobrada_en')->nullable()->after('cobrado');
            }
            if (! Schema::hasColumn('actas', 'monto_cobrado')) {
                $table->decimal('monto_cobrado', 12, 2)->default(0)->after('cobrada_en');
            }
        });
    }

    public function down(): void
    {
        // No se revierten: la migración original ya declara su propio down().
    }
};
