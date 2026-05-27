<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\User;

beforeEach(function () {
    // El actor del flujo de turnos es un admin (puede tocar cualquier status).
    $this->user = User::factory()->create([
        'dni' => '11111111',
        'password' => bcrypt('password'),
        'role' => UserRole::ADMINISTRADOR,
    ]);
    $this->actingAs($this->user);
});

it('marca un turno como completado', function () {
    $mecanico = User::factory()->create([
        'dni' => '22222222',
        'role' => UserRole::MECANICO,
    ]);

    $appointment = Appointment::create([
        'service' => 'Cambio de aceite',
        'license_plate' => 'ABC123',
        'scheduled_date' => '2026-04-22',
        'type' => 'normal',
        'status' => 'agendado',
    ]);

    $response = $this->patch(route('appointments.status', $appointment), [
        'status' => 'completado',
        'completed_by_id' => $mecanico->id,
        'completion_description' => 'Aceite reemplazado y filtro nuevo.',
    ]);

    $response->assertRedirect();
    $fresh = $appointment->fresh();
    expect($fresh->status)->toBe('completado');
    expect($fresh->completed_by)->toBe($mecanico->id);
    expect($fresh->completion_description)->toBe('Aceite reemplazado y filtro nuevo.');
});

it('rechaza completar un turno sin descripción', function () {
    $mecanico = User::factory()->create([
        'dni' => '33333333',
        'role' => UserRole::MECANICO,
    ]);

    $appointment = Appointment::create([
        'service' => 'Cambio de aceite',
        'license_plate' => 'ABC124',
        'scheduled_date' => '2026-04-22',
        'type' => 'normal',
        'status' => 'agendado',
    ]);

    $this->patch(route('appointments.status', $appointment), [
        'status' => 'completado',
        'completed_by_id' => $mecanico->id,
    ])->assertRedirect();

    expect($appointment->fresh()->status)->toBe('agendado');
});

it('marca un turno como en proceso', function () {
    $appointment = Appointment::create([
        'service' => 'Frenos',
        'license_plate' => 'DEF456',
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
    $mecanico = User::factory()->create([
        'dni' => '44444444',
        'role' => UserRole::MECANICO,
    ]);

    $appointment = Appointment::create([
        'service' => 'Reparación urgente',
        'license_plate' => 'EMR001',
        'scheduled_date' => '2026-04-22',
        'type' => 'emergencia',
        'status' => 'agendado',
    ]);

    $this->patch(route('appointments.status', $appointment), [
        'status' => 'completado',
        'completed_by_id' => $mecanico->id,
        'completion_description' => 'Reparación de emergencia finalizada.',
    ])->assertRedirect();

    expect($appointment->fresh()->status)->toBe('completado');
});
