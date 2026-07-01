<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DepositoMoneda;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Depósito (garantía) del chofer en una moneda (USD / ARS).
 */
#[Fillable(['user_id', 'monto', 'moneda'])]
class UserDeposito extends Model
{
    protected $table = 'user_depositos';

    protected $casts = [
        'monto' => 'decimal:2',
        'moneda' => DepositoMoneda::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
