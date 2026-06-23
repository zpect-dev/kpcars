<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Articulo;
use App\Models\User;

/**
 * Inventario es una entidad global (sin tenant scope). Mecánico tiene acceso
 * funcional al inventario porque opera el taller; admin/administrativo lo
 * gestionan. Sólo el administrador puede tocar precios e imágenes
 * (pricing es decisión comercial).
 */
class ArticuloPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdminOrAdministrativo() || $user->isMechanic();
    }

    public function view(User $user, Articulo $articulo): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function update(User $user, Articulo $articulo): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function storeMovement(User $user): bool
    {
        return $user->isAdminOrAdministrativo() || $user->isMechanic();
    }

    public function updateCosto(User $user, Articulo $articulo): bool
    {
        return $user->isAdmin();
    }
}
