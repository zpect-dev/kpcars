<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[ScopedBy([TenantScope::class])]
class AperturaRecaudacion extends Model
{
    protected $table = 'aperturas_recaudacion';

    protected $fillable = [
        'empresa_id',
        'user_id',
        'cierre_id',
    ];

    /**
     * Get the user who opened the recaudacion period.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the empresa this apertura belongs to.
     */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * Get the cierre that closed this apertura (null = still open).
     */
    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreRecaudacion::class, 'cierre_id');
    }

    /**
     * Get the recaudacion rows captured by this apertura.
     */
    public function recaudaciones(): HasMany
    {
        return $this->hasMany(Recaudacion::class, 'apertura_id');
    }

    /**
     * Scope: aperturas still open (not yet closed).
     */
    public function scopeAbierta(Builder $query): Builder
    {
        return $query->whereNull('cierre_id');
    }
}
