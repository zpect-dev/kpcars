<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pago del chofer para una multa (parcial o total), con su comprobante.
 */
#[Fillable(['multa_id', 'monto', 'fecha', 'comprobante_path', 'con_deposito', 'registrado_por'])]
class MultaPago extends Model
{
    protected $table = 'multa_pagos';

    protected $casts = [
        'monto' => 'decimal:2',
        'fecha' => 'date',
        'con_deposito' => 'boolean',
    ];

    public function multa(): BelongsTo
    {
        return $this->belongsTo(Multa::class);
    }
}
