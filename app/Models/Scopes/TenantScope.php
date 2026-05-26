<?php

declare(strict_types=1);

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Global scope que filtra registros por la empresa activa de la sesión.
 *
 * Aplicable a modelos con columna `empresa_id` directa (Vehiculo, Cobro,
 * Inversion). Para modelos sin columna directa (Gasto), usar
 * {@see GastoTenantScope}.
 *
 * No-op cuando no hay sesión disponible (CLI/console/queue) o cuando la
 * sesión no tiene una empresa activa. Esto permite seeders, jobs y
 * comandos administrativos operar cross-tenant sin patches.
 *
 * Para bypassear puntualmente en código autenticado, usar
 * `Model::withoutGlobalScope(TenantScope::class)`.
 */
class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $activeCompanyId = $this->activeCompanyId();

        if ($activeCompanyId === null) {
            return;
        }

        $builder->where($model->getTable().'.empresa_id', $activeCompanyId);
    }

    private function activeCompanyId(): ?int
    {
        if (! app()->bound('session.store')) {
            return null;
        }

        $value = session('active_company_id');

        return $value === null ? null : (int) $value;
    }
}
