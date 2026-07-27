<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Multa de un vehículo. El conductor se imputa según la asignación activa en la
 * fecha de la infracción (snapshot al registrar). Es global (sin TenantScope):
 * abarca vehículos de todas las empresas.
 */
#[Fillable(['vehiculo_id', 'conductor_id', 'fecha', 'fecha_vencimiento', 'monto', 'descripcion', 'punto_rojo', 'jurisdiccion', 'pdf_path', 'pagado', 'cobrado', 'pagada_en', 'cobrada_en', 'monto_cobrado', 'registrado_por'])]
class Multa extends Model
{
    use SoftDeletes;

    protected $casts = [
        'fecha' => 'date',
        'fecha_vencimiento' => 'date',
        'monto' => 'decimal:2',
        'punto_rojo' => 'boolean',
        'pagado' => 'boolean',
        'cobrado' => 'boolean',
        'pagada_en' => 'datetime',
        'cobrada_en' => 'date',
        'monto_cobrado' => 'decimal:2',
    ];

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function conductor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'conductor_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    /**
     * Pagos del chofer (parciales o total), del más reciente al más antiguo.
     */
    public function pagos(): HasMany
    {
        return $this->hasMany(MultaPago::class)->orderByDesc('fecha')->orderByDesc('id');
    }

    /**
     * Total a cobrar hoy: 50% si es de CABA y todavía no venció, si no el total.
     */
    public function montoACobrar(): float
    {
        $monto = (float) $this->monto;

        $conDescuento = $this->jurisdiccion === 'CABA'
            && $this->fecha_vencimiento !== null
            && today()->lte($this->fecha_vencimiento);

        return $conDescuento ? $monto * 0.5 : $monto;
    }

    /**
     * Punto rojo de seguimiento puro: marcado como punto rojo y sin importe.
     *
     * Un punto rojo puede conservar su monto (se le carga un importe al pasarlo
     * a punto rojo); en ese caso el precio queda visible y la multa cuenta como
     * una normal en totales y cobros. Sin monto, en cambio, queda fuera de todo
     * cálculo financiero.
     */
    public function sinImporte(): bool
    {
        return $this->punto_rojo && (float) $this->monto <= 0;
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
}
