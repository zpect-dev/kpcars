<?php

declare(strict_types=1);

use App\Actions\ScheduleAppointmentAction;
use App\Models\Appointment;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->action = new ScheduleAppointmentAction();
});

it('agenda un turno normal con cupos disponibles', function () {
    $preferred = Carbon::parse('2026-04-22'); // Miércoles

    $appointment = $this->action->execute(
        'Cambio de aceite',
        'ABC123',
        'Juan Pérez',
        $preferred,
        'normal',
    );

    expect($appointment)->toBeInstanceOf(Appointment::class)
        ->and($appointment->scheduled_date->toDateString())->toBe('2026-04-22')
        ->and($appointment->license_plate)->toBe('ABC123')
        ->and($appointment->applicant)->toBe('Juan Pérez')
        ->and($appointment->type)->toBe('normal')
        ->and($appointment->status)->toBe('agendado');
});

it('rechaza un turno normal cuando los 4 cupos están ocupados', function () {
    $date = Carbon::parse('2026-04-22');

    // Llenar los 4 cupos normales
    for ($i = 0; $i < 4; $i++) {
        Appointment::create([
            'service' => 'Servicio '.$i,
            'license_plate' => 'FILL'.$i,
            'applicant' => 'Fill',
            'scheduled_date' => $date->toDateString(),
            'type' => 'normal',
            'status' => 'agendado',
        ]);
    }

    // El 5to normal debe ser rechazado
    $this->action->execute(
        'Servicio extra',
        'XYZ999',
        'Ana García',
        $date,
        'normal',
    );
})->throws(RuntimeException::class, 'No hay cupos normales disponibles para esta fecha.');

it('permite turno de emergencia aunque los cupos normales estén llenos', function () {
    $date = Carbon::parse('2026-04-22');

    // Llenar los 4 cupos normales
    for ($i = 0; $i < 4; $i++) {
        Appointment::create([
            'service' => 'Servicio '.$i,
            'license_plate' => 'FILL'.$i,
            'applicant' => 'Fill',
            'scheduled_date' => $date->toDateString(),
            'type' => 'normal',
            'status' => 'agendado',
        ]);
    }

    // Emergencia siempre pasa
    $appointment = $this->action->execute(
        'Reparación urgente',
        'EMR001',
        'Carlos López',
        $date,
        'emergencia',
    );

    expect($appointment->type)->toBe('emergencia')
        ->and($appointment->scheduled_date->toDateString())->toBe('2026-04-22');
});

it('rechaza domingos para ambos tipos de turno', function (string $type) {
    $domingo = Carbon::parse('2026-04-26'); // Domingo
    expect($domingo->isSunday())->toBeTrue();

    $this->action->execute(
        'Servicio',
        'SUN001',
        'Cliente',
        $domingo,
        $type,
    );
})->throws(RuntimeException::class, 'El taller no atiende los días domingo.')
  ->with(['normal', 'emergencia']);

it('los turnos de emergencia no afectan el conteo de cupos normales', function () {
    $date = Carbon::parse('2026-04-22');

    // 3 normales + 2 emergencias
    for ($i = 0; $i < 3; $i++) {
        Appointment::create([
            'service' => 'Normal '.$i,
            'license_plate' => 'NRM'.$i,
            'applicant' => 'Cliente',
            'scheduled_date' => $date->toDateString(),
            'type' => 'normal',
            'status' => 'agendado',
        ]);
    }
    for ($i = 0; $i < 2; $i++) {
        Appointment::create([
            'service' => 'Emergencia '.$i,
            'license_plate' => 'EMR'.$i,
            'applicant' => 'Cliente',
            'scheduled_date' => $date->toDateString(),
            'type' => 'emergencia',
            'status' => 'agendado',
        ]);
    }

    // El 4to normal todavía debe ser posible (solo 3 normales usados)
    $appointment = $this->action->execute(
        'Cuarto normal',
        'OK001',
        'Cliente',
        $date,
        'normal',
    );

    expect($appointment->type)->toBe('normal')
        ->and($appointment->scheduled_date->toDateString())->toBe('2026-04-22');

    // Total de normales ahora es 4, verificar que sea el límite
    expect(Appointment::normalOnDate($date->toDateString())->count())->toBe(4);
});

it('los turnos completados no cuentan contra la capacidad diaria', function () {
    $date = Carbon::parse('2026-04-22');

    // 4 normales pero todos completados → no cuentan
    for ($i = 0; $i < 4; $i++) {
        Appointment::create([
            'service' => 'Completado '.$i,
            'license_plate' => 'CMP'.$i,
            'applicant' => 'Cliente',
            'scheduled_date' => $date->toDateString(),
            'type' => 'normal',
            'status' => 'completado',
        ]);
    }

    $appointment = $this->action->execute(
        'Nuevo turno',
        'NEW001',
        'Cliente',
        $date,
        'normal',
    );

    expect($appointment->scheduled_date->toDateString())->toBe('2026-04-22');
});

it('permite múltiples turnos de emergencia sin límite', function () {
    $date = Carbon::parse('2026-04-22');

    // Crear 10 turnos de emergencia → todos deben pasar
    for ($i = 0; $i < 10; $i++) {
        $appointment = $this->action->execute(
            'Emergencia '.$i,
            'EMR'.$i,
            'Cliente',
            $date,
            'emergencia',
        );

        expect($appointment->type)->toBe('emergencia');
    }

    expect(Appointment::whereDate('scheduled_date', $date->toDateString())->count())->toBe(10);
});
