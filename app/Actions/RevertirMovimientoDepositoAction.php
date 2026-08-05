<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\DepositoMovimientoTipo;
use App\Models\UserDepositoMovimiento;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Anula un movimiento de depósito con un contraasiento (append-only: el
 * movimiento original nunca se borra ni se edita).
 */
class RevertirMovimientoDepositoAction
{
    /** @throws RuntimeException */
    public function execute(UserDepositoMovimiento $movimiento, ?string $nota = null, ?int $registradoPor = null): UserDepositoMovimiento
    {
        return DB::transaction(function () use ($movimiento, $nota, $registradoPor) {
            $movimiento = UserDepositoMovimiento::whereKey($movimiento->id)->lockForUpdate()->firstOrFail();

            if ($movimiento->revierte_id !== null) {
                throw new RuntimeException('Un contraasiento no se puede revertir; registrá un movimiento nuevo.');
            }

            if (UserDepositoMovimiento::where('revierte_id', $movimiento->id)->exists()) {
                throw new RuntimeException('Ese movimiento ya fue revertido.');
            }

            return UserDepositoMovimiento::create([
                'user_id' => $movimiento->user_id,
                'moneda' => $movimiento->moneda->value,
                'tipo' => DepositoMovimientoTipo::AJUSTE->value,
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
