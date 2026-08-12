<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\CajaChicaMovimientoTipo;
use App\Models\CajaChicaMovimiento;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Anula un movimiento de caja chica con un contraasiento (append-only: el
 * movimiento original nunca se borra ni se edita).
 */
class RevertirMovimientoCajaChicaAction
{
    /** @throws RuntimeException */
    public function execute(CajaChicaMovimiento $movimiento, ?string $nota = null, ?int $registradoPor = null): CajaChicaMovimiento
    {
        return DB::transaction(function () use ($movimiento, $nota, $registradoPor) {
            $movimiento = CajaChicaMovimiento::whereKey($movimiento->id)->lockForUpdate()->firstOrFail();

            if ($movimiento->revierte_id !== null) {
                throw new RuntimeException('Un contraasiento no se puede revertir; registrá un movimiento nuevo.');
            }

            // El descuento de un gasto se deshace borrando el gasto: así también
            // se deshace su distribución entre inversores.
            if ($movimiento->gasto_id !== null) {
                throw new RuntimeException('Ese movimiento vino de un gasto; eliminá el gasto para devolver la plata a la caja.');
            }

            if (CajaChicaMovimiento::where('revierte_id', $movimiento->id)->exists()) {
                throw new RuntimeException('Ese movimiento ya fue revertido.');
            }

            // Un período cerrado quedó congelado con el cierre de gastos: el
            // contraasiento cambiaría un saldo ya archivado.
            if ($movimiento->periodo->cerrado_at !== null) {
                throw new RuntimeException('Ese período de caja chica ya está cerrado; registrá el ajuste en el período actual.');
            }

            return CajaChicaMovimiento::create([
                // El contraasiento vive en el mismo período que el original.
                'periodo_id' => $movimiento->periodo_id,
                'tipo' => CajaChicaMovimientoTipo::AJUSTE->value,
                // Signo opuesto: deja el saldo como estaba antes del original.
                'monto' => round(-1 * (float) $movimiento->monto, 2),
                'fecha' => now()->toDateString(),
                'nota' => $nota ?? sprintf(
                    'Contraasiento del movimiento #%d (%s del %s)',
                    $movimiento->id,
                    $movimiento->tipo->label(),
                    $movimiento->fecha?->format('d/m/Y') ?? '—',
                ),
                'revierte_id' => $movimiento->id,
                'registrado_por' => $registradoPor ?? auth()->id(),
            ]);
        });
    }
}
