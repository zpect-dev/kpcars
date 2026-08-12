<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\CajaChicaMovimientoTipo;
use App\Models\CajaChicaMovimiento;
use App\Models\Gasto;
use App\Models\PeriodoCajaChica;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

/**
 * Registra un movimiento en la caja chica del período abierto.
 *
 * La caja es append-only: este es el único camino para alterar el saldo, y el
 * saldo siempre se recalcula sumando los movimientos del período.
 *
 * A diferencia del depósito del chofer, la caja chica SÍ puede quedar en
 * negativo: refleja plata ya gastada, y el rojo es la señal de que hay que
 * reponer el fondo.
 */
class RegistrarMovimientoCajaChicaAction
{
    /**
     * @param  float  $monto  Positivo para INGRESO/GASTO/RETIRO (el signo lo pone
     *                        el tipo). En AJUSTE se respeta el signo recibido.
     * @param  string  $fecha  Fecha real del movimiento (Y-m-d).
     *
     * @throws InvalidArgumentException|RuntimeException
     */
    public function execute(
        CajaChicaMovimientoTipo $tipo,
        float $monto,
        string $fecha,
        ?string $nota = null,
        ?Gasto $gasto = null,
        ?int $registradoPor = null,
        ?CajaChicaMovimiento $revierte = null,
    ): CajaChicaMovimiento {
        if (round(abs($monto), 2) < 0.01) {
            throw new InvalidArgumentException('El monto del movimiento no puede ser cero.');
        }

        if ($tipo === CajaChicaMovimientoTipo::AJUSTE && trim((string) $nota) === '') {
            throw new InvalidArgumentException('Los ajustes requieren una nota que explique la corrección.');
        }

        // El signo lo define el tipo; el ajuste conserva el que vino.
        $signo = $tipo->signo();
        $montoFirmado = round($signo === 0 ? $monto : $signo * abs($monto), 2);

        return DB::transaction(function () use ($tipo, $montoFirmado, $fecha, $nota, $gasto, $registradoPor, $revierte) {
            // El descuento de un gasto abre el período si hiciera falta: el gasto
            // ya exige una apertura de caja, así que la caja chica tiene que
            // existir sí o sí. Los movimientos manuales, en cambio, necesitan un
            // período ya abierto: sin gastos abiertos no hay caja que cargar.
            $periodo = $gasto !== null
                ? PeriodoCajaChica::actualOAbrir($registradoPor)
                : PeriodoCajaChica::actual();

            if ($periodo === null) {
                throw new RuntimeException('No hay un período de caja abierto. Abrí un período en Cobros antes de mover la caja chica.');
            }

            return CajaChicaMovimiento::create([
                'periodo_id' => $periodo->id,
                'tipo' => $tipo->value,
                'monto' => $montoFirmado,
                'fecha' => $fecha,
                'nota' => $nota !== null && trim($nota) !== '' ? trim($nota) : null,
                'gasto_id' => $gasto?->id,
                'revierte_id' => $revierte?->id,
                'registrado_por' => $registradoPor ?? auth()->id(),
            ]);
        });
    }
}
