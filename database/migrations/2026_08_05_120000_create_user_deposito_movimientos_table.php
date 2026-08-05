<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cuenta de depósito (garantía) del chofer: libro de movimientos append-only,
     * una cuenta por moneda (USD / ARS). El saldo es la suma de los movimientos,
     * nunca un campo editable.
     *
     * Reemplaza a `user_depositos`, que guardaba un único saldo por moneda y se
     * pisaba en cada edición (se perdía el historial y la fecha del movimiento).
     */
    public function up(): void
    {
        Schema::create('user_deposito_movimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('moneda', 3); // USD | ARS — cuenta a la que impacta
            $table->string('tipo', 20);  // ingreso | retiro | descuento_multa | ajuste
            // Firmado: positivo suma al saldo, negativo lo resta.
            $table->decimal('monto', 14, 2);
            // Fecha real del movimiento (puede diferir de created_at).
            $table->date('fecha');
            $table->string('nota', 255)->nullable();
            // Origen automático: pago de multa marcado "con depósito".
            $table->foreignId('multa_pago_id')->nullable()->constrained('multa_pagos')->nullOnDelete();
            // Contraasiento: apunta al movimiento que este revierte.
            $table->foreignId('revierte_id')->nullable()->constrained('user_deposito_movimientos')->nullOnDelete();
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'moneda']);
            $table->index('fecha');
            $table->index('multa_pago_id');
            // Un movimiento se revierte una sola vez.
            $table->unique('revierte_id');
        });

        // Los depósitos existentes pasan a ser el ingreso inicial de cada cuenta.
        if (Schema::hasTable('user_depositos')) {
            DB::table('user_depositos')
                ->orderBy('id')
                ->each(fn ($d) => DB::table('user_deposito_movimientos')->insert([
                    'user_id' => $d->user_id,
                    'moneda' => $d->moneda,
                    'tipo' => 'ingreso',
                    'monto' => $d->monto,
                    'fecha' => (string) substr((string) ($d->created_at ?? now()), 0, 10),
                    'nota' => 'Depósito inicial (migrado)',
                    'created_at' => $d->created_at ?? now(),
                    'updated_at' => $d->updated_at ?? now(),
                ]));

            Schema::drop('user_depositos');
        }
    }

    public function down(): void
    {
        Schema::create('user_depositos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('monto', 14, 2);
            $table->string('moneda', 3);
            $table->timestamps();

            $table->index('user_id');
        });

        // Vuelve al modelo viejo: un saldo consolidado por usuario y moneda.
        DB::table('user_deposito_movimientos')
            ->selectRaw('user_id, moneda, SUM(monto) as saldo')
            ->groupBy('user_id', 'moneda')
            ->havingRaw('SUM(monto) > 0')
            ->get()
            ->each(fn ($r) => DB::table('user_depositos')->insert([
                'user_id' => $r->user_id,
                'moneda' => $r->moneda,
                'monto' => $r->saldo,
                'created_at' => now(),
                'updated_at' => now(),
            ]));

        Schema::dropIfExists('user_deposito_movimientos');
    }
};
