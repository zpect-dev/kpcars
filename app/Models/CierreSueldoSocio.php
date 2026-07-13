<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Decisión por socio deudor dentro de un cierre de sueldo (editable):
 *  - abona: true → media parte (fórmula); false → 0 en sus inversiones con deuda.
 *  - abono_monto: cuánto se le descuenta de la deuda cuando abona (preseteado al
 *    sueldo generado, editable hacia arriba).
 */
#[Fillable(['cierre_sueldo_id', 'user_id', 'abona', 'abono_monto'])]
class CierreSueldoSocio extends Model
{
    protected $table = 'cierre_sueldo_socios';

    protected $casts = [
        'abona' => 'boolean',
        'abono_monto' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
