<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transacciones', function (Blueprint $table) {
            $table->id();
            
            $table->foreignId('articulo_id')->constrained('articulos');
            
            $table->foreignId('user_id')->constrained('users');
            
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos');
            
            $table->string('solicitante')->nullable();
            
            $table->enum('tipo', ['IN', 'OUT']);
            
            $table->integer('cantidad');
            
            $table->index('tipo');
            $table->index('created_at');
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transacciones');
    }
};
