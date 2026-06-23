<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * El costo es el valor de compra del repuesto. El precio de venta se
     * calcula automáticamente sumándole un 45% (precio = costo * 1.45). Se
     * deja nullable a propósito: los artículos existentes conservan su precio
     * cargado a mano hasta que se les ingrese un costo.
     */
    public function up(): void
    {
        Schema::table('articulos', function (Blueprint $table) {
            $table->decimal('costo', 12, 2)->nullable()->after('min_stock');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('articulos', function (Blueprint $table) {
            $table->dropColumn('costo');
        });
    }
};
