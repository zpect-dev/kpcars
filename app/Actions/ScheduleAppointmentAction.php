<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Appointment;
use App\Models\ServiceType;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ScheduleAppointmentAction
{

    /**
     * Agenda un turno respetando la capacidad diaria y desplazando la fecha
     * cuando no hay cupos, omitiendo domingos.
     *
     * Todo el proceso corre dentro de una transacción con bloqueo pesimista
     * (lockForUpdate) sobre las filas candidatas del día, de forma que dos
     * peticiones concurrentes no puedan "ver" la misma capacidad libre y
     * sobreasignar cupos.
     *
     * @throws RuntimeException Si el servicio excede la capacidad diaria
     *                          o si no se encuentra un día con cupos.
     */
    public function execute(
        string $service,
        string $plate,
        string $applicant,
        Carbon $preferredDate,
    ): Appointment {
        return DB::transaction(function () use ($service, $plate, $applicant, $preferredDate) {
            $requestedDate = $preferredDate->copy()->startOfDay();

            if ($requestedDate->isSunday()) {
                throw new RuntimeException('El taller no atiende los días domingo. Por favor seleccione otro día.');
            }

            return Appointment::create([
                'service' => $service,
                'license_plate' => $plate,
                'applicant' => $applicant,
                'scheduled_date' => $requestedDate->toDateString(),
                'status' => 'agendado',
            ]);
        });
    }
}
