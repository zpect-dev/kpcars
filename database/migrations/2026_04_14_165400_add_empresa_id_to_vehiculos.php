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
        Schema::table('vehiculos', function (Blueprint $table) {
            // Renombrar la clave foránea antigua si aún existe con el nombre original
            if ($this->hasForeignKey('vehiculos', 'vehiculos_empresa_id_foreign')) {
                $table->dropForeign('vehiculos_empresa_id_foreign');
                $table->foreign('inversion_id')->references('id')->on('inversiones')->onDelete('cascade');
            }
            
            // Crear la nueva columna empresa_id si no existe
            if (!Schema::hasColumn('vehiculos', 'empresa_id')) {
                $table->foreignId('empresa_id')->nullable()->after('inversion_id')->constrained()->nullOnDelete();
            } else {
                // Si la columna ya existe pero falló la constraint en el paso anterior, intentamos agregarla
                // Nota: Laravel tirará error si el nombre del índice ya existe, así que lo manejamos
                try {
                    $table->foreign('empresa_id')->references('id')->on('empresas')->onDelete('set null');
                } catch (\Exception $e) {
                    // Probablemente ya existe
                }
            }
        });
    }

    protected function hasForeignKey(string $table, string $foreignKey): bool
    {
        $conn = Schema::getConnection();
        
        // SQLite doesn't have information_schema.TABLE_CONSTRAINTS in the same way
        if ($conn->getDriverName() === 'sqlite') {
            return false;
        }

        $dbName = $conn->getDatabaseName();
        
        $result = DB::select("
            SELECT COUNT(*) as count 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE CONSTRAINT_SCHEMA = '{$dbName}' 
            AND TABLE_NAME = '{$table}' 
            AND CONSTRAINT_NAME = '{$foreignKey}'
        ");
        
        return $result[0]->count > 0;
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vehiculos', function (Blueprint $table) {
            if (Schema::hasColumn('vehiculos', 'empresa_id')) {
                $table->dropConstrainedForeignId('empresa_id');
            }
            
            // Restaurar nombre de clave foránea original si existe
            try {
                $table->dropForeign(['inversion_id']);
                $table->foreign('inversion_id', 'vehiculos_empresa_id_foreign')->references('id')->on('inversiones')->onDelete('cascade');
            } catch (\Exception $e) {}
        });
    }
};
