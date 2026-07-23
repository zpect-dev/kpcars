<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Soft deletes en multas: permite "deshacer" una eliminación (restore) sin
     * perder los pagos ni el PDF asociados. Las consultas normales excluyen las
     * multas eliminadas automáticamente via el trait SoftDeletes.
     */
    public function up(): void
    {
        Schema::table('multas', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('multas', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
