<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cierres_inversion', function (Blueprint $table) {
            // Tasa de conversión ARS → USD aplicada en este cierre (ARS por 1 USD)
            $table->decimal('tasa', 14, 4)->nullable()->after('total_recaudado');
        });
    }

    public function down(): void
    {
        Schema::table('cierres_inversion', function (Blueprint $table) {
            $table->dropColumn('tasa');
        });
    }
};
