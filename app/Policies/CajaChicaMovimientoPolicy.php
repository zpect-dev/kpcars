<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\CajaChicaMovimiento;
use App\Models\User;

/**
 * La caja chica es parte del área financiera (Gastos): sólo administrador.
 * Espeja a {@see GastoPolicy}.
 */
class CajaChicaMovimientoPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, CajaChicaMovimiento $movimiento): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * El libro es append-only: "borrar" significa registrar el contraasiento
     * que anula el movimiento.
     */
    public function revertir(User $user, CajaChicaMovimiento $movimiento): bool
    {
        return $user->isAdmin();
    }
}
