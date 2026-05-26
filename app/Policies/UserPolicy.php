<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;

/**
 * Gestión de personal. Reglas:
 *  - Admin/Administrativo gestionan a todos los usuarios.
 *  - Inversor sólo ve el listado de usuarios de su empresa (legacy, podría removerse).
 *  - Nadie puede modificar su propio rol, estado, ni el flag absoluto sobre sí mismo.
 *  - toggleAbsoluto y updateEmpresaAcceso son legacy (Fase 8); por ahora se permiten
 *    sólo si el target es administrador.
 */
class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdminOrAdministrativo() || $user->isInversor();
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

    public function toggleAbsoluto(User $user, User $target): bool
    {
        return $user->isAdminOrAdministrativo()
            && $user->id !== $target->id
            && $target->isAdmin();
    }

    public function updateEmpresaAcceso(User $user, User $target): bool
    {
        return $user->isAdminOrAdministrativo() && $target->isAdmin();
    }

    public function viewAsignaciones(User $user, User $target): bool
    {
        return $user->isAdminOrAdministrativo();
    }
}
