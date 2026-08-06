<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `transacciones.vehiculo_id` se creó con RESTRICT implícito, así que un
     * vehículo con movimientos de stock no se podía eliminar (SQLSTATE 23000).
     * Pasa a ON DELETE SET NULL: el historial de transacciones sobrevive al
     * vehículo. La patente queda estampada en `descripcion` desde el hook
     * `deleting` del modelo Vehiculo, que corre antes del borrado.
     */
    public function up(): void
    {
        // SQLite no soporta ALTER de claves foráneas; en tests el borrado ya
        // funciona porque el hook del modelo desvincula las filas antes.
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('transacciones', function (Blueprint $table) {
            $table->dropForeign(['vehiculo_id']);
            $table->foreign('vehiculo_id')->references('id')->on('vehiculos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('transacciones', function (Blueprint $table) {
            $table->dropForeign(['vehiculo_id']);
            $table->foreign('vehiculo_id')->references('id')->on('vehiculos');
        });
    }
};
