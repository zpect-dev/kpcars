<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Articulo;
use App\Models\Transaccion;
use App\Models\Vehiculo;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Exception;

class ProcessStockMovementAction
{
    /**
     * Executes the stock movement (IN/OUT) within a database transaction.
     * 
     * @param Articulo $articulo
     * @param string $type ('IN' or 'OUT')
     * @param int $quantity The amount being added or consumed
     * @param string|null $licensePlate Required only for OUT transactions
     * @return void
     * 
     * @throws InvalidArgumentException
     * @throws Exception
     */
    public function execute(Articulo $articulo, string $type, int $quantity, ?string $licensePlate = null, ?string $solicitante = null, ?string $descripcion = null): void
    {
        DB::transaction(function () use ($articulo, $type, $quantity, $licensePlate, $solicitante, $descripcion) {
            $vehiculoId = null;

            if ($type === 'OUT') {
                if (empty($licensePlate)) {
                    throw new InvalidArgumentException('La patente es obligatoria para registrar un egreso de mercadería.');
                }

                if ($articulo->stock < $quantity) {
                    throw new Exception('Stock insuficiente para realizar esta operación.');
                }
                
                // Lookup vehicle based on licensePlate
                $vehiculo = Vehiculo::where('patente', $licensePlate)->first();
                if (!$vehiculo) {
                    throw new Exception("El vehículo con patente {$licensePlate} no existe en la base de datos.");
                }
                $vehiculoId = $vehiculo->id;
            }

            // Append-only constraint dictates we register transaction concurrently with stock update
            if ($type === 'IN') {
                $articulo->stock += $quantity;
            } elseif ($type === 'OUT') {
                $articulo->stock -= $quantity;
            } else {
                throw new InvalidArgumentException("Tipo de movimiento no válido. Se espera 'IN' o 'OUT'.");
            }

            $articulo->save();

            // Insertar historial append-only
            Transaccion::create([
                'articulo_id' => $articulo->id,
                'user_id' => auth()->id(),
                'vehiculo_id' => $vehiculoId,
                'solicitante' => $solicitante,
                'tipo' => $type,
                'cantidad' => $quantity,
                'descripcion' => $descripcion,
            ]);
        });
    }
}
