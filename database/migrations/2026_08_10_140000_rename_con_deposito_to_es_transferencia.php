<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Se elimina el "pago con depósito": el flag `con_deposito` de los pagos era, en
 * la práctica, el método de pago "transferencia" (el toggle de la UI seteaba
 * con_deposito=true para transferencia). El backend lo interpretaba como
 * descuento de la cuenta de garantía del chofer — incorrecto.
 *
 * Se renombra la columna a `es_transferencia` (true = transferencia, false =
 * efectivo). Los valores existentes ya son correctos: no se transforma dato.
 *
 * La reversa de los descuentos ya generados (devolver saldo al chofer) va aparte,
 * en el comando `multas:revertir-depositos`.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['multa_pagos', 'acta_pagos'] as $tabla) {
            if (Schema::hasColumn($tabla, 'con_deposito') && ! Schema::hasColumn($tabla, 'es_transferencia')) {
                Schema::table($tabla, function (Blueprint $table) {
                    $table->renameColumn('con_deposito', 'es_transferencia');
                });
            }
        }
    }

    public function down(): void
    {
        foreach (['multa_pagos', 'acta_pagos'] as $tabla) {
            if (Schema::hasColumn($tabla, 'es_transferencia') && ! Schema::hasColumn($tabla, 'con_deposito')) {
                Schema::table($tabla, function (Blueprint $table) {
                    $table->renameColumn('es_transferencia', 'con_deposito');
                });
            }
        }
    }
};
