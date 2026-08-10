<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Tipo de movimiento en la cuenta de depósito (garantía) del chofer.
 *
 * La cuenta funciona como una cuenta bancaria: append-only. Los movimientos no
 * se editan ni se borran; un error se corrige con un contraasiento (AJUSTE).
 */
enum DepositoMovimientoTipo: string
{
    /** Entrega de depósito: inicial o refuerzo posterior. Suma al saldo. */
    case INGRESO = 'ingreso';

    /** Devolución al chofer (baja, rescisión, retiro parcial). Resta al saldo. */
    case RETIRO = 'retiro';

    /**
     * LEGACY: multa cobrada con depósito. La función se eliminó (el cobro ya no
     * descuenta la garantía). El tipo se conserva por los movimientos históricos
     * y sus contraasientos (ver comando `multas:revertir-depositos`). Resta al saldo.
     */
    case DESCUENTO_MULTA = 'descuento_multa';

    /** Corrección manual o contraasiento. Puede sumar o restar; exige nota. */
    case AJUSTE = 'ajuste';

    public function label(): string
    {
        return match ($this) {
            self::INGRESO => 'Ingreso',
            self::RETIRO => 'Retiro / devolución',
            self::DESCUENTO_MULTA => 'Descuento por multa',
            self::AJUSTE => 'Ajuste',
        };
    }

    /** Tipos que el usuario puede cargar a mano desde la UI. */
    public function esManual(): bool
    {
        return $this !== self::DESCUENTO_MULTA;
    }

    /** El monto se guarda firmado; este es el signo que fuerza cada tipo. */
    public function signo(): int
    {
        return match ($this) {
            self::INGRESO => 1,
            self::RETIRO, self::DESCUENTO_MULTA => -1,
            // El ajuste conserva el signo que envía quien lo registra.
            self::AJUSTE => 0,
        };
    }
}
