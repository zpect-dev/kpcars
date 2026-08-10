<?php

declare(strict_types=1);

use App\Support\GeneradorCodigoArticulo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Asigna a cada artículo un código interno corto y único: familia (3 primeras
 * letras del tipo) + correlativo dentro de esa familia (AMO-01, FIL-03). Es el
 * código que se anota en papel y se tipea desde el celular.
 *
 * Los códigos cargados a mano que no siguen ese formato (números de pieza del
 * proveedor) se reemplazan: el inventario usa un único esquema de códigos.
 */
return new class extends Migration
{
    /** Formato del código corto: 2-3 letras/dígitos + guion + 2 dígitos. */
    private const PATRON_CORTO = '/^[A-Z0-9]{2,3}-\d{2,}$/';

    public function up(): void
    {
        $usados = [];

        // 1. Se conservan sólo los códigos que ya siguen el formato corto
        //    (el primero gana si hubiera duplicados). El resto se descarta.
        DB::table('articulos')
            ->whereNotNull('codigo')
            ->where('codigo', '!=', '')
            ->orderBy('id')
            ->get(['id', 'codigo'])
            ->each(function ($fila) use (&$usados) {
                $codigo = strtoupper(trim((string) $fila->codigo));

                if (! preg_match(self::PATRON_CORTO, $codigo) || isset($usados[$codigo])) {
                    DB::table('articulos')->where('id', $fila->id)->update(['codigo' => null]);

                    return;
                }

                $usados[$codigo] = true;
                DB::table('articulos')->where('id', $fila->id)->update(['codigo' => $codigo]);
            });

        // 2. Todos los que quedaron sin código reciben uno nuevo.
        DB::table('articulos')
            ->where(fn ($q) => $q->whereNull('codigo')->orWhere('codigo', ''))
            ->orderBy('descripcion')
            ->get(['id', 'descripcion'])
            ->each(function ($fila) use (&$usados) {
                $codigo = GeneradorCodigoArticulo::corto(
                    (string) $fila->descripcion,
                    fn (string $c) => isset($usados[$c]),
                );
                $usados[$codigo] = true;

                DB::table('articulos')->where('id', $fila->id)->update(['codigo' => $codigo]);
            });

        // 3. Recién ahora el código puede ser obligatorio y único.
        Schema::table('articulos', function (Blueprint $table) {
            $table->string('codigo', 32)->nullable(false)->change();
            $table->unique('codigo');
        });
    }

    public function down(): void
    {
        Schema::table('articulos', function (Blueprint $table) {
            $table->dropUnique(['codigo']);
            $table->string('codigo')->nullable()->change();
        });
    }
};
