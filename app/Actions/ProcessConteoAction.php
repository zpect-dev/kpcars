<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Articulo;
use App\Models\Conteo;
use App\Models\ConteoLinea;
use App\Models\Transaccion;
use Exception;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ProcessConteoAction
{
    /**
     * Confirma una sesión de conteo físico de forma ATÓMICA.
     *
     * Por cada línea bloquea el artículo (lockForUpdate) y toma el snapshot del
     * stock esperado EN ESE INSTANTE (no en el preview), para no pisar egresos
     * concurrentes cargados mientras se contaba. La diferencia es
     * `fisico - esperado`:
     *  - Si hay diferencia, ajusta el stock al físico, exige motivo + nota y
     *    registra una transacción AJUSTE (cantidad con signo, sin vehículo).
     *  - Si no hay diferencia, sólo deja la línea de auditoría; no toca el stock.
     *
     * @param  array<int, array{articulo_id:int, fisico:int, motivo?:?string, nota?:?string}>  $lineas
     *
     * @throws InvalidArgumentException|Exception
     */
    public function execute(array $lineas, string $zona, ?string $observaciones = null): Conteo
    {
        if (empty($lineas)) {
            throw new InvalidArgumentException('El conteo no contiene artículos.');
        }

        if (! in_array($zona, Conteo::ZONAS, true)) {
            throw new InvalidArgumentException('Zona de conteo no válida.');
        }

        return DB::transaction(function () use ($lineas, $zona, $observaciones) {
            $conteo = Conteo::create([
                'user_id' => auth()->id(),
                'zona' => $zona,
                'observaciones' => $observaciones,
            ]);

            foreach ($lineas as $linea) {
                $articuloId = (int) $linea['articulo_id'];
                $fisico = (int) $linea['fisico'];

                if ($fisico < 0) {
                    throw new InvalidArgumentException('El conteo físico no puede ser negativo.');
                }

                $articulo = Articulo::whereKey($articuloId)->lockForUpdate()->first();
                if (! $articulo) {
                    throw new Exception("El artículo #{$articuloId} no existe.");
                }

                $esperado = (int) $articulo->stock;
                $diferencia = $fisico - $esperado;

                $motivo = null;
                $nota = null;
                $transaccionId = null;

                if ($diferencia !== 0) {
                    $motivo = trim((string) ($linea['motivo'] ?? ''));
                    $nota = trim((string) ($linea['nota'] ?? ''));

                    if ($motivo === '' || ! in_array($motivo, ConteoLinea::MOTIVOS, true)) {
                        throw new InvalidArgumentException("Falta el motivo del ajuste para \"{$articulo->descripcion}\".");
                    }

                    if ($nota === '') {
                        throw new InvalidArgumentException("Falta la nota del ajuste para \"{$articulo->descripcion}\".");
                    }

                    // El físico es la verdad: el stock queda en lo contado.
                    $articulo->stock = $fisico;
                    $articulo->save();

                    $transaccion = Transaccion::create([
                        'articulo_id' => $articulo->id,
                        'user_id' => auth()->id(),
                        'vehiculo_id' => null,
                        'solicitante' => null,
                        'tipo' => 'AJUSTE',
                        'cantidad' => $diferencia,
                        'descripcion' => $this->descripcionAjuste($motivo, $nota),
                    ]);

                    $transaccionId = $transaccion->id;
                }

                ConteoLinea::create([
                    'conteo_id' => $conteo->id,
                    'articulo_id' => $articulo->id,
                    'stock_esperado' => $esperado,
                    'stock_fisico' => $fisico,
                    'diferencia' => $diferencia,
                    'motivo' => $motivo,
                    'nota' => $nota,
                    'transaccion_id' => $transaccionId,
                ]);
            }

            return $conteo->load('lineas');
        });
    }

    /**
     * Arma la descripción del asiento AJUSTE que aparece en el historial.
     */
    private function descripcionAjuste(string $motivo, string $nota): string
    {
        $label = ConteoLinea::MOTIVO_LABELS[$motivo] ?? $motivo;

        return "Ajuste de conteo — {$label}: {$nota}";
    }
}
