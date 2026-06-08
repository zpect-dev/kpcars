<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reinicia el módulo de recaudaciones DESDE 0:
     *  1. Asegura que el esquema de apertura exista (idempotente), por si la
     *     migración de borrado 2026_06_06 llegó a aplicarse en producción.
     *  2. Vacía por completo recaudaciones, aperturas y cierres (IDs a 1).
     *
     * Se ejecuta una sola vez al desplegar. En bases nuevas no hay nada que
     * vaciar, así que solo deja el esquema listo.
     */
    public function up(): void
    {
        // 1. Tabla de aperturas (si fue borrada por la reversión).
        if (! Schema::hasTable('aperturas_recaudacion')) {
            Schema::create('aperturas_recaudacion', function (Blueprint $table) {
                $table->id();
                $table->foreignId('empresa_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->foreignId('cierre_id')->nullable()->constrained('cierres_recaudacion')->nullOnDelete();
                $table->timestamps();

                $table->index(['empresa_id', 'cierre_id']);
            });
        }

        // 2. Columnas en recaudaciones (snapshot de chofer y vínculo a apertura).
        Schema::table('recaudaciones', function (Blueprint $table) {
            if (! Schema::hasColumn('recaudaciones', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('vehiculo_id')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('recaudaciones', 'apertura_id')) {
                $table->foreignId('apertura_id')->nullable()->after('cierre_id')
                    ->constrained('aperturas_recaudacion')->nullOnDelete();

                $table->index(['apertura_id']);
            }
        });

        // 3. Vaciar TODO (período abierto + historial). Orden seguro con las FKs
        //    desactivadas temporalmente; truncate reinicia los IDs a 1.
        Schema::disableForeignKeyConstraints();
        try {
            DB::table('recaudaciones')->truncate();
            DB::table('aperturas_recaudacion')->truncate();
            DB::table('cierres_recaudacion')->truncate();
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }

    public function down(): void
    {
        // Intencionalmente vacío: el reinicio de datos no se revierte.
    }
};
