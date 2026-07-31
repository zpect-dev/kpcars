<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * La deuda del inversor pasa a estar denominada en DÓLARES (antes era un monto
 * en pesos). El abono la baja convirtiendo el sueldo en pesos a USD a la tasa
 * del cierre. Como los saldos viejos estaban en pesos y no hay una tasa única
 * confiable para convertirlos, se arranca de cero: las deudas se recargan en
 * USD desde Personal.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('inversion_user')->update(['deuda' => 0]);
    }

    public function down(): void
    {
        // Irreversible: el reset descarta los saldos en pesos previos.
    }
};
