<?php

declare(strict_types=1);

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * TenantScope específico para Gasto.
 *
 * Un Gasto NO tiene `empresa_id` directo: puede estar asociado a un
 * vehículo (tipos taller/vehiculo) o ser "global" (galpon, oficina, etc.),
 * caso en el que se considera visible para cualquier empresa.
 *
 * Filtrado aplicado cuando hay empresa activa:
 *   vehiculo_id IS NULL
 *   OR EXISTS (vehiculos.empresa_id = active_company_id)
 *
 * Comparte la semántica de no-op fuera de contexto web del {@see TenantScope}.
 */
class GastoTenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $activeCompanyId = $this->activeCompanyId();

        if ($activeCompanyId === null) {
            return;
        }

        $builder->where(function (Builder $query) use ($activeCompanyId) {
            $query->whereNull('vehiculo_id')
                ->orWhereHas('vehiculo', fn (Builder $q) => $q->where('empresa_id', $activeCompanyId));
        });
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
