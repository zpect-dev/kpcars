<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Cobro extends Model
{
    protected $table = 'cobros';

    protected $fillable = [
        'inversion_id',
        'transaccion_id',
        'empresa_id',
    ];

    /**
     * Get the inversion that this charge belongs to.
     */
    public function inversion(): BelongsTo
    {
        return $this->belongsTo(Inversion::class);
    }

    /**
     * Get the transaction that generated this charge.
     */
    public function transaccion(): BelongsTo
    {
        return $this->belongsTo(Transaccion::class);
    }

    /**
     * Get the empresa this charge belongs to.
     */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * Scope: cobros del período actual (creados después del último cierre).
     */
    public function scopePendientes(Builder $query): Builder
    {
        $ultimoCierre = CierreCaja::latest()->value('created_at');

        return $query->when($ultimoCierre, fn (Builder $q) => $q->where('cobros.created_at', '>', $ultimoCierre));
    }

    /**
     * Scope: filtrar por empresa directamente via cobros.empresa_id.
     */
    public function scopeForEmpresa(Builder $query, ?int $empresaId): Builder
    {
        return $query->when($empresaId, function (Builder $q, int $empresaId) {
            $q->where('cobros.empresa_id', $empresaId);
        });
    }
}

