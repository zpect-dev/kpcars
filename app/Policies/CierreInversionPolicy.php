<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\CierreInversion;
use App\Models\User;

class CierreInversionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, CierreInversion $cierre): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }
}
