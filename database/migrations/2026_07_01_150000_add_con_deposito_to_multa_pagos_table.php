<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Marca si el pago del chofer se hizo con su depósito.
     */
    public function up(): void
    {
        Schema::table('multa_pagos', function (Blueprint $table) {
            $table->boolean('con_deposito')->default(false)->after('comprobante_path');
        });
    }

    public function down(): void
    {
        Schema::table('multa_pagos', function (Blueprint $table) {
            $table->dropColumn('con_deposito');
        });
    }
};
