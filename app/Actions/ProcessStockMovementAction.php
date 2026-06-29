<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\AperturaCaja;
use App\Models\Articulo;
use App\Models\Cobro;
use App\Models\Scopes\TenantScope;
use App\Models\Transaccion;
use App\Models\Vehiculo;
use Exception;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ProcessStockMovementAction
{
    /**
     * Executes the stock movement (IN/OUT) within a database transaction.
     *
     * @param  string  $type  ('IN' or 'OUT')
     * @param  int  $quantity  The amount being added or consumed
     * @param  string|null  $licensePlate  Required only for OUT transactions
     *
     * @throws InvalidArgumentException
     * @throws Exception
     */
    public function execute(Articulo $articulo, string $type, int $quantity, ?string $licensePlate = null, ?string $solicitante = null, ?string $descripcion = null): void
    {
        DB::transaction(function () use ($articulo, $type, $quantity, $licensePlate, $solicitante, $descripcion) {
            $vehiculo = null;

            // Pessimistic lock to prevent concurrent oversell / lost updates
            $articulo = Articulo::whereKey($articulo->id)->lockForUpdate()->firstOrFail();

            if ($type === 'OUT') {
                if (empty($licensePlate)) {
                    throw new InvalidArgumentException('La patente es obligatoria para registrar un egreso de mercadería.');
                }

                if ($articulo->stock < $quantity) {
                    throw new Exception('Stock insuficiente para realizar esta operación.');
                }

                // Inventario es global: el carro destino puede ser de cualquier
                // empresa (el cobro se enruta a la empresa del carro, ver abajo).
                $vehiculo = Vehiculo::withoutGlobalScope(TenantScope::class)
                    ->where('patente', $licensePlate)
                    ->first();
                if (! $vehiculo) {
                    throw new Exception("El vehículo con patente {$licensePlate} no existe en la base de datos.");
                }
            }

            if ($type === 'IN') {
                $articulo->stock += $quantity;
            } elseif ($type === 'OUT') {
                $articulo->stock -= $quantity;
            } else {
                throw new InvalidArgumentException("Tipo de movimiento no válido. Se espera 'IN' o 'OUT'.");
            }

            $articulo->save();

            // Insertar historial append-only
            $transaccion = Transaccion::create([
                'articulo_id' => $articulo->id,
                'user_id' => auth()->id(),
                'vehiculo_id' => $vehiculo?->id,
                'solicitante' => $solicitante,
                'tipo' => $type,
                'cantidad' => $quantity,
                'descripcion' => $descripcion,
            ]);

            // Auto-generate cobro for OUT transactions to non-EXTERNO vehicles.
            // Los artículos de galpón (repuestos=false) nunca generan cobro:
            // son consumo interno, no se facturan a ningún vehículo.
            if ($type === 'OUT' && $vehiculo && $licensePlate !== 'EXTERNO' && $articulo->repuestos) {
                // No se puede registrar un cobro sin un período de caja abierto
                // en la empresa del vehículo (al que se enruta el cobro).
                if (! AperturaCaja::hayPeriodoAbierto($vehiculo->empresa_id)) {
                    throw new Exception('No hay un período de caja abierto para esta empresa. Abrí un período en Cobros antes de registrar el egreso.');
                }

                Cobro::create([
                    'inversion_id' => $vehiculo->inversion_id,
                    'transaccion_id' => $transaccion->id,
                    'empresa_id' => $vehiculo->empresa_id,
                ]);
            }
        });
    }
}
