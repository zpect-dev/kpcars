<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create([
        'dni' => '22222222',
        'password' => bcrypt('password'),
        'role' => UserRole::CHOFER,
        'must_change_password' => false,
    ]);

    $this->token = $this->user->createToken('test')->plainTextToken;
});

it('devuelve turnos en rango de fechas', function () {
    // Crear turnos en distintas fechas
    Appointment::create([
        'service' => 'Aceite',
        'license_plate' => 'ABC123',
        'applicant' => 'Juan',
        'scheduled_date' => '2026-04-20',
        'type' => 'normal',
        'status' => 'agendado',
    ]);
    Appointment::create([
        'service' => 'Frenos',
        'license_plate' => 'DEF456',
        'applicant' => 'Ana',
        'scheduled_date' => '2026-04-22',
        'type' => 'emergencia',
        'status' => 'agendado',
    ]);
    Appointment::create([
        'service' => 'Motor',
        'license_plate' => 'GHI789',
        'applicant' => 'Carlos',
        'scheduled_date' => '2026-04-25',
        'type' => 'normal',
        'status' => 'completado',
    ]);

    $response = $this->withHeaders([
        'Authorization' => 'Bearer '.$this->token,
    ])->getJson('/api/sync-turnos?from=2026-04-20&to=2026-04-23');

    $response->assertSuccessful()
        ->assertJsonCount(2, 'appointments')
        ->assertJsonPath('count', 2);
});

it('incluye el tipo en la respuesta de sincronización', function () {
    Appointment::create([
        'service' => 'Urgencia',
        'license_plate' => 'EMR001',
        'applicant' => 'Pedro',
        'scheduled_date' => '2026-04-22',
        'type' => 'emergencia',
        'status' => 'agendado',
    ]);

    $response = $this->withHeaders([
        'Authorization' => 'Bearer '.$this->token,
    ])->getJson('/api/sync-turnos?from=2026-04-22&to=2026-04-23');

    $response->assertSuccessful();

    $data = $response->json('appointments');
    expect($data)->toHaveCount(1)
        ->and($data[0]['type'])->toBe('emergencia');
});

it('requiere autenticación para sync-turnos', function () {
    $this->getJson('/api/sync-turnos?from=2026-04-20&to=2026-04-22')
        ->assertUnauthorized();
});

it('valida parámetros from y to en sync-turnos', function () {
    $this->withHeaders([
        'Authorization' => 'Bearer '.$this->token,
    ])->getJson('/api/sync-turnos')
        ->assertUnprocessable();
});

it('crea un turno desde el endpoint externo', function () {
    $response = $this->withHeaders([
        'Authorization' => 'Bearer '.$this->token,
    ])->postJson('/api/turnos-externos', [
        'service' => 'Cambio de aceite',
        'license_plate' => 'ABC123',
        'applicant' => 'Juan Pérez',
        'preferred_date' => '2026-04-22',
        'type' => 'normal',
    ]);

    $response->assertCreated()
        ->assertJsonPath('appointment.type', 'normal')
        ->assertJsonPath('appointment.license_plate', 'ABC123');

    expect(Appointment::count())->toBe(1);
});

it('crea un turno de emergencia desde el endpoint externo', function () {
    // Llenar cupos normales
    for ($i = 0; $i < 4; $i++) {
        Appointment::create([
            'service' => 'Normal '.$i,
            'license_plate' => 'FILL'.$i,
            'applicant' => 'Fill',
            'scheduled_date' => '2026-04-22',
            'type' => 'normal',
            'status' => 'agendado',
        ]);
    }

    $response = $this->withHeaders([
        'Authorization' => 'Bearer '.$this->token,
    ])->postJson('/api/turnos-externos', [
        'service' => 'Reparación urgente',
        'license_plate' => 'EMR001',
        'applicant' => 'Carlos',
        'preferred_date' => '2026-04-22',
        'type' => 'emergencia',
    ]);

    $response->assertCreated()
        ->assertJsonPath('appointment.type', 'emergencia');
});

it('rechaza turno normal externo si no hay cupos', function () {
    // Llenar cupos normales
    for ($i = 0; $i < 4; $i++) {
        Appointment::create([
            'service' => 'Normal '.$i,
            'license_plate' => 'FILL'.$i,
            'applicant' => 'Fill',
            'scheduled_date' => '2026-04-22',
            'type' => 'normal',
            'status' => 'agendado',
        ]);
    }

    $response = $this->withHeaders([
        'Authorization' => 'Bearer '.$this->token,
    ])->postJson('/api/turnos-externos', [
        'service' => 'Quinto normal',
        'license_plate' => 'FAIL01',
        'applicant' => 'Rechazado',
        'preferred_date' => '2026-04-22',
        'type' => 'normal',
    ]);

    $response->assertUnprocessable();
});

it('requiere autenticación para turnos-externos', function () {
    $this->postJson('/api/turnos-externos', [
        'service' => 'Test',
        'license_plate' => 'ABC123',
        'applicant' => 'Test',
        'preferred_date' => '2026-04-22',
    ])->assertUnauthorized();
});
