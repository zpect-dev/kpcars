<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Cierre unificado de sueldos. Es un evento GLOBAL: un registro cubre el
 * cierre de recaudaciones de ambas empresas a la vez (sin TenantScope).
 */
class CierreSueldo extends Model
{
    protected $table = 'cierres_sueldo';

    protected $fillable = [
        'ejecutado_por',
        'tasa',
    ];

    protected function casts(): array
    {
        return [
            'tasa' => 'decimal:4',
        ];
    }

    public function ejecutadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ejecutado_por');
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(CierreSueldoPago::class, 'cierre_sueldo_id');
    }

    public function abonos(): HasMany
    {
        return $this->hasMany(CierreSueldoAbono::class, 'cierre_sueldo_id');
    }

    /**
     * Foto de la composición de las inversiones (socio, saldo, financiador) al
     * momento del cierre. Base inmutable para recalcular los sueldos.
     */
    public function participaciones(): HasMany
    {
        return $this->hasMany(CierreSueldoParticipacion::class, 'cierre_sueldo_id');
    }

    /**
     * Decisión editable por socio deudor (abona / no abona + monto del abono).
     */
    public function socios(): HasMany
    {
        return $this->hasMany(CierreSueldoSocio::class, 'cierre_sueldo_id');
    }

    /**
     * Los cierres de recaudación (uno por empresa) congelados por este cierre.
     *
     * El cierre de sueldos es global: sus hijos abarcan TODAS las empresas,
     * así que la relación bypassea el TenantScope de CierreRecaudacion (si no,
     * la empresa activa de la sesión ocultaría el cierre de la otra empresa).
     */
    public function cierresRecaudacion(): HasMany
    {
        return $this->hasMany(CierreRecaudacion::class, 'cierre_sueldo_id')
            ->withoutGlobalScope(TenantScope::class);
    }
}
