<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[ScopedBy([TenantScope::class])]
class Recaudacion extends Model
{
    protected $table = 'recaudaciones';

    protected $fillable = [
        'vehiculo_id',
        'empresa_id',
        'cierre_id',
        'efectivo',
        'transferencia',
        'total',
        'descuento',
        'precio',
        'descripcion',
    ];

    /**
     * Atributos derivados expuestos al serializar (deuda y estado).
     *
     * @var array<int, string>
     */
    protected $appends = ['deuda', 'estado'];

    protected function casts(): array
    {
        return [
            'efectivo' => 'decimal:2',
            'transferencia' => 'decimal:2',
            'total' => 'decimal:2',
            'descuento' => 'decimal:2',
            'precio' => 'decimal:2',
        ];
    }

    /**
     * Get the vehicle this recaudacion belongs to.
     */
    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    /**
     * Get the empresa this recaudacion belongs to.
     */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * Get the cierre this recaudacion belongs to (null = período abierto).
     */
    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreRecaudacion::class, 'cierre_id');
    }

    /**
     * Scope: recaudaciones del período abierto (sin cierre asignado).
     */
    public function scopeAbiertas(Builder $query): Builder
    {
        return $query->whereNull('cierre_id');
    }

    /**
     * Precio efectivo a saldar: precio del vehículo menos el descuento.
     */
    protected function precioEfectivo(): Attribute
    {
        return Attribute::make(
            get: fn () => max((float) $this->precio - (float) $this->descuento, 0),
        );
    }

    /**
     * Deuda restante respecto al precio efectivo (0 si está saldada).
     */
    protected function deuda(): Attribute
    {
        return Attribute::make(
            get: fn () => max($this->precio_efectivo - (float) $this->total, 0),
        );
    }

    /**
     * Estado: 'pagado' cuando el total alcanza el precio efectivo
     * (precio menos descuento); si no, queda en deuda.
     */
    protected function estado(): Attribute
    {
        return Attribute::make(
            get: fn () => (float) $this->total >= $this->precio_efectivo ? 'pagado' : 'deuda',
        );
    }
}
