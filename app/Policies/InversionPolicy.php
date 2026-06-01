<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Inversion;
use App\Models\User;

class InversionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, Inversion $inversion): bool
    {
        return $user->isAdmin();
    }

    public function manageInversores(User $user, Inversion $inversion): bool
    {
        return $user->isAdmin();
    }

    public function viewDeuda(User $user, Inversion $inversion, User $target): bool
    {
        return $user->isAdmin() && $target->role === UserRole::INVERSOR;
    }

    public function storeDeudaMovimiento(User $user, Inversion $inversion, User $target): bool
    {
        return $user->isAdmin() && $target->role === UserRole::INVERSOR;
    }

    public function pagoCascada(User $user, User $target): bool
    {
        return $user->isAdmin() && $target->role === UserRole::INVERSOR;
    }
}
