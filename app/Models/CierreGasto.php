<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use stdClass;

#[ScopedBy([TenantScope::class])]
class CierreGasto extends Model
{
    protected $table = 'cierres_gastos';

    protected $fillable = [
        'empresa_id',
        'user_id',
        'periodo_inicio',
        'periodo_fin',
        'total_general',
    ];

    protected function casts(): array
    {
        return [
            'periodo_inicio' => 'datetime',
            'periodo_fin' => 'datetime',
            'total_general' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Gastos archivados por este cierre. El desglose por tipo/patente y el
     * reparto por inversor se derivan de esta relación (no hay tablas aparte).
     */
    public function gastos(): HasMany
    {
        return $this->hasMany(Gasto::class, 'cierre_gasto_id');
    }

    /**
     * Desglose del cierre derivado de sus gastos (sin tablas auxiliares):
     *  - porTipo: subtotal por categoría (excluye 'vehiculo'), ordenado por tipo.
     *  - porVehiculo: subtotal por patente para los gastos de tipo 'vehiculo'.
     *
     * Se ignoran los TenantScope para incluir todos los gastos del cierre y
     * resolver sus vehículos aunque la empresa activa sea otra.
     *
     * @return array{porTipo: Collection<int, stdClass>, porVehiculo: Collection<int, stdClass>}
     */
    public function desglose(): array
    {
        $gastos = $this->gastos()
            ->withoutGlobalScope(GastoTenantScope::class)
            ->with(['vehiculo' => fn ($q) => $q
                ->withoutGlobalScope(TenantScope::class)
                ->select('id', 'patente')])
            ->get();

        $porTipo = $gastos
            ->where('tipo', '!=', 'vehiculo')
            ->groupBy('tipo')
            ->map(fn (Collection $grupo, string $tipo) => (object) [
                'tipo' => $tipo,
                'total' => (float) $grupo->sum(fn (Gasto $g) => (float) $g->monto),
            ])
            ->sortBy('tipo')
            ->values();

        $porVehiculo = $gastos
            ->where('tipo', 'vehiculo')
            ->groupBy('vehiculo_id')
            ->map(fn (Collection $grupo) => (object) [
                'patente' => $grupo->first()->vehiculo?->patente,
                'total' => (float) $grupo->sum(fn (Gasto $g) => (float) $g->monto),
            ])
            ->sortBy('patente', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        return ['porTipo' => $porTipo, 'porVehiculo' => $porVehiculo];
    }
}
