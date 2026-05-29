<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Revision;
use App\Models\Service;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '40000001',
    ]);

    $this->empresa = Empresa::create(['nombre' => 'Empresa Test']);
    $this->inversion = Inversion::create(['nombre' => 'Inv Test', 'empresa_id' => $this->empresa->id]);
});

function nuevoVehiculo(string $patente): Vehiculo
{
    return Vehiculo::factory()->create([
        'patente' => $patente,
        'inversion_id' => test()->inversion->id,
        'empresa_id' => test()->empresa->id,
    ]);
}

function nuevaRevision(Vehiculo $vehiculo, int $km): Revision
{
    return Revision::create([
        'vehiculo_id' => $vehiculo->id,
        'limpieza' => 'buena',
        'nivel_nafta' => 'optimo',
        'kilometraje' => $km,
        'rueda_auxiliar' => true,
        'kit_seguridad' => true,
        'sticker' => true,
        'posee_fundas' => true,
    ]);
}

it('marca el service como vencido cuando se recorrieron 10.000 km o más desde el último', function () {
    $veh = nuevoVehiculo('AAA111');
    nuevaRevision($veh, 20000);
    Service::create(['vehiculo_id' => $veh->id, 'kilometraje' => 5000, 'fecha' => now()]);

    $this->actingAs($this->admin)->get('/services')->assertInertia(fn (Assert $p) => $p
        ->component('Service/Index')
        ->where('vehiculos.0.estado', 'vencido')
        ->where('vehiculos.0.km_actual', 20000)
        ->where('vehiculos.0.km_recorridos', 15000)
    );
});

it('marca el service al día cuando se recorrió menos de 10.000 km', function () {
    $veh = nuevoVehiculo('AAA111');
    nuevaRevision($veh, 12000);
    Service::create(['vehiculo_id' => $veh->id, 'kilometraje' => 5000, 'fecha' => now()]);

    $this->actingAs($this->admin)->get('/services')->assertInertia(fn (Assert $p) => $p
        ->where('vehiculos.0.estado', 'al_dia')
        ->where('vehiculos.0.km_recorridos', 7000)
        ->where('vehiculos.0.km_restantes', 3000)
    );
});

it('marca sin_service cuando hay km pero ningún service registrado', function () {
    $veh = nuevoVehiculo('AAA111');
    nuevaRevision($veh, 8000);

    $this->actingAs($this->admin)->get('/services')->assertInertia(fn (Assert $p) => $p
        ->where('vehiculos.0.estado', 'sin_service')
        ->where('vehiculos.0.km_actual', 8000)
        ->where('vehiculos.0.ultimo_service', null)
    );
});

it('marca sin_km cuando el vehículo no tiene ninguna revisión', function () {
    nuevoVehiculo('AAA111');

    $this->actingAs($this->admin)->get('/services')->assertInertia(fn (Assert $p) => $p
        ->where('vehiculos.0.estado', 'sin_km')
        ->where('vehiculos.0.km_actual', null)
    );
});

it('usa el km más reciente de las revisiones (por fecha de creación, cerrada o no)', function () {
    $veh = nuevoVehiculo('AAA111');
    $vieja = nuevaRevision($veh, 9000);
    $vieja->update(['created_at' => now()->subDays(5)]);
    nuevaRevision($veh, 25000); // la más reciente
    Service::create(['vehiculo_id' => $veh->id, 'kilometraje' => 10000, 'fecha' => now()]);

    $this->actingAs($this->admin)->get('/services')->assertInertia(fn (Assert $p) => $p
        ->where('vehiculos.0.km_actual', 25000)
        ->where('vehiculos.0.km_recorridos', 15000)
        ->where('vehiculos.0.estado', 'vencido')
    );
});

it('toma el service más reciente como referencia', function () {
    $veh = nuevoVehiculo('AAA111');
    nuevaRevision($veh, 18000);
    Service::create(['vehiculo_id' => $veh->id, 'kilometraje' => 5000, 'fecha' => now()->subMonths(2)]);
    Service::create(['vehiculo_id' => $veh->id, 'kilometraje' => 15000, 'fecha' => now()]);

    $this->actingAs($this->admin)->get('/services')->assertInertia(fn (Assert $p) => $p
        ->where('vehiculos.0.ultimo_service.kilometraje', 15000)
        ->where('vehiculos.0.km_recorridos', 3000)
        ->where('vehiculos.0.estado', 'al_dia')
    );
});

it('excluye el vehículo EXTERNO del listado', function () {
    nuevoVehiculo('EXTERNO');
    nuevoVehiculo('AAA111');

    $this->actingAs($this->admin)->get('/services')->assertInertia(fn (Assert $p) => $p
        ->has('vehiculos', 1)
        ->where('vehiculos.0.patente', 'AAA111')
    );
});

it('permite registrar un service', function () {
    $veh = nuevoVehiculo('AAA111');

    $this->actingAs($this->admin)
        ->post("/services/{$veh->id}", ['kilometraje' => 30000, 'fecha' => '2026-05-20', 'observaciones' => 'Cambio de aceite'])
        ->assertRedirect();

    $service = Service::first();
    expect($service)->not->toBeNull()
        ->and($service->kilometraje)->toBe(30000)
        ->and($service->realizado_por)->toBe($this->admin->id)
        ->and($service->vehiculo_id)->toBe($veh->id);
});

it('valida que el kilometraje sea obligatorio al registrar un service', function () {
    $veh = nuevoVehiculo('AAA111');

    $this->actingAs($this->admin)
        ->post("/services/{$veh->id}", ['fecha' => '2026-05-20'])
        ->assertSessionHasErrors('kilometraje');
});

it('permite eliminar un registro de service', function () {
    $veh = nuevoVehiculo('AAA111');
    $service = Service::create(['vehiculo_id' => $veh->id, 'kilometraje' => 5000, 'fecha' => now()]);

    $this->actingAs($this->admin)->delete("/services/{$service->id}")->assertRedirect();

    expect(Service::find($service->id))->toBeNull();
});

it('el mecánico puede acceder al panel de service', function () {
    $mecanico = User::factory()->create(['role' => UserRole::MECANICO, 'dni' => '40000002']);

    $this->actingAs($mecanico)->get('/services')->assertOk();
});

it('el chofer y el inversor no pueden acceder al panel de service', function () {
    $chofer = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '40000003']);
    $inversor = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '40000004']);

    $this->actingAs($chofer)->get('/services')->assertForbidden();
    $this->actingAs($inversor)->get('/services')->assertForbidden();
});
