<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fecha en la que el chofer pagó la multa (se pide al marcarla como cobrada).
     */
    public function up(): void
    {
        Schema::table('multas', function (Blueprint $table) {
            $table->date('cobrada_en')->nullable()->after('cobrado');
        });
    }

    public function down(): void
    {
        Schema::table('multas', function (Blueprint $table) {
            $table->dropColumn('cobrada_en');
        });
    }
};
