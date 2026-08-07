<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pago del chofer para un acta del feed (parcial o total), con su comprobante.
 * Análogo a MultaPago.
 */
#[Fillable(['acta_id', 'monto', 'fecha', 'comprobante_path', 'con_deposito', 'registrado_por'])]
class ActaPago extends Model
{
    protected $table = 'acta_pagos';

    protected $casts = [
        'monto' => 'decimal:2',
        'fecha' => 'date',
        'con_deposito' => 'boolean',
    ];

    public function acta(): BelongsTo
    {
        return $this->belongsTo(Acta::class);
    }
}
