<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Gasto;
use App\Models\User;

/**
 * Gastos es área financiera: sólo administrador. Inversor ve sus distribuciones
 * vía Mi Cuenta, no por este endpoint.
 */
class GastoPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, Gasto $gasto): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, Gasto $gasto): bool
    {
        return $user->isAdmin();
    }
}
