<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            // SQLite no soporta ALTER COLUMN ni ENUM — la columna ya es string internamente
            return;
        }

        DB::statement("ALTER TABLE appointments MODIFY status ENUM('agendado', 'en_proceso', 'completado') DEFAULT 'agendado'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE appointments MODIFY status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending'");
    }
};
