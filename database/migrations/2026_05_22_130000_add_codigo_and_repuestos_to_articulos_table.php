<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articulos', function (Blueprint $table) {
            $table->string('codigo')->nullable()->after('descripcion');
            $table->boolean('repuestos')->default(false)->after('codigo');
        });
    }

    public function down(): void
    {
        Schema::table('articulos', function (Blueprint $table) {
            $table->dropColumn(['codigo', 'repuestos']);
        });
    }
};
