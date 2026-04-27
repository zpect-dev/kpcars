<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE appointments MODIFY status ENUM('agendado', 'en_proceso', 'completado', 'cancelado') DEFAULT 'agendado'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE appointments MODIFY status ENUM('agendado', 'en_proceso', 'completado') DEFAULT 'agendado'");
    }
};
