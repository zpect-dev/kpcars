<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('revisiones', function (Blueprint $table): void {
            $table->boolean('sticker')->default(false)->after('kit_seguridad');
        });
    }

    public function down(): void
    {
        Schema::table('revisiones', function (Blueprint $table): void {
            $table->dropColumn('sticker');
        });
    }
};
