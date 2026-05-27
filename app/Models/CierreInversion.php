<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[ScopedBy([TenantScope::class])]
class CierreInversion extends Model
{
    protected $table = 'cierres_inversion';

    protected $fillable = [
        'empresa_id',
        'ejecutado_por',
        'periodo_inicio',
        'periodo_fin',
        'total_recaudado',
        'tasa',
        'total_distribuido',
    ];

    protected function casts(): array
    {
        return [
            'periodo_inicio' => 'datetime',
            'periodo_fin' => 'datetime',
            'total_recaudado' => 'decimal:2',
            'tasa' => 'decimal:4',
            'total_distribuido' => 'decimal:2',
        ];
    }

    public function ejecutadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ejecutado_por');
    }

    public function recaudaciones(): HasMany
    {
        return $this->hasMany(CierreInversionRecaudacion::class, 'cierre_id');
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(CierreInversionPago::class, 'cierre_id');
    }
}
