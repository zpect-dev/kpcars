<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Articulo;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Transaccion;
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
        'must_change_password' => false,
    ]);

    $this->vehiculo = Vehiculo::create([
        'patente' => 'AAA111',
        'marca' => 'Toyota',
        'modelo' => 'Etios',
        'anio' => '2020',
        'precio' => 360000,
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
    ]);

    $this->articulo = Articulo::create(['descripcion' => 'Filtro de Aceite', 'stock' => 10]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);
});

function crearTransaccion(array $overrides = []): Transaccion
{
    return Transaccion::create(array_merge([
        'articulo_id' => test()->articulo->id,
        'user_id' => test()->admin->id,
        'vehiculo_id' => test()->vehiculo->id,
        'tipo' => 'OUT',
        'cantidad' => 1,
        'inactiva' => false,
    ], $overrides));
}

it('elimina un vehículo que tiene transacciones asociadas', function () {
    crearTransaccion();

    $this->delete("/vehiculos/{$this->vehiculo->id}")
        ->assertSessionHas('success');

    expect(Vehiculo::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)->count())->toBe(0);
});

it('deja vehiculo_id en null y la patente en la descripción', function () {
    $transaccion = crearTransaccion(['descripcion' => null]);

    $this->delete("/vehiculos/{$this->vehiculo->id}");

    $transaccion->refresh();

    expect($transaccion->vehiculo_id)->toBeNull()
        ->and($transaccion->descripcion)->toBe('Vehículo AAA111 (eliminado)');
});

it('conserva la descripción existente y le agrega la patente', function () {
    $transaccion = crearTransaccion(['descripcion' => 'Cambio de aceite']);

    $this->delete("/vehiculos/{$this->vehiculo->id}");

    expect($transaccion->refresh()->descripcion)
        ->toBe('Cambio de aceite · Vehículo AAA111 (eliminado)');
});

it('también estampa la patente en las transacciones anuladas', function () {
    $anulada = crearTransaccion(['inactiva' => true]);

    $this->delete("/vehiculos/{$this->vehiculo->id}");

    $anulada = Transaccion::withoutGlobalScope('activa')->find($anulada->id);

    expect($anulada->vehiculo_id)->toBeNull()
        ->and($anulada->descripcion)->toBe('Vehículo AAA111 (eliminado)');
});
