<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

/** Miércoles: el taller no toma turnos, pero la administración puede agendar. */
const MIERCOLES = '2026-04-22';

function altaTurno(array $overrides = []): array
{
    return [...[
        'service' => 'Cambio de aceite',
        'license_plate' => 'WED123',
        'preferred_date' => MIERCOLES,
        'type' => 'normal',
    ], ...$overrides];
}

it('deja agendar un miércoles al administrativo y al administrador', function (UserRole $role) {
    expect(Carbon::parse(MIERCOLES)->isWednesday())->toBeTrue();

    $user = User::factory()->create(['role' => $role]);
    $chofer = User::factory()->create(['role' => UserRole::CHOFER]);

    $this->actingAs($user)
        ->post(route('appointments.store'), altaTurno(['conductor_id' => $chofer->id]))
        ->assertRedirect()
        ->assertSessionHas('success');

    $turno = Appointment::where('license_plate', 'WED123')->firstOrFail();
    expect($turno->scheduled_date->toDateString())->toBe(MIERCOLES);
})->with([UserRole::ADMINISTRATIVO, UserRole::ADMINISTRADOR]);

it('sigue sin permitir turnos de miércoles desde la app del chofer', function () {
    $chofer = User::factory()->create(['role' => UserRole::CHOFER]);

    $this->actingAs($chofer)
        ->postJson('/api/turnos-externos', [
            'service' => 'Cambio de aceite',
            'license_plate' => 'WED456',
            'applicant' => 'Chofer',
            'preferred_date' => MIERCOLES,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'No se asignan turnos los días miércoles. Por favor seleccione otro día.');

    expect(Appointment::count())->toBe(0);
});

it('el miércoles habilitado respeta el cupo diario de turnos normales', function () {
    $admin = User::factory()->create(['role' => UserRole::ADMINISTRADOR]);
    $chofer = User::factory()->create(['role' => UserRole::CHOFER]);

    for ($i = 0; $i < 4; $i++) {
        Appointment::create([
            'service' => 'Normal '.$i,
            'license_plate' => 'WED90'.$i,
            'scheduled_date' => MIERCOLES,
            'type' => 'normal',
            'status' => 'agendado',
        ]);
    }

    $this->actingAs($admin)
        ->post(route('appointments.store'), altaTurno(['conductor_id' => $chofer->id]))
        ->assertRedirect()
        ->assertSessionHas('error');

    expect(Appointment::count())->toBe(4);
});

it('el domingo sigue cerrado para todos', function () {
    $admin = User::factory()->create(['role' => UserRole::ADMINISTRADOR]);
    $chofer = User::factory()->create(['role' => UserRole::CHOFER]);

    $this->actingAs($admin)
        ->post(route('appointments.store'), altaTurno([
            'preferred_date' => '2026-04-19', // Domingo
            'conductor_id' => $chofer->id,
        ]))
        ->assertRedirect()
        ->assertSessionHas('error');

    expect(Appointment::count())->toBe(0);
});

it('habilita el miércoles en el calendario sólo para administrativo o superior', function () {
    $admin = User::factory()->create(['role' => UserRole::ADMINISTRADOR]);
    $mecanico = User::factory()->create(['role' => UserRole::MECANICO]);

    $this->actingAs($admin)
        ->get(route('appointments.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('canScheduleWednesday', true));

    $this->actingAs($mecanico)
        ->get(route('appointments.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('canScheduleWednesday', false));
});
