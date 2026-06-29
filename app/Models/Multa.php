<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Multa de un vehículo. El conductor se imputa según la asignación activa en la
 * fecha de la infracción (snapshot al registrar). Es global (sin TenantScope):
 * abarca vehículos de todas las empresas.
 */
#[Fillable(['vehiculo_id', 'conductor_id', 'fecha', 'monto', 'descripcion', 'pagada', 'pagada_en', 'registrado_por'])]
class Multa extends Model
{
    protected $casts = [
        'fecha' => 'date',
        'monto' => 'decimal:2',
        'pagada' => 'boolean',
        'pagada_en' => 'datetime',
    ];

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function conductor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'conductor_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
