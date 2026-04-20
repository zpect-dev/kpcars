<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Replaces service_type_id (FK) with a free-text service column.
     * SQLite requires a full table rebuild since it cannot drop columns
     * that are referenced by foreign keys.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            // SQLite: rebuild table without service_type_id
            Schema::dropIfExists('appointments');
            Schema::create('appointments', function (Blueprint $table) {
                $table->id();
                $table->string('service');
                $table->string('license_plate');
                $table->string('applicant');
                $table->date('scheduled_date');
                $table->string('status')->default('pending');
                $table->timestamps();
                $table->index(['scheduled_date', 'status']);
            });
        } else {
            Schema::table('appointments', function (Blueprint $table) {
                $table->dropForeign(['service_type_id']);
                $table->dropColumn('service_type_id');
                $table->string('service')->after('id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            Schema::dropIfExists('appointments');
            Schema::create('appointments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('service_type_id')->constrained()->restrictOnDelete();
                $table->string('license_plate');
                $table->string('applicant');
                $table->date('scheduled_date');
                $table->string('status')->default('pending');
                $table->timestamps();
                $table->index(['scheduled_date', 'status']);
            });
        } else {
            Schema::table('appointments', function (Blueprint $table) {
                $table->dropColumn('service');
                $table->foreignId('service_type_id')->constrained()->restrictOnDelete();
            });
        }
    }
};
