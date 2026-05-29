<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'vehiculo_id',
    'realizado_por',
    'kilometraje',
    'fecha',
    'observaciones',
])]
class Service extends Model
{
    /**
     * Kilómetros entre un service y el siguiente.
     */
    public const INTERVALO_KM = 10000;

    protected function casts(): array
    {
        return [
            'kilometraje' => 'integer',
            'fecha' => 'date',
        ];
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function realizadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'realizado_por');
    }
}
