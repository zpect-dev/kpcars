<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->enum('type', ['normal', 'emergencia'])->default('normal')->after('service');
            $table->index(['scheduled_date', 'type', 'status'], 'appointments_date_type_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropIndex('appointments_date_type_status_idx');
            $table->dropColumn('type');
        });
    }
};
