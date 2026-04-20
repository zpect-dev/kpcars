<?php

declare(strict_types=1);

use App\Models\Appointment;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create([
        'dni' => '11111111',
        'password' => bcrypt('password'),
    ]);
    $this->actingAs($this->user);
});

it('marca un turno como completado', function () {
    $appointment = Appointment::create([
        'service' => 'Cambio de aceite',
        'license_plate' => 'ABC123',
        'applicant' => 'Juan',
        'scheduled_date' => '2026-04-22',
        'type' => 'normal',
        'status' => 'agendado',
    ]);

    $response = $this->patch(route('appointments.status', $appointment), [
        'status' => 'completado',
    ]);

    $response->assertRedirect();
    expect($appointment->fresh()->status)->toBe('completado');
});

it('marca un turno como en proceso', function () {
    $appointment = Appointment::create([
        'service' => 'Frenos',
        'license_plate' => 'DEF456',
        'applicant' => 'Ana',
        'scheduled_date' => '2026-04-22',
        'type' => 'normal',
        'status' => 'agendado',
    ]);

    $this->patch(route('appointments.status', $appointment), [
        'status' => 'en_proceso',
    ])->assertRedirect();

    expect($appointment->fresh()->status)->toBe('en_proceso');
});

it('rechaza un status inválido', function () {
    $appointment = Appointment::create([
        'service' => 'Frenos',
        'license_plate' => 'ABC123',
        'applicant' => 'Juan',
        'scheduled_date' => '2026-04-22',
        'type' => 'normal',
        'status' => 'agendado',
    ]);

    $this->patch(route('appointments.status', $appointment), [
        'status' => 'bogus',
    ])->assertSessionHasErrors('status');

    expect($appointment->fresh()->status)->toBe('agendado');
});

it('no cambia nada si el status ya es el mismo', function () {
    $appointment = Appointment::create([
        'service' => 'Revisión',
        'license_plate' => 'GHI789',
        'applicant' => 'Pedro',
        'scheduled_date' => '2026-04-22',
        'type' => 'emergencia',
        'status' => 'en_proceso',
    ]);

    $this->patch(route('appointments.status', $appointment), [
        'status' => 'en_proceso',
    ])->assertRedirect();

    expect($appointment->fresh()->status)->toBe('en_proceso');
});

it('permite cambiar status de un turno de emergencia', function () {
    $appointment = Appointment::create([
        'service' => 'Reparación urgente',
        'license_plate' => 'EMR001',
        'applicant' => 'Carlos',
        'scheduled_date' => '2026-04-22',
        'type' => 'emergencia',
        'status' => 'agendado',
    ]);

    $this->patch(route('appointments.status', $appointment), [
        'status' => 'completado',
    ])->assertRedirect();

    expect($appointment->fresh()->status)->toBe('completado');
});
