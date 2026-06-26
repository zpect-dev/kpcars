<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ChoferEventoTipo;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Registro de auditoría de altas y bajas de choferes. Se crea una fila cada vez
 * que un chofer se da de alta (creación o reactivación) o de baja (desactivación).
 * Es global (sin TenantScope): el personal no está acotado por empresa.
 */
#[Fillable(['user_id', 'tipo', 'registrado_por'])]
class ChoferEvento extends Model
{
    protected $table = 'chofer_eventos';

    protected $casts = [
        'tipo' => ChoferEventoTipo::class,
    ];

    /**
     * El chofer al que corresponde el evento.
     */
    public function chofer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * El usuario que registró el evento (quién dio el alta/baja), si se conoce.
     */
    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
