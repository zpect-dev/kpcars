<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ActaEstado;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Infracción individual del feed externo de multas (módulo experimental). Se
 * distingue por `clave` única. Es global (sin TenantScope): abarca toda la flota.
 *
 * Estado:
 *  - vigente:  sigue apareciendo en el último snapshot del feed.
 *  - resuelta: dejó de aparecer estando su patente presente => pagada en origen.
 */
#[Fillable([
    'vehiculo_id', 'conductor_id', 'patente', 'jurisdiccion', 'clave', 'acta', 'motivo', 'monto',
    'fecha_infraccion', 'fecha_emision', 'fecha_vencimiento',
    'estado', 'vista_primera_en', 'vista_ultima_en', 'resuelta_en', 'snapshot_fecha', 'raw',
    'cobrado', 'cobrada_en', 'monto_cobrado', 'sync_run_id', 'resuelta_run_id',
])]
class Acta extends Model
{
    protected $casts = [
        'estado' => ActaEstado::class,
        'monto' => 'decimal:2',
        'fecha_infraccion' => 'date',
        'fecha_emision' => 'date',
        'fecha_vencimiento' => 'date',
        'vista_primera_en' => 'date',
        'vista_ultima_en' => 'date',
        'resuelta_en' => 'date',
        'snapshot_fecha' => 'date',
        'raw' => 'array',
        'cobrado' => 'boolean',
        'cobrada_en' => 'date',
        'monto_cobrado' => 'decimal:2',
    ];

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    /** Chofer imputado según la asignación vigente en la fecha de la infracción. */
    public function conductor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'conductor_id');
    }

    /** Pagos del chofer (parciales o total), del más reciente al más antiguo. */
    public function pagos(): HasMany
    {
        return $this->hasMany(ActaPago::class)->orderByDesc('fecha')->orderByDesc('id');
    }

    /** Corrida de sincronización que dio de alta el acta. */
    public function syncRun(): BelongsTo
    {
        return $this->belongsTo(MultaSyncRun::class, 'sync_run_id');
    }

    /**
     * Pago voluntario: multa de CABA con vencimiento y todavía sin vencer. Es
     * solo una marca: el feed ya trae el monto con el descuento voluntario
     * aplicado, así que NO se vuelve a dividir.
     */
    public function esPagoVoluntario(): bool
    {
        return $this->jurisdiccion === 'CABA'
            && $this->fecha_vencimiento !== null
            && ! $this->sinImporte()
            && today()->lte($this->fecha_vencimiento);
    }

    /**
     * Punto rojo: sin vencimiento y sin monto. Es seguimiento puro (como los
     * puntos rojos de las multas manuales): no entra en cálculos financieros.
     */
    public function esPuntoRojo(): bool
    {
        return $this->fecha_vencimiento === null && $this->monto === null;
    }

    /**
     * Total a cobrarle al chofer: el monto tal cual viene del feed (que ya trae
     * el descuento voluntario cuando corresponde).
     */
    public function montoACobrar(): float
    {
        return (float) $this->monto;
    }

    /** El acta no tiene importe cobrable (CABA a veces no informa monto). */
    public function sinImporte(): bool
    {
        return $this->monto === null || (float) $this->monto <= 0;
    }

    /**
     * Saldo que el chofer todavía adeuda, contemplando pagos parciales. Cero si
     * no tiene importe o si ya quedó cobrada por completo.
     */
    public function montoAdeudado(): float
    {
        if ($this->sinImporte() || $this->cobrado) {
            return 0.0;
        }

        return max(round($this->montoACobrar() - (float) $this->monto_cobrado, 2), 0);
    }

    public function scopeVigente(Builder $query): void
    {
        $query->where('estado', ActaEstado::Vigente->value);
    }

    public function scopeResuelta(Builder $query): void
    {
        $query->where('estado', ActaEstado::Resuelta->value);
    }
}
