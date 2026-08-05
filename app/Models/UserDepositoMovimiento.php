<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DepositoMoneda;
use App\Enums\DepositoMovimientoTipo;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Movimiento de la cuenta de depósito (garantía) del chofer.
 *
 * Append-only: no se edita ni se borra. Para corregir se registra un
 * contraasiento (ver RevertirMovimientoDepositoAction). El `monto` va firmado:
 * positivo suma al saldo, negativo lo resta.
 */
#[Fillable(['user_id', 'moneda', 'tipo', 'monto', 'fecha', 'nota', 'multa_pago_id', 'revierte_id', 'registrado_por'])]
class UserDepositoMovimiento extends Model
{
    protected $table = 'user_deposito_movimientos';

    protected $casts = [
        'monto' => 'decimal:2',
        'fecha' => 'date',
        'moneda' => DepositoMoneda::class,
        'tipo' => DepositoMovimientoTipo::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    /** Pago de multa que originó el descuento, si el movimiento es automático. */
    public function multaPago(): BelongsTo
    {
        return $this->belongsTo(MultaPago::class);
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
}
