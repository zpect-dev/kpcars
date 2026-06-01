<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'user_id',
        'recibio',
        'metodo_pago',
        'descripcion',
        'tipo',
        'vehiculo_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'monto' => 'decimal:2',
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

    public function distribuciones(): HasMany
    {
        return $this->hasMany(GastoDistribucion::class);
    }

    /**
     * Scope: gastos del período actual (todavía no cerrados).
     *
     * Distingue dos pools:
     *  - Gastos GLOBALES (sin vehículo): se cierran una sola vez para todas
     *    las empresas. Pendientes = creados después del último cierre de
     *    CUALQUIER empresa (timestamp global).
     *  - Gastos de VEHÍCULO: son por empresa. Pendientes = creados después
     *    del último cierre de la empresa activa.
     *
     * Así un gasto global no se cuenta dos veces ni queda pendiente en otra
     * empresa tras haberse cerrado.
     */
    public function scopePendientes(Builder $query): Builder
    {
        // Último cierre global (ignora el TenantScope de CierreGasto).
        $ultimoCierreGlobal = CierreGasto::withoutGlobalScope(TenantScope::class)
            ->latest()
            ->value('created_at');

        // Último cierre de la empresa activa (respeta el TenantScope).
        $ultimoCierreEmpresa = CierreGasto::latest()->value('created_at');

        return $query->where(function (Builder $q) use ($ultimoCierreGlobal, $ultimoCierreEmpresa) {
            // Gastos globales (sin vehículo): contra el último cierre global.
            $q->where(function (Builder $g) use ($ultimoCierreGlobal) {
                $g->whereNull('gastos.vehiculo_id')
                    ->when($ultimoCierreGlobal, fn (Builder $gg) => $gg->where('gastos.created_at', '>', $ultimoCierreGlobal));
            })
            // Gastos de vehículo: contra el último cierre de la empresa activa.
            ->orWhere(function (Builder $g) use ($ultimoCierreEmpresa) {
                $g->whereNotNull('gastos.vehiculo_id')
                    ->when($ultimoCierreEmpresa, fn (Builder $gg) => $gg->where('gastos.created_at', '>', $ultimoCierreEmpresa));
            });
        });
    }
}
