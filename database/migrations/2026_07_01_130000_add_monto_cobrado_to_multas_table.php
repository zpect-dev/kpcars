<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Monto acumulado que el chofer ya pagó de la multa. Permite pagos parciales:
     * la multa queda 'cobrada' solo cuando lo pagado alcanza el total a cobrar.
     */
    public function up(): void
    {
        Schema::table('multas', function (Blueprint $table) {
            $table->decimal('monto_cobrado', 12, 2)->default(0)->after('cobrada_en');
        });
    }

    public function down(): void
    {
        Schema::table('multas', function (Blueprint $table) {
            $table->dropColumn('monto_cobrado');
        });
    }
};
