<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Caja chica: fondo único y global (no por empresa) del que salen todos los
     * gastos, acotado al período de gastos.
     *
     * `periodos_caja_chica` acompaña a las aperturas de caja: se abre con la
     * primera apertura y se cierra recién cuando ya no queda ninguna empresa con
     * período abierto (en la práctica, con el cierre unificado). Cada período
     * arranca en cero: el saldo NO se arrastra.
     *
     * `caja_chica_movimientos` es el libro append-only del período, espejando a
     * `user_deposito_movimientos`: el saldo es la suma de los movimientos, nunca
     * un campo editable. Cada gasto deja su movimiento negativo (`gasto_id`), de
     * modo que el historial explica el saldo línea por línea.
     */
    public function up(): void
    {
        Schema::create('periodos_caja_chica', function (Blueprint $table) {
            $table->id();
            $table->foreignId('abierto_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cerrado_por')->nullable()->constrained('users')->nullOnDelete();
            // Cierre de caja que cerró el período (el de la última empresa que
            // cerró). Null mientras el período sigue abierto.
            $table->foreignId('cierre_caja_id')->nullable()->constrained('cierres_caja')->nullOnDelete();
            $table->timestamp('cerrado_at')->nullable();
            $table->timestamps();

            // Abierto = cerrado_at null. La unicidad del período abierto se
            // sostiene en código (lockForUpdate), no con un índice parcial.
            $table->index('cerrado_at');
        });

        Schema::create('caja_chica_movimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('periodo_id')->constrained('periodos_caja_chica')->cascadeOnDelete();
            $table->string('tipo', 20); // ingreso | gasto | retiro | ajuste
            // Firmado: positivo suma al saldo, negativo lo resta.
            $table->decimal('monto', 14, 2);
            // Fecha real del movimiento (puede diferir de created_at).
            $table->date('fecha');
            $table->string('nota', 255)->nullable();
            // Origen automático: gasto registrado. Se borra con el gasto porque
            // el gasto se elimina de verdad (no hay soft delete): si el gasto
            // desaparece, su descuento de caja también.
            $table->foreignId('gasto_id')->nullable()->constrained('gastos')->cascadeOnDelete();
            // Contraasiento: apunta al movimiento que este revierte.
            $table->foreignId('revierte_id')->nullable()->constrained('caja_chica_movimientos')->nullOnDelete();
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['periodo_id', 'fecha']);
            // Un gasto descuenta una sola vez; un movimiento se revierte una sola vez.
            $table->unique('gasto_id');
            $table->unique('revierte_id');
        });

        $this->backfillPeriodoEnCurso();
    }

    public function down(): void
    {
        Schema::dropIfExists('caja_chica_movimientos');
        Schema::dropIfExists('periodos_caja_chica');
    }

    /**
     * El período de gastos en curso ya venía corriendo sin caja chica: se abre
     * el período y se descuenta una vez cada gasto pendiente, con su fecha y su
     * detalle. El saldo queda en negativo hasta que se cargue la caja, que es
     * exactamente lo que refleja la realidad: esa plata ya se gastó.
     */
    private function backfillPeriodoEnCurso(): void
    {
        $aperturaAbierta = DB::table('aperturas_caja')
            ->whereNull('cierre_id')
            ->orderBy('created_at')
            ->first();

        // Sin período de caja abierto no hay nada que reconstruir: la caja chica
        // se abrirá con la próxima apertura.
        if ($aperturaAbierta === null) {
            return;
        }

        $periodoId = DB::table('periodos_caja_chica')->insertGetId([
            'abierto_por' => $aperturaAbierta->user_id,
            'created_at' => $aperturaAbierta->created_at ?? now(),
            'updated_at' => now(),
        ]);

        // Gastos todavía no archivados por un cierre: son los del período en curso.
        $pendientes = DB::table('gastos')
            ->leftJoin('vehiculos', 'gastos.vehiculo_id', '=', 'vehiculos.id')
            ->whereNull('gastos.cierre_gasto_id')
            ->orderBy('gastos.fecha')
            ->orderBy('gastos.id')
            ->get(['gastos.id', 'gastos.monto', 'gastos.fecha', 'gastos.tipo', 'gastos.descripcion', 'gastos.user_id', 'vehiculos.patente']);

        $now = now();
        $filas = $pendientes->map(fn ($g) => [
            'periodo_id' => $periodoId,
            'tipo' => 'gasto',
            'monto' => round(-1 * (float) $g->monto, 2),
            'fecha' => $g->fecha,
            'nota' => $this->nota($g),
            'gasto_id' => $g->id,
            'registrado_por' => $g->user_id,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        if ($filas !== []) {
            DB::table('caja_chica_movimientos')->insert($filas);
        }
    }

    /** Mismo formato que arma CreateGastoAction para los gastos nuevos. */
    private function nota(object $gasto): string
    {
        $etiqueta = $gasto->tipo === 'vehiculo'
            ? 'Vehículo '.($gasto->patente ?? '—')
            : ucfirst((string) $gasto->tipo);

        $descripcion = trim((string) ($gasto->descripcion ?? ''));

        return mb_substr(
            $descripcion !== '' ? $etiqueta.' — '.$descripcion : $etiqueta,
            0,
            255,
        );
    }
};
