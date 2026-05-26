<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Transaccion;
use App\Models\User;

/**
 * Transacciones de stock. Históricamente mecánico se excluye del listado
 * (entra a /articulos para su flujo operativo). Anular es admin-only por
 * impacto en auditoría.
 */
class TransaccionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function view(User $user, Transaccion $transaccion): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function annul(User $user, Transaccion $transaccion): bool
    {
        return $user->isAdmin();
    }
}
