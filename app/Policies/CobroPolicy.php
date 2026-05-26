<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Cobro;
use App\Models\User;

class CobroPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, Cobro $cobro): bool
    {
        return $user->isAdmin();
    }

    public function cierreCaja(User $user): bool
    {
        return $user->isAdmin();
    }
}
