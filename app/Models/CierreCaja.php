<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[ScopedBy([TenantScope::class])]
class CierreCaja extends Model
{
    protected $table = 'cierres_caja';

    protected $fillable = [
        'empresa_id',
        'user_id',
    ];

    /**
     * Get the user who executed the closing.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the detail snapshots for this closing (cobros de inventario).
     */
    public function detalles(): HasMany
    {
        return $this->hasMany(CierreDetalle::class, 'cierre_id');
    }

    /**
     * Apertura que este cierre cerró (null para cierres legacy sin apertura).
     */
    public function apertura(): HasOne
    {
        return $this->hasOne(AperturaCaja::class, 'cierre_id');
    }

    /**
     * Cierre de gastos asociado dentro del modelo unificado (null para cierres
     * legacy que sólo congelaban cobros).
     */
    public function cierreGasto(): HasOne
    {
        return $this->hasOne(CierreGasto::class, 'cierre_caja_id');
    }
}
