<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Articulo;
use App\Models\Cobro;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Inversion;
use App\Models\Transaccion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa = Empresa::create(['nombre' => 'Empresa Test']);
    $this->inversion = Inversion::create(['nombre' => 'Inv Test', 'empresa_id' => $this->empresa->id]);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '60000001',
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);
});

function vehiculoCobro(string $patente): Vehiculo
{
    return Vehiculo::factory()->create([
        'patente' => $patente,
        'inversion_id' => test()->inversion->id,
        'empresa_id' => test()->empresa->id,
    ]);
}

function cobroDe(Vehiculo $veh, float $precio, int $cantidad): void
{
    $articulo = Articulo::create([
        'descripcion' => 'Art '.uniqid(),
        'stock' => 100,
        'min_stock' => 1,
        'precio' => $precio,
    ]);

    $tx = Transaccion::create([
        'articulo_id' => $articulo->id,
        'user_id' => test()->admin->id,
        'vehiculo_id' => $veh->id,
        'tipo' => 'OUT',
        'cantidad' => $cantidad,
    ]);

    Cobro::create([
        'inversion_id' => test()->inversion->id,
        'transaccion_id' => $tx->id,
        'empresa_id' => test()->empresa->id,
    ]);
}

function gastoVehiculoCobro(Vehiculo $veh, float $monto): Gasto
{
    return Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => $monto,
        'user_id' => test()->admin->id,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'vehiculo',
        'vehiculo_id' => $veh->id,
    ]);
}

it('integra cobros y gastos por inversión con desglose por vehículo', function () {
    $veh = vehiculoCobro('AAA111');
    cobroDe($veh, 100, 2);          // cobros = 200
    gastoVehiculoCobro($veh, 500);  // gastos = 500

    $this->get('/cobros')->assertInertia(fn (Assert $p) => $p
        ->component('Cobros/Index')
        ->where('totalIntegrado', 700)
        ->has('resumenIntegrado', 1)
        ->where('resumenIntegrado.0.total_cobros', 200)
        ->where('resumenIntegrado.0.total_gastos', 500)
        ->where('resumenIntegrado.0.total', 700)
        ->where('resumenIntegrado.0.vehiculos.0.patente', 'AAA111')
        ->where('resumenIntegrado.0.vehiculos.0.cobros', 200)
        ->where('resumenIntegrado.0.vehiculos.0.gastos', 500)
        ->where('resumenIntegrado.0.vehiculos.0.total', 700)
        // Detalle línea a línea.
        ->has('resumenIntegrado.0.vehiculos.0.cobros_detalle', 1)
        ->where('resumenIntegrado.0.vehiculos.0.cobros_detalle.0.cantidad', 2)
        ->where('resumenIntegrado.0.vehiculos.0.cobros_detalle.0.subtotal', 200)
        ->has('resumenIntegrado.0.vehiculos.0.gastos_detalle', 1)
        ->where('resumenIntegrado.0.vehiculos.0.gastos_detalle.0.monto', 500)
    );
});

it('incluye un vehículo que solo tiene gastos (sin cobros)', function () {
    $veh = vehiculoCobro('AAA111');
    gastoVehiculoCobro($veh, 300);

    $this->get('/cobros')->assertInertia(fn (Assert $p) => $p
        ->where('resumenIntegrado.0.total_cobros', 0)
        ->where('resumenIntegrado.0.total_gastos', 300)
        ->where('resumenIntegrado.0.total', 300)
    );
});

it('descarga el PDF del resumen integrado', function () {
    $veh = vehiculoCobro('AAA111');
    cobroDe($veh, 100, 2);
    gastoVehiculoCobro($veh, 500);

    $this->get('/pdf/cobros-integrado')
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});

it('protege la exportación a Excel del resumen integrado (solo admin)', function () {
    $administrativo = User::factory()->create(['role' => UserRole::ADMINISTRATIVO, 'dni' => '60000009']);

    $this->actingAs($administrativo)->get('/excel/cobros-integrado')->assertForbidden();
});

it('no integra gastos globales (sin vehículo)', function () {
    $veh = vehiculoCobro('AAA111');
    cobroDe($veh, 100, 1); // cobros = 100

    // Gasto global: no debe sumarse al resumen integrado.
    Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 9999,
        'user_id' => $this->admin->id,
        'recibio' => 'Galpón',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
        'vehiculo_id' => null,
    ]);

    $this->get('/cobros')->assertInertia(fn (Assert $p) => $p
        ->where('totalIntegrado', 100)
        ->where('resumenIntegrado.0.total_gastos', 0)
    );
});
