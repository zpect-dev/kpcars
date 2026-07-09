<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CierreSueldoPago extends Model
{
    public const CONCEPTO_PARTE_COMPLETA = 'parte_completa';
    public const CONCEPTO_MEDIA_PARTE_DEUDOR = 'media_parte_deudor';
    public const CONCEPTO_CERO_DEUDOR = 'cero_deudor';
    public const CONCEPTO_REDISTRIBUCION = 'redistribucion_financiador';

    protected $table = 'cierre_sueldo_pagos';

    protected $fillable = [
        'cierre_sueldo_id',
        'user_id',
        'inversion_id',
        'empresa_id',
        'concepto',
        'monto',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
        ];
    }

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreSueldo::class, 'cierre_sueldo_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function inversion(): BelongsTo
    {
        return $this->belongsTo(Inversion::class);
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }
}
