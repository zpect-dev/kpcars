<?php

declare(strict_types=1);

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
        Schema::table('revisiones_mecanicas', function (Blueprint $table) {
            $table->text('observaciones')->nullable()->after('items');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('revisiones_mecanicas', function (Blueprint $table) {
            $table->dropColumn('observaciones');
        });
    }
};
