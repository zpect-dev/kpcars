<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reconstrucción del módulo de inversiones/sueldos.
     *
     * 1. La deuda pasa de ledger (deuda_movimientos) a un monto simple en el
     *    pivot inversion_user; los saldos vigentes se migran antes de dropear.
     * 2. Se eliminan las tablas del cierre de inversión viejo (el histórico
     *    de cierres se descarta de forma deliberada).
     * 3. Se crean las tablas del nuevo cierre de sueldos, disparado por el
     *    cierre unificado de recaudaciones de ambas empresas.
     * 4. Data-fix de producción: users 146/147/148 quedan como financiadores
     *    de INV_06..INV_11 de la empresa 1 (con chequeos de existencia; en
     *    entornos donde esos registros no existen, no hace nada).
     */
    public function up(): void
    {
        // -- 1. Deuda como monto simple en el pivot ------------------------
        Schema::table('inversion_user', function (Blueprint $table) {
            $table->decimal('deuda', 14, 2)->default(0)->after('es_financiador');
        });

        // Migrar los saldos vigentes (cargos - pagos) al nuevo campo.
        // Saldos negativos (sobrepagos) se normalizan a 0.
        $saldos = DB::table('deuda_movimientos')
            ->selectRaw("inversion_id, user_id, SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE -monto END) as saldo")
            ->groupBy('inversion_id', 'user_id')
            ->get();

        foreach ($saldos as $s) {
            DB::table('inversion_user')
                ->where('inversion_id', $s->inversion_id)
                ->where('user_id', $s->user_id)
                ->update(['deuda' => max((float) $s->saldo, 0)]);
        }

        // El flag tiene_deuda deja de existir: deudor = deuda > 0.
        Schema::table('inversion_user', function (Blueprint $table) {
            $table->dropColumn('tiene_deuda');
        });

        // -- 2. Eliminar el módulo viejo (hijos primero) -------------------
        Schema::dropIfExists('deuda_movimientos');
        Schema::dropIfExists('cierres_inversion_pagos');
        Schema::dropIfExists('cierres_inversion_recaudaciones');
        Schema::dropIfExists('cierres_inversion');

        // -- 3. Nuevo cierre de sueldos ------------------------------------
        // Un registro por cierre unificado: cubre las dos empresas a la vez.
        Schema::create('cierres_sueldo', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ejecutado_por')->nullable()->constrained('users')->nullOnDelete();
            // Tasa de conversión a USD aplicada en este cierre (Gs por 1 USD).
            $table->decimal('tasa', 14, 4);
            $table->timestamps();
        });

        Schema::create('cierre_sueldo_pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_sueldo_id')->constrained('cierres_sueldo')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            // Snapshot de la empresa de la inversión al momento del cierre:
            // el sueldo se calcula y consulta separado por empresa.
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            // 'parte_completa' | 'media_parte_deudor' | 'cero_deudor' | 'redistribucion_financiador'
            $table->string('concepto', 40);
            $table->decimal('monto', 14, 2);
            $table->timestamps();

            $table->index(['cierre_sueldo_id', 'user_id']);
            $table->index(['user_id', 'inversion_id']);
        });

        // Abonos de deuda registrados en el modal del cierre (foto de lo
        // descontado; el saldo vivo queda en inversion_user.deuda).
        Schema::create('cierre_sueldo_abonos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_sueldo_id')->constrained('cierres_sueldo')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            $table->decimal('monto', 14, 2);
            $table->timestamps();

            $table->index(['cierre_sueldo_id', 'user_id']);
        });

        // Cada cierre de recaudación (uno por empresa) queda vinculado al
        // cierre de sueldos global que lo disparó.
        Schema::table('cierres_recaudacion', function (Blueprint $table) {
            $table->foreignId('cierre_sueldo_id')->nullable()->after('user_id')
                ->constrained('cierres_sueldo')->nullOnDelete();
        });

        // -- 4. Data-fix producción: financiadores fijos -------------------
        $financiadorIds = DB::table('users')
            ->whereIn('id', [146, 147, 148])
            ->pluck('id');

        if ($financiadorIds->isNotEmpty()) {
            $inversionIds = DB::table('inversiones')
                ->where('empresa_id', 1)
                ->whereIn('nombre', ['INV_06', 'INV_07', 'INV_08', 'INV_09', 'INV_10', 'INV_11'])
                ->pluck('id');

            foreach ($inversionIds as $inversionId) {
                foreach ($financiadorIds as $userId) {
                    $existe = DB::table('inversion_user')
                        ->where('inversion_id', $inversionId)
                        ->where('user_id', $userId)
                        ->exists();

                    if ($existe) {
                        DB::table('inversion_user')
                            ->where('inversion_id', $inversionId)
                            ->where('user_id', $userId)
                            ->update(['es_financiador' => true, 'updated_at' => now()]);
                    } else {
                        DB::table('inversion_user')->insert([
                            'inversion_id' => $inversionId,
                            'user_id' => $userId,
                            'es_financiador' => true,
                            'deuda' => 0,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            }
        }
    }

    /**
     * Restaura el esquema anterior (sin datos: el histórico ya fue dropeado).
     */
    public function down(): void
    {
        Schema::table('cierres_recaudacion', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cierre_sueldo_id');
        });

        Schema::dropIfExists('cierre_sueldo_abonos');
        Schema::dropIfExists('cierre_sueldo_pagos');
        Schema::dropIfExists('cierres_sueldo');

        Schema::create('cierres_inversion', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('ejecutado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('periodo_inicio')->nullable();
            $table->timestamp('periodo_fin');
            $table->decimal('total_recaudado', 14, 2)->default(0);
            $table->decimal('tasa', 14, 4)->nullable();
            $table->decimal('total_distribuido', 14, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('cierres_inversion_recaudaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_id')->constrained('cierres_inversion')->cascadeOnDelete();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            $table->decimal('monto', 14, 2);
            $table->timestamps();

            $table->unique(['cierre_id', 'inversion_id']);
        });

        Schema::create('cierres_inversion_pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_id')->constrained('cierres_inversion')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            $table->string('concepto', 40);
            $table->decimal('monto', 14, 2);
            $table->timestamps();

            $table->index(['cierre_id', 'user_id']);
            $table->index(['user_id', 'inversion_id']);
        });

        Schema::create('deuda_movimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('tipo', ['cargo', 'pago']);
            $table->decimal('monto', 14, 2);
            $table->string('descripcion', 500)->nullable();
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['inversion_id', 'user_id']);
        });

        Schema::table('inversion_user', function (Blueprint $table) {
            $table->boolean('tiene_deuda')->default(false)->after('user_id');
            $table->dropColumn('deuda');
        });
    }
};
