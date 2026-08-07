<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cobro al chofer para las actas del feed, en paralelo a lo que ya existe en las
 * multas manuales. El cobro es independiente del estado del feed: aunque el acta
 * figure pagada en el organismo (resuelta), el chofer puede seguir debiéndola.
 *
 *  - actas.cobrado / cobrada_en / monto_cobrado: estado agregado del cobro.
 *  - acta_pagos: cada pago del chofer (parcial o total) con su comprobante.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('actas', function (Blueprint $table) {
            $table->boolean('cobrado')->default(false)->after('resuelta_en');
            $table->date('cobrada_en')->nullable()->after('cobrado');
            $table->decimal('monto_cobrado', 12, 2)->default(0)->after('cobrada_en');
        });

        Schema::create('acta_pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('acta_id')->constrained('actas')->cascadeOnDelete();
            $table->decimal('monto', 12, 2);
            $table->date('fecha');
            $table->string('comprobante_path')->nullable();
            $table->boolean('con_deposito')->default(false);
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('acta_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('acta_pagos');

        Schema::table('actas', function (Blueprint $table) {
            $table->dropColumn(['cobrado', 'cobrada_en', 'monto_cobrado']);
        });
    }
};
