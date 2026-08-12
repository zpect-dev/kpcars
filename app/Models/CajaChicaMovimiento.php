<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\CajaChicaMovimientoTipo;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Movimiento de la caja chica: fondo único y global (sin TenantScope, la caja
 * es una sola para todas las empresas), acotado a un {@see PeriodoCajaChica}.
 *
 * Append-only: no se edita ni se borra. Para corregir se registra un
 * contraasiento (ver RevertirMovimientoCajaChicaAction). El `monto` va firmado:
 * positivo suma al saldo, negativo lo resta.
 */
#[Fillable(['periodo_id', 'tipo', 'monto', 'fecha', 'nota', 'gasto_id', 'revierte_id', 'registrado_por'])]
class CajaChicaMovimiento extends Model
{
    protected $table = 'caja_chica_movimientos';

    protected $casts = [
        'monto' => 'decimal:2',
        'fecha' => 'date',
        'tipo' => CajaChicaMovimientoTipo::class,
    ];

    /** Período de caja chica al que pertenece el movimiento. */
    public function periodo(): BelongsTo
    {
        return $this->belongsTo(PeriodoCajaChica::class, 'periodo_id');
    }

    /** Gasto que originó el descuento, si el movimiento es automático. */
    public function gasto(): BelongsTo
    {
        return $this->belongsTo(Gasto::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    /** Movimiento original que este contraasiento revierte. */
    public function revierteA(): BelongsTo
    {
        return $this->belongsTo(self::class, 'revierte_id');
    }

    /** Contraasiento que anuló este movimiento (si ya fue revertido). */
    public function reversion(): HasOne
    {
        return $this->hasOne(self::class, 'revierte_id');
    }

    /** Movimientos en el orden del extracto: por fecha y, a igual fecha, por alta. */
    public function scopeOrdenExtracto(Builder $query): Builder
    {
        return $query->orderBy('fecha')->orderBy('id');
    }

    /**
     * Saldo de la caja en el período abierto: suma de sus movimientos. Cero si
     * no hay período abierto (cada período arranca en cero, no se arrastra).
     * Puede quedar en negativo (se gastó más de lo cargado); la vista lo marca
     * en rojo.
     */
    public static function saldo(): float
    {
        return PeriodoCajaChica::actual()?->saldo() ?? 0.0;
    }
}
