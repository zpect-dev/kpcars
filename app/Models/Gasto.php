<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\GastoTenantScope;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
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
}
