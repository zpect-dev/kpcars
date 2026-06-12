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
     * Documentos del usuario (licencia y DNI). Cada documento puede guardarse
     * como un único PDF (que contiene ambas caras) o como dos imágenes
     * (frente y dorso). Sólo una de las dos modalidades aplica por documento.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('licencia_pdf_path')->nullable()->after('fecha_vencimiento_licencia');
            $table->string('licencia_frente_path')->nullable()->after('licencia_pdf_path');
            $table->string('licencia_dorso_path')->nullable()->after('licencia_frente_path');

            $table->string('dni_pdf_path')->nullable()->after('licencia_dorso_path');
            $table->string('dni_frente_path')->nullable()->after('dni_pdf_path');
            $table->string('dni_dorso_path')->nullable()->after('dni_frente_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'licencia_pdf_path',
                'licencia_frente_path',
                'licencia_dorso_path',
                'dni_pdf_path',
                'dni_frente_path',
                'dni_dorso_path',
            ]);
        });
    }
};
