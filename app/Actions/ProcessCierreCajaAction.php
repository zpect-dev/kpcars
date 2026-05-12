<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\CierreCaja;
use App\Models\CierreDetalle;
use App\Models\Cobro;
use Illuminate\Support\Facades\DB;

class ProcessCierreCajaAction
{
    /**
     * Executes the cash register closing within a database transaction.
     *
     * 1. Calculates totals per inversion for pending cobros.
     * 2. Creates a CierreCaja record.
     * 3. Creates CierreDetalle snapshots per inversion.
     *
     * @return CierreCaja The newly created cierre.
     */
    public function execute(): CierreCaja
    {
        return DB::transaction(function () {
            // Calculate totals per inversion+empresa for pending cobros.
            // lockForUpdate prevents two concurrent cierres from snapshotting the same cobros.
            $totals = Cobro::query()
                ->pendientes()
                ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
                ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
                ->selectRaw('cobros.inversion_id, cobros.empresa_id, SUM(articulos.precio * transacciones.cantidad) as total')
                ->groupBy('cobros.inversion_id', 'cobros.empresa_id')
                ->lockForUpdate()
                ->get();

            // Create the cierre record
            $cierre = CierreCaja::create([
                'user_id' => auth()->id(),
            ]);

            // Create snapshot details per inversion+empresa
            foreach ($totals as $row) {
                CierreDetalle::create([
                    'cierre_id' => $cierre->id,
                    'inversion_id' => $row->inversion_id,
                    'empresa_id' => $row->empresa_id,
                    'total' => $row->total,
                ]);
            }

            return $cierre;
        });
    }
}
