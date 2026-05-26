<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Data migration: traslada la semántica de absoluto + empresa_acceso al nuevo modelo.
     *
     *  - administrador con absoluto=false  →  rol 'administrativo' (acceso limitado).
     *  - cualquier admin/administrativo con empresa_acceso IN (1, 2)  →  empresa_default_id := empresa_acceso.
     *  - inversor con empresa_id  →  empresa_default_id := empresa_id.
     */
    public function up(): void
    {
        DB::transaction(function () {
            // 1) Admin no-absoluto pasa a administrativo.
            DB::table('users')
                ->where('role', 'administrador')
                ->where('absoluto', false)
                ->update(['role' => 'administrativo']);

            // 2) Si tenían empresa_acceso = 1 o 2, ese ID se vuelve su default al loguearse.
            DB::table('users')
                ->whereIn('role', ['administrador', 'administrativo'])
                ->whereIn('empresa_acceso', [1, 2])
                ->update([
                    'empresa_default_id' => DB::raw('empresa_acceso'),
                ]);

            // 3) Inversores: heredan su empresa_id como default (siempre vieron una sola empresa).
            DB::table('users')
                ->where('role', 'inversor')
                ->whereNotNull('empresa_id')
                ->update([
                    'empresa_default_id' => DB::raw('empresa_id'),
                ]);
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            // Revertir administrativo → administrador (preservando absoluto=false que aún existe).
            DB::table('users')
                ->where('role', 'administrativo')
                ->update(['role' => 'administrador']);

            // Limpiar empresa_default_id.
            DB::table('users')->update(['empresa_default_id' => null]);
        });
    }
};
