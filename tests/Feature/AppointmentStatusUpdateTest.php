<?php

declare(strict_types=1);

use App\Models\Appointment;
use App\Models\ServiceType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create([
        'dni' => '11111111',
        'password' => bcrypt('password'),
    ]);
    $this->basico = ServiceType::create([
        'name' => 'Básico',
        'description' => 'x',
        'required_slots' => 1,
    ]);
    $this->complejo = ServiceType::create([
        'name' => 'Complejo',
        'description' => 'x',
        'required_slots' => 5,
    ]);
    $this->actingAs($this->user);
});

it('marca un turno como completado', function () {
    $appointment = Appointment::create([
        'service_type_id' => $this->basico->id,
        'license_plate' => 'ABC123',
        'applicant' => 'Juan',
        'scheduled_date' => '2026-04-20',
        'status' => 'pending',
    ]);

    $response = $this->patch(route('appointments.status', $appointment), [
        'status' => 'completed',
    ]);

    $response->assertRedirect();
    expect($appointment->fresh()->status)->toBe('completed');
});

it('cancela un turno pendiente', function () {
    $appointment = Appointment::create([
        'service_type_id' => $this->basico->id,
        'license_plate' => 'ABC123',
        'applicant' => 'Juan',
        'scheduled_date' => '2026-04-20',
        'status' => 'pending',
    ]);

    $this->patch(route('appointments.status', $appointment), [
        'status' => 'cancelled',
    ])->assertRedirect();

    expect($appointment->fresh()->status)->toBe('cancelled');
});

it('rechaza un status inválido', function () {
    $appointment = Appointment::create([
        'service_type_id' => $this->basico->id,
        'license_plate' => 'ABC123',
        'applicant' => 'Juan',
        'scheduled_date' => '2026-04-20',
        'status' => 'pending',
    ]);

    $this->patch(route('appointments.status', $appointment), [
        'status' => 'bogus',
    ])->assertSessionHasErrors('status');

    expect($appointment->fresh()->status)->toBe('pending');
});

it('impide reactivar un cancelado si el día ya está lleno', function () {
    // 4 x Complejo = 20 cupos (capacidad diaria completa).
    for ($i = 0; $i < 4; $i++) {
        Appointment::create([
            'service_type_id' => $this->complejo->id,
            'license_plate' => 'OK'.$i,
            'applicant' => 'Cliente',
            'scheduled_date' => '2026-04-20',
            'status' => 'pending',
        ]);
    }

    $cancelled = Appointment::create([
        'service_type_id' => $this->basico->id,
        'license_plate' => 'CNL1',
        'applicant' => 'Cancelado',
        'scheduled_date' => '2026-04-20',
        'status' => 'cancelled',
    ]);

    // Intento reactivar: 20 + 1 = 21 > 20 → rechazar.
    $this->patch(route('appointments.status', $cancelled), [
        'status' => 'pending',
    ]);

    expect($cancelled->fresh()->status)->toBe('cancelled');
});

it('permite reactivar un cancelado si hay cupos disponibles', function () {
    Appointment::create([
        'service_type_id' => $this->basico->id,
        'license_plate' => 'OK1',
        'applicant' => 'Cliente',
        'scheduled_date' => '2026-04-20',
        'status' => 'pending',
    ]);

    $cancelled = Appointment::create([
        'service_type_id' => $this->complejo->id,
        'license_plate' => 'REACT1',
        'applicant' => 'Reactivado',
        'scheduled_date' => '2026-04-20',
        'status' => 'cancelled',
    ]);

    // Ocupados (excluyéndose): 1. Necesita 5. 1 + 5 = 6 ≤ 20 → OK.
    $this->patch(route('appointments.status', $cancelled), [
        'status' => 'pending',
    ])->assertRedirect();

    expect($cancelled->fresh()->status)->toBe('pending');
});
