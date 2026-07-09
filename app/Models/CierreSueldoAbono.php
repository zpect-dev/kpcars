<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Abono de deuda registrado en el modal del cierre de sueldos.
 * Es la foto de lo descontado; el saldo vivo está en inversion_user.deuda.
 */
class CierreSueldoAbono extends Model
{
    protected $table = 'cierre_sueldo_abonos';

    protected $fillable = [
        'cierre_sueldo_id',
        'user_id',
        'inversion_id',
        'monto',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
        ];
    }

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreSueldo::class, 'cierre_sueldo_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function inversion(): BelongsTo
    {
        return $this->belongsTo(Inversion::class);
    }
}
