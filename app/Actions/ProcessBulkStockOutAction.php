<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Articulo;
use App\Models\Cobro;
use App\Models\Scopes\TenantScope;
use App\Models\Transaccion;
use App\Models\Vehiculo;
use Exception;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ProcessBulkStockOutAction
{
    /**
     * Procesa un pedido de salida (OUT) con múltiples artículos hacia un único
     * destino (un vehículo + un solicitante), de forma ATÓMICA: si alguna línea
     * no tiene stock suficiente, no se procesa nada.
     *
     * Inventario es global: el carro destino puede ser de cualquier empresa, y
     * cada cobro generado se enruta a la empresa del carro (no a la sesión).
     *
     * @param  array<int, array{articulo_id:int, cantidad:int}>  $lineas
     *
     * @throws InvalidArgumentException|Exception
     */
    public function execute(array $lineas, string $licensePlate, ?string $solicitante = null, ?string $descripcion = null): void
    {
        if (empty($lineas)) {
            throw new InvalidArgumentException('El pedido no contiene artículos.');
        }

        DB::transaction(function () use ($lineas, $licensePlate, $solicitante, $descripcion) {
            // El carro destino puede ser de cualquier empresa (inventario global).
            $vehiculo = Vehiculo::withoutGlobalScope(TenantScope::class)
                ->where('patente', $licensePlate)
                ->first();

            if (! $vehiculo) {
                throw new Exception("El vehículo con patente {$licensePlate} no existe en la base de datos.");
            }

            // 1. Lock + validación previa de TODO el stock (todo-o-nada).
            $articulos = [];
            foreach ($lineas as $linea) {
                $articuloId = (int) $linea['articulo_id'];
                $cantidad = (int) $linea['cantidad'];

                if ($cantidad < 1) {
                    throw new InvalidArgumentException('Las cantidades deben ser mayores a cero.');
                }

                $articulo = Articulo::whereKey($articuloId)->lockForUpdate()->first();
                if (! $articulo) {
                    throw new Exception("El artículo #{$articuloId} no existe.");
                }

                if ($articulo->stock < $cantidad) {
                    throw new Exception("Stock insuficiente para \"{$articulo->descripcion}\" (disponible: {$articulo->stock}, solicitado: {$cantidad}).");
                }

                $articulos[] = ['model' => $articulo, 'cantidad' => $cantidad];
            }

            // 2. Aplicar egresos (stock ya validado).
            foreach ($articulos as $row) {
                /** @var Articulo $articulo */
                $articulo = $row['model'];
                $cantidad = $row['cantidad'];

                $articulo->stock -= $cantidad;
                $articulo->save();

                $transaccion = Transaccion::create([
                    'articulo_id' => $articulo->id,
                    'user_id' => auth()->id(),
                    'vehiculo_id' => $vehiculo->id,
                    'solicitante' => $solicitante,
                    'tipo' => 'OUT',
                    'cantidad' => $cantidad,
                    'descripcion' => $descripcion,
                ]);

                // Cobro auto-generado para egresos a vehículos no-EXTERNO.
                // Los artículos de galpón (repuestos=false) nunca generan cobro:
                // son consumo interno, no se facturan a ningún vehículo.
                if ($licensePlate !== 'EXTERNO' && $articulo->repuestos) {
                    Cobro::create([
                        'inversion_id' => $vehiculo->inversion_id,
                        'transaccion_id' => $transaccion->id,
                        'empresa_id' => $vehiculo->empresa_id,
                    ]);
                }
            }
        });
    }
}
