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
        // La tabla de cierres puede faltar según el historial de migraciones de
        // cada entorno (registro presente pero tabla ausente). Se asegura aquí
        // para que esta migración sea auto-suficiente e idempotente.
        if (! Schema::hasTable('cierres_gastos')) {
            Schema::create('cierres_gastos', function (Blueprint $table) {
                $table->id();
                $table->foreignId('empresa_id')->nullable()->constrained('empresas')->nullOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->dateTime('periodo_inicio')->nullable();
                $table->dateTime('periodo_fin');
                $table->decimal('total_general', 14, 2)->default(0);
                $table->timestamps();
            });
        }

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
        if (Schema::hasTable('cierres_gastos')) {
            Schema::table('cierres_gastos', function (Blueprint $table) {
                foreach (['tipo_cierre', 'empresa_nombre', 'lote'] as $col) {
                    if (Schema::hasColumn('cierres_gastos', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        Schema::dropIfExists('cierres_gastos_detalles');
        Schema::dropIfExists('gasto_distribuciones');

        // En entornos donde `cierre_gasto_id` ya existía (intento previo) puede
        // haber quedado sin la FK ON DELETE SET NULL, de la que depende reabrir
        // un período al borrar su cierre. Se reasegura sólo en MySQL (en SQLite
        // la FK se define al crear la columna y este bloque no aplica).
        if (DB::getDriverName() === 'mysql') {
            // Limpia vínculos a cierres inexistentes (vuelven a "pendiente")
            // para no violar la integridad referencial al (re)crear la FK.
            DB::statement('UPDATE gastos SET cierre_gasto_id = NULL WHERE cierre_gasto_id IS NOT NULL AND cierre_gasto_id NOT IN (SELECT id FROM cierres_gastos)');

            $fkExiste = ! empty(DB::select(<<<'SQL'
                SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'gastos'
                  AND COLUMN_NAME = 'cierre_gasto_id'
                  AND REFERENCED_TABLE_NAME = 'cierres_gastos'
                LIMIT 1
            SQL));

            if (! $fkExiste) {
                Schema::table('gastos', function (Blueprint $table) {
                    $table->foreign('cierre_gasto_id')
                        ->references('id')->on('cierres_gastos')
                        ->nullOnDelete();
                });
            }
        }
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
