<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Transaccion;
use Illuminate\Support\Facades\DB;
use Exception;

class AnnulTransactionAction
{
    /**
     * Annuls a transaction and reverts the article's stock.
     */
    public function execute(Transaccion $transaction): void
    {
        DB::transaction(function () use ($transaction) {
            $articulo = $transaction->articulo;

            if (!$articulo) {
                throw new Exception('No se encontró el artículo asociado a la transacción.');
            }

            // Revert stock logic:
            // If it was an IN (incremented stock), we now decrement it.
            // If it was an OUT (decremented stock), we now increment it.
            if ($transaction->tipo === 'IN') {
                $articulo->stock -= $transaction->cantidad;
            } else {
                $articulo->stock += $transaction->cantidad;
            }

            $articulo->save();

            // Mark the transaction as inactive
            $transaction->update(['inactiva' => true]);
        });
    }
}
