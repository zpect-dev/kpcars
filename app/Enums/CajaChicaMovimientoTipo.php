<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Tipo de movimiento en la caja chica.
 *
 * La caja chica es un fondo único y global (no por empresa) del que salen todos
 * los gastos. Funciona como libro append-only: los movimientos no se editan ni
 * se borran, un error se corrige con un contraasiento (AJUSTE).
 */
enum CajaChicaMovimientoTipo: string
{
    /** Carga de plata a la caja: fondo inicial o reposición. Suma al saldo. */
    case INGRESO = 'ingreso';

    /** Salida automática al registrar un gasto. Resta al saldo. */
    case GASTO = 'gasto';

    /** Retiro de plata de la caja (devolución, traspaso a banco). Resta al saldo. */
    case RETIRO = 'retiro';

    /** Corrección manual o contraasiento. Puede sumar o restar; exige nota. */
    case AJUSTE = 'ajuste';

    public function label(): string
    {
        return match ($this) {
            self::INGRESO => 'Ingreso',
            self::GASTO => 'Gasto',
            self::RETIRO => 'Retiro',
            self::AJUSTE => 'Ajuste',
        };
    }

    /** Tipos que el usuario puede cargar a mano desde la UI. */
    public function esManual(): bool
    {
        return $this !== self::GASTO;
    }

    /** El monto se guarda firmado; este es el signo que fuerza cada tipo. */
    public function signo(): int
    {
        return match ($this) {
            self::INGRESO => 1,
            self::GASTO, self::RETIRO => -1,
            // El ajuste conserva el signo que envía quien lo registra.
            self::AJUSTE => 0,
        };
    }
}
