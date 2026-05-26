<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['nombre', 'empresa_id'])]
#[ScopedBy([TenantScope::class])]
class Inversion extends Model
{
    public const MAX_INVERSORES = 6;

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

    /**
     * Inversores asignados (máximo MAX_INVERSORES por inversión).
     */
    public function inversores(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'inversion_user')
            ->withPivot(['tiene_deuda', 'es_financiador'])
            ->withTimestamps();
    }

    /**
     * Movimientos de deuda de todos los inversores en esta inversión.
     */
    public function deudaMovimientos(): HasMany
    {
        return $this->hasMany(DeudaMovimiento::class);
    }
}
