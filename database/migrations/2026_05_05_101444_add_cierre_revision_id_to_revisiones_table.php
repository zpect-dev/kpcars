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
        Schema::table('revisiones', function (Blueprint $table) {
            $table->foreignId('cierre_revision_id')->nullable()->after('id')->constrained('cierres_revisiones')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('revisiones', function (Blueprint $table) {
            $table->dropForeign(['cierre_revision_id']);
            $table->dropColumn('cierre_revision_id');
        });
    }
};
