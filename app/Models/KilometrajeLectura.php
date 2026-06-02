<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'vehiculo_id',
    'registrado_por',
    'kilometraje',
    'fecha',
])]
class KilometrajeLectura extends Model
{
    protected $table = 'kilometraje_lecturas';

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

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
