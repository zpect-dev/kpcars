<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Refactor del módulo de Gastos hacia un vínculo explícito gasto → cierre.
 *
 *  - `gastos.cierre_gasto_id`: FK al cierre que "archiva" el gasto. NULL = pendiente.
 *  - `gastos.distribucion`: JSON con el reparto entre inversores (user_id => monto),
 *    congelado al crear el gasto. Reemplaza la tabla `gasto_distribuciones`.
 *  - El desglose del cierre (por tipo / por patente) se deriva on-demand de los
 *    gastos asociados, por lo que `cierres_gastos_detalles` deja de existir.
 *
 * Migración idempotente: en una base con el intento previo ya aplicado, los guards
 * evitan recrear `cierre_gasto_id`; en un install fresco crea la columna + FK.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gastos', function (Blueprint $table) {
            if (! Schema::hasColumn('gastos', 'cierre_gasto_id')) {
                $table->foreignId('cierre_gasto_id')
                    ->nullable()
                    ->after('vehiculo_id')
                    ->constrained('cierres_gastos')
                    ->nullOnDelete();
                $table->index('cierre_gasto_id');
            }

            if (! Schema::hasColumn('gastos', 'distribucion')) {
                // Reparto inversor => monto, congelado al crear el gasto.
                $table->json('distribucion')->nullable()->after('monto');
            }
        });

        // Columnas de un diseño previo abandonado: el desglose ahora se deriva.
        Schema::table('cierres_gastos', function (Blueprint $table) {
            foreach (['tipo_cierre', 'empresa_nombre', 'lote'] as $col) {
                if (Schema::hasColumn('cierres_gastos', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::dropIfExists('cierres_gastos_detalles');
        Schema::dropIfExists('gasto_distribuciones');

        // Reset de la data de prueba para arrancar consistente: todos los gastos
        // vuelven a "pendiente" y se descartan los cierres previos (sin histórico).
        DB::table('gastos')->update(['cierre_gasto_id' => null]);
        DB::table('cierres_gastos')->delete();
    }

    public function down(): void
    {
        Schema::table('gastos', function (Blueprint $table) {
            if (Schema::hasColumn('gastos', 'distribucion')) {
                $table->dropColumn('distribucion');
            }
        });

        Schema::table('cierres_gastos', function (Blueprint $table) {
            $table->string('tipo_cierre', 30)->nullable();
            $table->string('empresa_nombre')->nullable();
            $table->unsignedInteger('lote')->nullable();
        });

        Schema::create('gasto_distribuciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gasto_id')->constrained('gastos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('monto', 14, 2);
            $table->timestamps();
        });

        Schema::create('cierres_gastos_detalles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_gasto_id')->constrained('cierres_gastos')->cascadeOnDelete();
            $table->string('tipo', 30);
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();
            $table->string('patente', 20)->nullable();
            $table->decimal('total', 14, 2)->default(0);
            $table->timestamps();

            $table->index(['cierre_gasto_id', 'tipo']);
        });
    }
};
