<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa = Empresa::create(['nombre' => 'Empresa Test']);
    $this->inversion = Inversion::create(['nombre' => 'Inv Test', 'empresa_id' => $this->empresa->id]);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '30000001',
        'empresa_default_id' => $this->empresa->id,
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);
});

function datosVehiculo(array $overrides = []): array
{
    return array_merge([
        'patente' => 'AAA111',
        'marca' => 'Toyota',
        'modelo' => 'Etios',
        'anio' => '2020',
        'inversion_id' => test()->inversion->id,
    ], $overrides);
}

it('no permite crear un vehículo asignado a un conductor inactivo', function () {
    $inactivo = User::factory()->create([
        'role' => UserRole::CHOFER,
        'dni' => '30000010',
        'inactivo' => true,
    ]);

    $this->post('/vehiculos', datosVehiculo(['user_id' => $inactivo->id]))
        ->assertSessionHasErrors('user_id');

    expect(Vehiculo::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)->count())->toBe(0);
});

it('permite crear un vehículo asignado a un conductor activo', function () {
    $activo = User::factory()->create([
        'role' => UserRole::CHOFER,
        'dni' => '30000011',
        'inactivo' => false,
    ]);

    $this->post('/vehiculos', datosVehiculo(['user_id' => $activo->id]))
        ->assertSessionHasNoErrors();

    $veh = Vehiculo::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)->first();
    expect($veh)->not->toBeNull()
        ->and($veh->user_id)->toBe($activo->id);
});

it('no permite reasignar un vehículo a un conductor inactivo al editar', function () {
    $activo = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '30000012', 'inactivo' => false]);
    $inactivo = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '30000013', 'inactivo' => true]);

    $veh = Vehiculo::create(datosVehiculo(['user_id' => $activo->id, 'empresa_id' => $this->empresa->id]));

    $this->put("/vehiculos/{$veh->id}", datosVehiculo(['user_id' => $inactivo->id]))
        ->assertSessionHasErrors('user_id');

    expect($veh->fresh()->user_id)->toBe($activo->id);
});
