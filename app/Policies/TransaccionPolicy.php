<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Transaccion;
use App\Models\User;

/**
 * Transacciones de stock. Admin, administrativo y mecánico pueden ver el
 * historial (el mecánico opera el inventario y necesita consultarlo). Anular
 * sigue siendo admin-only por su impacto en auditoría.
 */
class TransaccionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdminOrAdministrativo() || $user->isMechanic();
    }

    public function view(User $user, Transaccion $transaccion): bool
    {
        return $user->isAdminOrAdministrativo() || $user->isMechanic();
    }

    public function annul(User $user, Transaccion $transaccion): bool
    {
        return $user->isAdmin();
    }
}
