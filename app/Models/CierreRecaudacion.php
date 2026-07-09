<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[ScopedBy([TenantScope::class])]
class CierreRecaudacion extends Model
{
    protected $table = 'cierres_recaudacion';

    protected $fillable = [
        'empresa_id',
        'user_id',
        'cierre_sueldo_id',
    ];

    /**
     * Get the user who executed the closing.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the empresa this closing belongs to.
     */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * Get the recaudacion snapshots captured by this closing.
     */
    public function recaudaciones(): HasMany
    {
        return $this->hasMany(Recaudacion::class, 'cierre_id');
    }

    /**
     * Cierre de sueldos global que disparó este cierre de recaudación.
     */
    public function cierreSueldo(): BelongsTo
    {
        return $this->belongsTo(CierreSueldo::class, 'cierre_sueldo_id');
    }
}
