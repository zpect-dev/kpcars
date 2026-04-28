<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'vehiculo_id',
    'revisado_por',
    'fecha_vencimiento_vtv',
    'fecha_vencimiento_gnc',
    'limpieza',
    'nivel_nafta',
    'kilometraje',
    'rueda_auxiliar',
    'kit_seguridad',
    'observaciones',
])]
class Revision extends Model
{
    protected $table = 'revisiones';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'fecha_vencimiento_vtv' => 'date',
            'fecha_vencimiento_gnc' => 'date',
            'kilometraje' => 'integer',
            'rueda_auxiliar' => 'boolean',
            'kit_seguridad' => 'boolean',
        ];
    }

    /**
     * Get the vehicle this revision belongs to.
     */
    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function revisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revisado_por');
    }
}
