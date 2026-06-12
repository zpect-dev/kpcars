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
     * Documentos del vehículo:
     * - Cédula y Título: un PDF (con ambas caras) o dos imágenes (frente/dorso).
     * - Seguro: un único archivo (PDF o imagen) con su fecha de vencimiento.
     */
    public function up(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->string('cedula_pdf_path')->nullable()->after('fecha_vencimiento_gnc');
            $table->string('cedula_frente_path')->nullable()->after('cedula_pdf_path');
            $table->string('cedula_dorso_path')->nullable()->after('cedula_frente_path');

            $table->string('titulo_pdf_path')->nullable()->after('cedula_dorso_path');
            $table->string('titulo_frente_path')->nullable()->after('titulo_pdf_path');
            $table->string('titulo_dorso_path')->nullable()->after('titulo_frente_path');

            $table->string('seguro_path')->nullable()->after('titulo_dorso_path');
            $table->date('seguro_vencimiento')->nullable()->after('seguro_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            $table->dropColumn([
                'cedula_pdf_path',
                'cedula_frente_path',
                'cedula_dorso_path',
                'titulo_pdf_path',
                'titulo_frente_path',
                'titulo_dorso_path',
                'seguro_path',
                'seguro_vencimiento',
            ]);
        });
    }
};
