<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\CierreGasto;
use App\Models\User;

class CierreGastoPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, CierreGasto $cierre): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }
}
