<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Appointment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ScheduleAppointmentAction
{
    /** Cupos normales máximos por día. */
    private const MAX_NORMAL_SLOTS = 4;

    /**
     * Agenda un turno respetando la capacidad diaria para turnos normales.
     *
     * - Turnos "normal": máximo MAX_NORMAL_SLOTS por día. Si el día está
     *   lleno se lanza una RuntimeException (no se desplaza).
     * - Turnos "emergencia": cupos ilimitados, se insertan directamente.
     * - Domingos bloqueados para ambos tipos.
     *
     * Todo el proceso corre dentro de una transacción con bloqueo pesimista
     * (lockForUpdate) para evitar sobreasignación concurrente.
     *
     * @throws RuntimeException Si no hay cupos o la fecha es domingo.
     */
    public function execute(
        string $service,
        string $plate,
        ?int $conductorId,
        Carbon $preferredDate,
        string $type = 'normal',
    ): Appointment {
        return DB::transaction(function () use ($service, $plate, $conductorId, $preferredDate, $type) {
            $requestedDate = $preferredDate->copy()->startOfDay();

            if ($requestedDate->isSunday()) {
                throw new RuntimeException('El taller no atiende los días domingo. Por favor seleccione otro día.');
            }

            if ($type === 'normal') {
                $usedSlots = Appointment::normalOnDate($requestedDate->toDateString())
                    ->lockForUpdate()
                    ->count();

                if ($usedSlots >= self::MAX_NORMAL_SLOTS) {
                    throw new RuntimeException('No hay cupos normales disponibles para esta fecha. Puede solicitar un turno de emergencia.');
                }
            }

            return Appointment::create([
                'service'        => $service,
                'license_plate'  => $plate,
                'conductor_id'   => $conductorId,
                'scheduled_date' => $requestedDate->toDateString(),
                'type'           => $type,
                'status'         => 'agendado',
            ]);
        });
    }
}
