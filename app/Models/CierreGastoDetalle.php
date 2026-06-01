<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CierreGastoDetalle extends Model
{
    protected $table = 'cierres_gastos_detalles';

    protected $fillable = [
        'cierre_gasto_id',
        'tipo',
        'vehiculo_id',
        'patente',
        'total',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
        ];
    }

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreGasto::class, 'cierre_gasto_id');
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }
}
