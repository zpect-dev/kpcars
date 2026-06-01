<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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

    public function detalles(): HasMany
    {
        return $this->hasMany(CierreGastoDetalle::class, 'cierre_gasto_id');
    }
}
