<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Foto de la participación de un socio en una inversión al momento del cierre:
 * su saldo de deuda y si es financiador. Base para recalcular el sueldo aunque
 * después cambien las deudas vivas.
 */
#[Fillable(['cierre_sueldo_id', 'inversion_id', 'user_id', 'empresa_id', 'saldo', 'es_financiador'])]
class CierreSueldoParticipacion extends Model
{
    protected $table = 'cierre_sueldo_participaciones';

    protected $casts = [
        'saldo' => 'decimal:2',
        'es_financiador' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function inversion(): BelongsTo
    {
        return $this->belongsTo(Inversion::class);
    }
}
