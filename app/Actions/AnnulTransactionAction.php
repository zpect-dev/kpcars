<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Cobro;
use App\Models\Transaccion;
use Exception;
use Illuminate\Support\Facades\DB;

class AnnulTransactionAction
{
    /**
     * Annuls a transaction and reverts the article's stock.
     */
    public function execute(Transaccion $transaction): void
    {
        DB::transaction(function () use ($transaction) {
            // Guard: re-annulling would double-revert the stock
            if ($transaction->inactiva) {
                return;
            }

            $articulo = \App\Models\Articulo::whereKey($transaction->articulo_id)
                ->lockForUpdate()
                ->first();

            if (! $articulo) {
                throw new Exception('No se encontró el artículo asociado a la transacción.');
            }

            if ($transaction->tipo === 'IN') {
                $articulo->stock -= $transaction->cantidad;
            } else {
                $articulo->stock += $transaction->cantidad;
            }

            $articulo->save();

            // Mark the transaction as inactive
            $transaction->update(['inactiva' => true]);

            // Remove associated cobro if exists
            Cobro::where('transaccion_id', $transaction->id)->delete();
        });
    }
}
