<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\AperturaRecaudacion;
use App\Models\CierreRecaudacion;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Recaudacion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa = Empresa::create(['nombre' => 'EMP_PRECIO']);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '30000001',
        'empresa_default_id' => $this->empresa->id,
    ]);

    $this->chofer = User::factory()->create([
        'role' => UserRole::CHOFER,
        'dni' => '30000002',
    ]);

    $this->inversion = Inversion::create(['nombre' => 'INV', 'empresa_id' => $this->empresa->id]);

    // Precio del vehículo al abrir el período.
    $this->vehiculo = Vehiculo::withoutGlobalScopes()->create([
        'patente' => 'PRE111',
        'marca' => 'Toyota',
        'modelo' => 'Etios',
        'anio' => '2020',
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
        'user_id' => $this->chofer->id,
        'precio' => 100000,
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);
});

/** Crea la apertura con la fila congelada al precio indicado. */
function precioApertura(float $precioSnapshot): AperturaRecaudacion
{
    $apertura = AperturaRecaudacion::create([
        'empresa_id' => test()->empresa->id,
        'user_id' => test()->admin->id,
    ]);

    Recaudacion::create([
        'vehiculo_id' => test()->vehiculo->id,
        'user_id' => test()->chofer->id,
        'empresa_id' => test()->empresa->id,
        'apertura_id' => $apertura->id,
        'efectivo' => 0,
        'transferencia' => 0,
        'total' => 0,
        'descuento' => 0,
        'precio' => $precioSnapshot,
        'descripcion' => null,
    ]);

    return $apertura;
}

it('acepta un total hasta el precio actual del vehículo aunque el snapshot sea menor', function () {
    precioApertura(0);

    $this->patch("/recaudaciones/{$this->vehiculo->id}", [
        'efectivo' => 100000,
        'transferencia' => 0,
        'descuento' => 0,
        'descripcion' => '',
    ])->assertSessionHasNoErrors();

    $r = Recaudacion::first();

    expect((float) $r->total)->toBe(100000.0)
        ->and((float) $r->precio)->toBe(100000.0)
        ->and($r->estado)->toBe('pagado');
});

it('rechaza un total que supera el precio actual del vehículo menos el descuento', function () {
    precioApertura(100000);

    $this->vehiculo->update(['precio' => 80000]);

    $this->patch("/recaudaciones/{$this->vehiculo->id}", [
        'efectivo' => 75000,
        'transferencia' => 0,
        'descuento' => 10000,
        'descripcion' => '',
    ])->assertSessionHasErrors('transferencia');

    expect((float) Recaudacion::first()->total)->toBe(0.0);
});

it('sincroniza el precio de las filas abiertas al listar recaudaciones', function () {
    precioApertura(100000);

    $this->vehiculo->update(['precio' => 150000]);

    $this->get('/recaudaciones')->assertOk();

    expect((float) Recaudacion::first()->precio)->toBe(150000.0);
});

it('no toca el precio congelado de las recaudaciones ya cerradas', function () {
    $apertura = precioApertura(100000);

    $cierre = CierreRecaudacion::create([
        'empresa_id' => $this->empresa->id,
        'user_id' => $this->admin->id,
    ]);

    Recaudacion::first()->update(['cierre_id' => $cierre->id]);

    $this->vehiculo->update(['precio' => 150000]);

    $this->get('/recaudaciones')->assertOk();

    expect((float) Recaudacion::first()->precio)->toBe(100000.0);
});
