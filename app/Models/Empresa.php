<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['nombre'])]
class Empresa extends Model
{
    /**
     * Get all of the vehiculos for the Empresa.
     */
    public function vehiculos(): HasMany
    {
        return $this->hasMany(Vehiculo::class);
    }
}
