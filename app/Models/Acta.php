<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Infracción individual del feed externo de multas (módulo experimental). Se
 * distingue por `clave` única. Es global (sin TenantScope): abarca toda la flota.
 *
 * Estado:
 *  - vigente:  sigue apareciendo en el último snapshot del feed.
 *  - resuelta: dejó de aparecer estando su patente presente => pagada en origen.
 */
#[Fillable([
    'vehiculo_id', 'conductor_id', 'patente', 'jurisdiccion', 'clave', 'acta', 'motivo', 'monto',
    'fecha_infraccion', 'fecha_emision', 'fecha_vencimiento',
    'estado', 'vista_primera_en', 'vista_ultima_en', 'resuelta_en', 'snapshot_fecha', 'raw',
])]
class Acta extends Model
{
    protected $casts = [
        'monto' => 'decimal:2',
        'fecha_infraccion' => 'date',
        'fecha_emision' => 'date',
        'fecha_vencimiento' => 'date',
        'vista_primera_en' => 'date',
        'vista_ultima_en' => 'date',
        'resuelta_en' => 'date',
        'snapshot_fecha' => 'date',
        'raw' => 'array',
    ];

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    /** Chofer imputado según la asignación vigente en la fecha de la infracción. */
    public function conductor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'conductor_id');
    }

    public function scopeVigente(Builder $query): void
    {
        $query->where('estado', 'vigente');
    }

    public function scopeResuelta(Builder $query): void
    {
        $query->where('estado', 'resuelta');
    }
}
