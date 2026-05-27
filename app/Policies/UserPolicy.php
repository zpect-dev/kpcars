<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;

/**
 * Gestión de personal. Reglas:
 *  - Admin/Administrativo gestionan a todos los usuarios.
 *  - Nadie puede modificar su propio rol o estado.
 */
class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function view(User $user, User $target): bool
    {
        return $user->isAdminOrAdministrativo() || $user->id === $target->id;
    }

    public function create(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function update(User $user, User $target): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function updateRole(User $user, User $target): bool
    {
        return $user->isAdminOrAdministrativo() && $user->id !== $target->id;
    }

    public function toggleStatus(User $user, User $target): bool
    {
        return $user->isAdminOrAdministrativo() && $user->id !== $target->id;
    }

    public function viewAsignaciones(User $user, User $target): bool
    {
        return $user->isAdminOrAdministrativo();
    }
}
