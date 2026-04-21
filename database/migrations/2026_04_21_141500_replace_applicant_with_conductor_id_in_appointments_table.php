<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn('applicant');
            $table->foreignId('conductor_id')
                ->nullable()
                ->after('license_plate')
                ->constrained('users')
                ->nullOnDelete();
            $table->index('conductor_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropForeign(['conductor_id']);
            $table->dropIndex(['conductor_id']);
            $table->dropColumn('conductor_id');
            $table->string('applicant')->nullable()->after('license_plate');
        });
    }
};
