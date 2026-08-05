<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla del NUEVO módulo experimental de multas alimentado por el feed externo
 * (resolvetusmultas). Es paralela a `multas` (registro manual) y no la toca: la
 * idea es transicionar del sistema viejo al nuevo sin romper el actual.
 *
 * Cada fila es una infracción individual del detalle de BSAS/CABA. Se identifica
 * por `clave` única (el nº de acta en BSAS; un hash sintético en CABA, que no
 * trae acta). Cuando una clave deja de aparecer en el feed se asume pagada en
 * origen y pasa a estado `resuelta`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('actas', function (Blueprint $table) {
            $table->id();

            // Vehículo de la flota (match por patente). Nullable por si el feed
            // trae una patente que todavía no está cargada como vehículo.
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();
            // Chofer imputado según la asignación vigente en la fecha de la
            // infracción (mismo criterio que las multas manuales).
            $table->foreignId('conductor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('patente')->index();
            $table->string('jurisdiccion', 8); // BSAS | CABA

            // Identificador único de la infracción. En BSAS es el nº de acta real;
            // en CABA es un hash de patente+fecha+motivo+monto (no trae acta).
            $table->string('clave')->unique();
            $table->string('acta')->nullable(); // acta real (solo BSAS)

            $table->text('motivo')->nullable();
            $table->decimal('monto', 12, 2)->nullable(); // CABA a veces no trae monto

            $table->date('fecha_infraccion')->nullable();
            $table->date('fecha_emision')->nullable(); // solo BSAS
            $table->date('fecha_vencimiento')->nullable();

            // vigente = sigue apareciendo en el feed; resuelta = desapareció (pagada).
            $table->string('estado', 12)->default('vigente');
            $table->date('vista_primera_en')->nullable();
            $table->date('vista_ultima_en')->nullable();
            $table->date('resuelta_en')->nullable();
            $table->date('snapshot_fecha')->nullable();

            // Item crudo del feed, para auditoría / reproceso.
            $table->json('raw')->nullable();

            $table->timestamps();

            $table->index(['estado', 'jurisdiccion']);
            $table->index(['patente', 'estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('actas');
    }
};
