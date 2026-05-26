<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Revision;
use App\Models\User;

class RevisionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function view(User $user, Revision $revision): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function create(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function cerrar(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }
}
