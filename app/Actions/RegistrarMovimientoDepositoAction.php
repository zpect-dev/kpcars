<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\DepositoMoneda;
use App\Enums\DepositoMovimientoTipo;
use App\Models\MultaPago;
use App\Models\User;
use App\Models\UserDepositoMovimiento;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

/**
 * Registra un movimiento en la cuenta de depósito del chofer.
 *
 * La cuenta es append-only: este es el único camino para alterar el saldo, y el
 * saldo siempre se recalcula sumando los movimientos de esa moneda.
 */
class RegistrarMovimientoDepositoAction
{
    /**
     * @param  float  $monto  Positivo para INGRESO/RETIRO/DESCUENTO_MULTA (el
     *                        signo lo pone el tipo). En AJUSTE se respeta el
     *                        signo recibido.
     * @param  string  $fecha  Fecha real del movimiento (Y-m-d).
     *
     * @throws InvalidArgumentException|RuntimeException
     */
    public function execute(
        User $user,
        DepositoMovimientoTipo $tipo,
        DepositoMoneda $moneda,
        float $monto,
        string $fecha,
        ?string $nota = null,
        ?MultaPago $pago = null,
        ?int $registradoPor = null,
        ?UserDepositoMovimiento $revierte = null,
    ): UserDepositoMovimiento {
        if (round(abs($monto), 2) < 0.01) {
            throw new InvalidArgumentException('El monto del movimiento no puede ser cero.');
        }

        if ($tipo === DepositoMovimientoTipo::AJUSTE && trim((string) $nota) === '') {
            throw new InvalidArgumentException('Los ajustes requieren una nota que explique la corrección.');
        }

        // El signo lo define el tipo; el ajuste conserva el que vino.
        $signo = $tipo->signo();
        $montoFirmado = round($signo === 0 ? $monto : $signo * abs($monto), 2);

        return DB::transaction(function () use ($user, $tipo, $moneda, $montoFirmado, $fecha, $nota, $pago, $registradoPor, $revierte) {
            // Lock de la cuenta (usuario + moneda) para que dos egresos
            // simultáneos no lean el mismo saldo.
            $saldo = (float) UserDepositoMovimiento::query()
                ->where('user_id', $user->id)
                ->where('moneda', $moneda->value)
                ->lockForUpdate()
                ->sum('monto');

            // Un retiro no puede dejar la cuenta en rojo: es una devolución de
            // plata que el chofer tiene depositada. El descuento por multa sí
            // puede (refleja un hecho ya ocurrido) y queda marcado como saldo
            // negativo en la vista.
            if ($tipo === DepositoMovimientoTipo::RETIRO && round($saldo + $montoFirmado, 2) < 0) {
                throw new RuntimeException(sprintf(
                    'Saldo insuficiente: la cuenta en %s tiene %s disponible.',
                    $moneda->value,
                    number_format($saldo, 2, ',', '.'),
                ));
            }

            return UserDepositoMovimiento::create([
                'user_id' => $user->id,
                'moneda' => $moneda->value,
                'tipo' => $tipo->value,
                'monto' => $montoFirmado,
                'fecha' => $fecha,
                'nota' => $nota !== null && trim($nota) !== '' ? trim($nota) : null,
                'multa_pago_id' => $pago?->id,
                'revierte_id' => $revierte?->id,
                'registrado_por' => $registradoPor ?? auth()->id(),
            ]);
        });
    }
}
