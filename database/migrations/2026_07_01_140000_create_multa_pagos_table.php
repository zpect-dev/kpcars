<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pagos del chofer para una multa. Cada pago (parcial o total) guarda su
     * monto, fecha y comprobante. multas.monto_cobrado se deriva de la suma.
     */
    public function up(): void
    {
        Schema::create('multa_pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('multa_id')->constrained('multas')->cascadeOnDelete();
            $table->decimal('monto', 12, 2);
            $table->date('fecha');
            $table->string('comprobante_path')->nullable();
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('multa_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('multa_pagos');
    }
};
