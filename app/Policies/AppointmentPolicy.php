<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Appointment;
use App\Models\User;

/**
 * Turnos son entidad global. Reglas:
 *  - Inversor no entra a /appointments.
 *  - Mecánico/admin/administrativo lo ven.
 *  - Mecánico NO puede agendar (sólo ejecutar).
 *  - Mecánico NO puede cancelar turnos.
 *  - Turnos completados sólo se modifican por admin/administrativo (no mecánico).
 */
class AppointmentPolicy
{
    public function viewAny(User $user): bool
    {
        return ! $user->isInversor();
    }

    public function view(User $user, Appointment $appointment): bool
    {
        return ! $user->isInversor();
    }

    public function create(User $user): bool
    {
        return $user->isAdminOrAdministrativo();
    }

    public function updateStatus(User $user, Appointment $appointment, string $newStatus): bool
    {
        if ($user->isInversor()) {
            return false;
        }

        // Mecánico no puede tocar turnos ya completados (sólo admin/administrativo los reabren).
        if ($appointment->status === 'completado' && $user->isMechanic()) {
            return false;
        }

        // Mecánico no puede cancelar.
        if ($newStatus === 'cancelado' && $user->isMechanic()) {
            return false;
        }

        return true;
    }
}
