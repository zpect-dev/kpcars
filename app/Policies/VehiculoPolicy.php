<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use App\Models\Vehiculo;

/**
 * Las restricciones cross-empresa las aplica TenantScope sobre el modelo.
 * Esta policy sólo discrimina por rol.
 */
class VehiculoPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function view(User $user, Vehiculo $vehiculo): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function create(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function update(User $user, Vehiculo $vehiculo): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function delete(User $user, Vehiculo $vehiculo): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function desasignar(User $user, Vehiculo $vehiculo): bool
    {
        return $user->isAdminOrAdministrativo();
    }
}
