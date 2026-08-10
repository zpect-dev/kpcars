<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;

/**
 * El conteo y ajuste de stock es una acción de control: sólo admin y
 * administrativo pueden contar y confirmar ajustes. El mecánico opera el
 * inventario (ingresos/egresos) pero no corrige los números por conteo.
 */
class ConteoPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function create(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }
}
