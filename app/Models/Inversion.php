<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['nombre', 'empresa_id'])]
class Inversion extends Model
{
    protected $table = 'inversiones';

    /**
     * Get the empresa that owns this inversion.
     */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * Get all of the vehicles for the Inversion.
     */
    public function vehiculos(): HasMany
    {
        return $this->hasMany(Vehiculo::class);
    }

    /**
     * Get all of the cobros for the Inversion.
     */
    public function cobros(): HasMany
    {
        return $this->hasMany(Cobro::class);
    }
}
