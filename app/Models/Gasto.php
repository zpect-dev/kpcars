<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\GastoTenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[ScopedBy([GastoTenantScope::class])]
class Gasto extends Model
{
    public const TIPOS_GLOBALES = ['galpon', 'taller', 'oficina'];
    public const TIPOS_INVERSOR_6 = ['kevin', 'stock'];
    public const INVERSOR_6_ID = 72;

    protected $table = 'gastos';

    protected $fillable = [
        'fecha',
        'monto',
        'distribucion',
        'distribucion_empresas',
        'user_id',
        'recibio',
        'metodo_pago',
        'descripcion',
        'tipo',
        'vehiculo_id',
        'cierre_gasto_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'monto' => 'decimal:2',
            // Reparto entre inversores (user_id => monto), congelado al crear.
            'distribucion' => 'array',
            // Reparto por empresa (empresa_id => monto) para galpón/taller/oficina.
            'distribucion_empresas' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreGasto::class, 'cierre_gasto_id');
    }

    /**
     * Scope: gastos pendientes, es decir, todavía no asociados a un cierre.
     *
     * El vínculo es explícito (`cierre_gasto_id`): un gasto está pendiente
     * mientras no haya sido "archivado" por un cierre. Sirve igual con o sin
     * TenantScope activo: bajo una empresa toma sus gastos de vehículo + los
     * globales sin reclamar; en vista global (sin scope) toma todo lo abierto.
     */
    public function scopePendientes(Builder $query): Builder
    {
        return $query->whereNull('gastos.cierre_gasto_id');
    }
}
