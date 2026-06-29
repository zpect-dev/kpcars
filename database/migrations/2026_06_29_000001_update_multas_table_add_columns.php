<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Idempotente: la versión actual de create_multas_table ya crea el
        // esquema completo (pagado, cobrado, fecha_vencimiento, etc. e índices).
        // Esta migración solo transforma el esquema LEGACY, que se reconoce por
        // tener todavía la columna 'pagada'. Si no existe, no hay nada que hacer.
        if (! Schema::hasColumn('multas', 'pagada')) {
            return;
        }

        Schema::table('multas', function (Blueprint $table) {
            $table->renameColumn('pagada', 'pagado');
        });

        Schema::table('multas', function (Blueprint $table) {
            if (! Schema::hasColumn('multas', 'fecha_vencimiento')) {
                $table->date('fecha_vencimiento')->nullable()->after('fecha');
            }
            if (! Schema::hasColumn('multas', 'punto_rojo')) {
                $table->boolean('punto_rojo')->default(false)->after('descripcion');
            }
            if (! Schema::hasColumn('multas', 'jurisdiccion')) {
                $table->string('jurisdiccion', 4)->nullable()->after('punto_rojo');
            }
            if (! Schema::hasColumn('multas', 'pdf_path')) {
                $table->string('pdf_path')->nullable()->after('jurisdiccion');
            }
            if (! Schema::hasColumn('multas', 'cobrado')) {
                $table->boolean('cobrado')->default(false)->after('pagado');
            }
        });

        // Índices nuevos (los viejos apuntaban a 'pagada', que ya no existe).
        Schema::table('multas', function (Blueprint $table) {
            $table->index(['vehiculo_id', 'pagado']);
            $table->index(['conductor_id', 'cobrado']);
        });
    }

    public function down(): void
    {
        // No-op en el esquema moderno: estas columnas e índices los define
        // create_multas_table, así que revertirlos acá lo corrompería. Solo
        // tiene sentido revertir si esta migración hizo el rename (esquema
        // legacy), caso que ya no se da en bases creadas desde cero.
    }
};
