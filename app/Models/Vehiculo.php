<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['patente', 'marca', 'modelo', 'anio', 'propietario', 'user_id', 'inversion_id', 'empresa_id', 'fecha_vencimiento_vtv', 'fecha_vencimiento_gnc'])]
#[ScopedBy([TenantScope::class])]
class Vehiculo extends Model
{
    use HasFactory;
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
        ];
    }

    /**
     * Get the user that is assigned to the vehicle.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the inversion that owns the vehicle.
     */
    public function inversion(): BelongsTo
    {
        return $this->belongsTo(Inversion::class);
    }

    /**
     * Get the empresa that owns the vehicle.
     */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * Get the assignment history for the vehicle.
     */
    public function asignaciones(): HasMany
    {
        return $this->hasMany(Asignacion::class)->orderByDesc('fecha_inicio');
    }

    /**
     * Get the revision history for the vehicle.
     */
    public function revisiones(): HasMany
    {
        return $this->hasMany(Revision::class)->orderByDesc('created_at');
    }

    public function latestRevision(): HasOne
    {
        return $this->hasOne(Revision::class)->latestOfMany();
    }
}
