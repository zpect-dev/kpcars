<?php

declare(strict_types=1);

use App\Actions\ScheduleAppointmentAction;
use App\Models\Appointment;
use App\Models\ServiceType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->action = new ScheduleAppointmentAction();

    $this->basico = ServiceType::create([
        'name' => 'Básico',
        'description' => 'Cambio de aceite.',
        'required_slots' => 1,
    ]);
    $this->medio = ServiceType::create([
        'name' => 'Medio',
        'description' => 'Frenos.',
        'required_slots' => 3,
    ]);
    $this->complejo = ServiceType::create([
        'name' => 'Complejo',
        'description' => 'Ajuste de motor.',
        'required_slots' => 5,
    ]);
});

it('agenda un turno normal para la fecha preferida', function () {
    // Lunes 2026-04-13
    $preferred = Carbon::parse('2026-04-13');

    $appointment = $this->action->execute(
        $this->basico,
        'ABC123',
        'Juan Pérez',
        $preferred,
    );

    expect($appointment)->toBeInstanceOf(Appointment::class)
        ->and($appointment->scheduled_date->toDateString())->toBe('2026-04-13')
        ->and($appointment->license_plate)->toBe('ABC123')
        ->and($appointment->applicant)->toBe('Juan Pérez')
        ->and($appointment->service_type_id)->toBe($this->basico->id)
        ->and($appointment->status)->toBe('pending');
});

it('desplaza al día siguiente cuando se excede la capacidad diaria', function () {
    // Lunes 2026-04-13 — llenamos con 18 cupos (Básico x18 → 18 cupos).
    $preferred = Carbon::parse('2026-04-13');
    for ($i = 0; $i < 18; $i++) {
        Appointment::create([
            'service_type_id' => $this->basico->id,
            'license_plate' => 'FILL'.$i,
            'applicant' => 'Fill',
            'scheduled_date' => $preferred->toDateString(),
            'status' => 'pending',
        ]);
    }

    // Intentamos agendar "Complejo" (5 cupos): 18 + 5 = 23 > 20 → debe ir al martes.
    $appointment = $this->action->execute(
        $this->complejo,
        'XYZ999',
        'Ana García',
        $preferred,
    );

    expect($appointment->scheduled_date->toDateString())->toBe('2026-04-14');
});

it('omite los domingos al buscar disponibilidad', function () {
    // Sábado 2026-04-18 → debe saltar domingo 19 y agendar lunes 20.
    $sabado = Carbon::parse('2026-04-18');
    // Saturamos el sábado: Complejo x4 = 20 cupos.
    for ($i = 0; $i < 4; $i++) {
        Appointment::create([
            'service_type_id' => $this->complejo->id,
            'license_plate' => 'SAT'.$i,
            'applicant' => 'Sat',
            'scheduled_date' => $sabado->toDateString(),
            'status' => 'pending',
        ]);
    }

    $appointment = $this->action->execute(
        $this->basico,
        'DOM001',
        'Cliente Domingo',
        $sabado,
    );

    // No debe caer en domingo 2026-04-19 (Carbon::parse('2026-04-19')->isSunday() === true)
    expect($appointment->scheduled_date->toDateString())->toBe('2026-04-20')
        ->and($appointment->scheduled_date->isSunday())->toBeFalse();
});

it('si la fecha preferida es domingo, avanza al lunes aunque haya capacidad', function () {
    $domingo = Carbon::parse('2026-04-19');
    expect($domingo->isSunday())->toBeTrue();

    $appointment = $this->action->execute(
        $this->basico,
        'SUN001',
        'Cliente',
        $domingo,
    );

    expect($appointment->scheduled_date->toDateString())->toBe('2026-04-20');
});

it('los turnos cancelados no cuentan contra la capacidad diaria', function () {
    $preferred = Carbon::parse('2026-04-13');

    // 20 cupos ocupados pero todos cancelados → el día sigue libre.
    for ($i = 0; $i < 4; $i++) {
        Appointment::create([
            'service_type_id' => $this->complejo->id,
            'license_plate' => 'CNL'.$i,
            'applicant' => 'Cancelado',
            'scheduled_date' => $preferred->toDateString(),
            'status' => 'cancelled',
        ]);
    }

    $appointment = $this->action->execute(
        $this->complejo,
        'OK001',
        'Cliente',
        $preferred,
    );

    expect($appointment->scheduled_date->toDateString())->toBe('2026-04-13');
});
