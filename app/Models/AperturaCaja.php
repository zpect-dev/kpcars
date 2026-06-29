<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Apertura de un período unificado de caja (cobros de inventario + gastos).
 * Mientras `cierre_id` sea null, el período está abierto. Un único cierre lo
 * congela y abre paso a una nueva apertura. Espeja a {@see AperturaRecaudacion}.
 */
#[ScopedBy([TenantScope::class])]
class AperturaCaja extends Model
{
    protected $table = 'aperturas_caja';

    protected $fillable = [
        'empresa_id',
        'user_id',
        'cierre_id',
    ];

    /**
     * Usuario que abrió el período.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Empresa a la que pertenece la apertura.
     */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * Cierre que cerró esta apertura (null = sigue abierta).
     */
    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreCaja::class, 'cierre_id');
    }

    /**
     * Scope: aperturas todavía abiertas (no cerradas).
     */
    public function scopeAbierta(Builder $query): Builder
    {
        return $query->whereNull('cierre_id');
    }

    /**
     * ¿Hay un período de caja abierto para esa empresa? Ignora el TenantScope
     * porque el cobro/gasto puede pertenecer a una empresa distinta de la activa
     * (inventario global enruta el cobro a la empresa del vehículo). Sin empresa
     * definida no se puede registrar, así que devuelve false.
     */
    public static function hayPeriodoAbierto(?int $empresaId): bool
    {
        if ($empresaId === null) {
            return false;
        }

        return static::withoutGlobalScope(TenantScope::class)
            ->where('empresa_id', $empresaId)
            ->whereNull('cierre_id')
            ->exists();
    }
}
