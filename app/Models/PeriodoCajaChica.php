<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Período de la caja chica: acompaña al período de gastos.
 *
 * Se abre con la apertura de caja (ver {@see \App\Actions\AbrirCajaAction}) y se
 * cierra recién cuando ya no queda ninguna empresa con período abierto (ver
 * {@see \App\Actions\ProcessCierreCajaAction}). Es global: no lleva empresa, hay
 * un único período abierto a la vez para toda la operación.
 *
 * Cada período arranca en cero: el saldo NO se arrastra al siguiente.
 */
#[Fillable(['abierto_por', 'cerrado_por', 'cierre_caja_id', 'cerrado_at'])]
class PeriodoCajaChica extends Model
{
    protected $table = 'periodos_caja_chica';

    protected $casts = [
        'cerrado_at' => 'datetime',
    ];

    public function movimientos(): HasMany
    {
        return $this->hasMany(CajaChicaMovimiento::class, 'periodo_id');
    }

    public function abiertoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'abierto_por');
    }

    public function cerradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrado_por');
    }

    /** Cierre de caja que congeló el período (null mientras sigue abierto). */
    public function cierreCaja(): BelongsTo
    {
        return $this->belongsTo(CierreCaja::class, 'cierre_caja_id');
    }

    /** Scope: períodos todavía abiertos. */
    public function scopeAbierto(Builder $query): Builder
    {
        return $query->whereNull('cerrado_at');
    }

    /** Período abierto vigente, o null si no hay ninguno. */
    public static function actual(): ?self
    {
        return static::abierto()->latest('id')->first();
    }

    /**
     * Devuelve el período abierto y, si no hay, abre uno. Toma un lock para que
     * dos aperturas simultáneas no creen dos períodos.
     */
    public static function actualOAbrir(?int $userId = null): self
    {
        $periodo = static::abierto()->latest('id')->lockForUpdate()->first();

        return $periodo ?? static::create(['abierto_por' => $userId ?? auth()->id()]);
    }

    /** Saldo del período: suma de sus movimientos. Puede ser negativo. */
    public function saldo(): float
    {
        return round((float) $this->movimientos()->sum('monto'), 2);
    }

    /**
     * Totales del período separando lo que entró de lo que salió. `egresos` va
     * en positivo (es plata que salió), y saldo = ingresos - egresos.
     *
     * @return array{ingresos: float, egresos: float, saldo: float}
     */
    public function totales(): array
    {
        $ingresos = round((float) $this->movimientos()->where('monto', '>', 0)->sum('monto'), 2);
        $egresos = round(-1 * (float) $this->movimientos()->where('monto', '<', 0)->sum('monto'), 2);

        return [
            'ingresos' => $ingresos,
            'egresos' => $egresos,
            'saldo' => round($ingresos - $egresos, 2),
        ];
    }
}
