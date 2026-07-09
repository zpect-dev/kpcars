<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\CierreGasto;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Inversion;
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
        'dni' => '50000001',
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);
});

function gastoTest(array $overrides = []): Gasto
{
    return Gasto::create(array_merge([
        'fecha' => now()->toDateString(),
        'monto' => 1000,
        'user_id' => test()->admin->id,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
        'vehiculo_id' => null,
    ], $overrides));
}

function vehiculoTest(string $patente): Vehiculo
{
    return Vehiculo::factory()->create([
        'patente' => $patente,
        'inversion_id' => test()->inversion->id,
        'empresa_id' => test()->empresa->id,
    ]);
}

/**
 * El cierre de gastos ya no es autónomo: forma parte del cierre unificado de
 * caja. Se abre un período y se cierra; el CierreGasto queda como hijo del
 * CierreCaja (cierre_caja_id).
 */
function cerrarCajaTest(): \Illuminate\Testing\TestResponse
{
    test()->post('/cobros/abrir');

    return test()->post('/cobros/cierre');
}

it('crea un cierre de gastos hijo con el snapshot por tipo y por patente', function () {
    gastoTest(['tipo' => 'galpon', 'monto' => 1000]);
    gastoTest(['tipo' => 'taller', 'monto' => 500]);
    gastoTest(['tipo' => 'oficina', 'monto' => 200]);

    $veh1 = vehiculoTest('AAA111');
    $veh2 = vehiculoTest('BBB222');
    gastoTest(['tipo' => 'vehiculo', 'monto' => 300, 'vehiculo_id' => $veh1->id]);
    gastoTest(['tipo' => 'vehiculo', 'monto' => 700, 'vehiculo_id' => $veh1->id]);
    gastoTest(['tipo' => 'vehiculo', 'monto' => 400, 'vehiculo_id' => $veh2->id]);

    cerrarCajaTest()->assertRedirect();

    $cierre = CierreGasto::first();
    expect($cierre)->not->toBeNull()
        ->and((float) $cierre->total_general)->toBe(3100.0)
        // Vinculado al cierre de caja padre.
        ->and($cierre->cierre_caja_id)->not->toBeNull();

    // Los gastos quedaron archivados (vinculados al cierre).
    expect(Gasto::where('cierre_gasto_id', $cierre->id)->count())->toBe(6);

    // El desglose se deriva de los gastos, sin tablas auxiliares.
    ['porTipo' => $porTipo, 'porVehiculo' => $porVehiculo] = $cierre->desglose();
    expect($porTipo)->toHaveCount(3)
        ->and($porVehiculo)->toHaveCount(2);

    $tipo = $porTipo->keyBy('tipo');
    expect($tipo['galpon']->total)->toBe(1000.0)
        ->and($tipo['taller']->total)->toBe(500.0)
        ->and($tipo['oficina']->total)->toBe(200.0);

    $patente = $porVehiculo->keyBy('patente');
    expect($patente['AAA111']->total)->toBe(1000.0)
        ->and($patente['BBB222']->total)->toBe(400.0);
});

it('al borrar el cierre de gastos, sus gastos vuelven a pendientes', function () {
    gastoTest(['tipo' => 'galpon', 'monto' => 500]);

    cerrarCajaTest()->assertRedirect();
    $cierre = CierreGasto::first();
    expect(Gasto::where('cierre_gasto_id', $cierre->id)->count())->toBe(1);

    // Borrar el cierre libera los gastos (FK nullOnDelete).
    $cierre->delete();

    expect(Gasto::whereNull('cierre_gasto_id')->count())->toBe(1);
    $this->get('/gastos')->assertInertia(fn (Assert $p) => $p->has('gastos', 1));
});

it('congela el reparto entre inversores en la columna distribucion al crear el gasto', function () {
    $inversorA = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '60000001', 'inactivo' => false]);
    $inversorB = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '60000002', 'inactivo' => false]);
    $this->inversion->inversores()->attach([$inversorA->id => ['deuda' => 0], $inversorB->id => ['deuda' => 0]]);

    // Registrar un gasto exige un período de caja abierto.
    \App\Models\AperturaCaja::create(['empresa_id' => $this->empresa->id, 'user_id' => $this->admin->id]);

    $this->post('/gastos', [
        'fecha' => now()->toDateString(),
        'monto' => 1000,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
    ])->assertRedirect();

    $gasto = Gasto::latest('id')->first();
    expect($gasto->distribucion)->toBeArray()
        ->and((float) array_sum($gasto->distribucion))->toBe(1000.0);
});

it('reparte galpón por empresa según autos alquilados y entre los inversores de cada empresa', function () {
    // Empresa A (la del beforeEach): 3 autos alquilados, 2 inversores.
    $invA1 = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '61000001', 'inactivo' => false]);
    $invA2 = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '61000002', 'inactivo' => false]);
    $this->inversion->inversores()->attach([
        $invA1->id => ['deuda' => 0],
        $invA2->id => ['deuda' => 0],
    ]);

    // Empresa B: 1 auto alquilado, 1 inversor.
    $empresaB = Empresa::create(['nombre' => 'Empresa B']);
    $inversionB = Inversion::create(['nombre' => 'Inv B', 'empresa_id' => $empresaB->id]);
    $invB = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '61000003', 'inactivo' => false]);
    $inversionB->inversores()->attach([$invB->id => ['deuda' => 0]]);

    // Chofer que "alquila" los autos (user_id no nulo = alquilado).
    $chofer = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '62000001']);

    foreach (['AAA001', 'AAA002', 'AAA003'] as $patente) {
        Vehiculo::factory()->create([
            'patente' => $patente,
            'empresa_id' => $this->empresa->id,
            'inversion_id' => $this->inversion->id,
            'user_id' => $chofer->id,
        ]);
    }
    Vehiculo::factory()->create([
        'patente' => 'BBB001',
        'empresa_id' => $empresaB->id,
        'inversion_id' => $inversionB->id,
        'user_id' => $chofer->id,
    ]);

    \App\Models\AperturaCaja::create(['empresa_id' => $this->empresa->id, 'user_id' => $this->admin->id]);

    $this->post('/gastos', [
        'fecha' => now()->toDateString(),
        'monto' => 1000,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
    ])->assertRedirect();

    $dist = Gasto::latest('id')->first()->distribucion;

    // Empresa A: 3/4 = 750, dividido entre sus 2 inversores = 375 c/u.
    // Empresa B: 1/4 = 250, para su único inversor.
    expect((float) $dist[$invA1->id])->toBe(375.0)
        ->and((float) $dist[$invA2->id])->toBe(375.0)
        ->and((float) $dist[$invB->id])->toBe(250.0)
        ->and((float) array_sum($dist))->toBe(1000.0);
});

it('una empresa con autos alquilados pero sin inversores figura en el reparto por empresa, sin imputar a inversores', function () {
    // Empresa A: 1 auto alquilado, 1 inversor.
    $invA = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '63000001', 'inactivo' => false]);
    $this->inversion->inversores()->attach([$invA->id => ['deuda' => 0]]);

    // Empresa B: 1 auto alquilado, SIN inversores.
    $empresaB = Empresa::create(['nombre' => 'Empresa B']);
    $inversionB = Inversion::create(['nombre' => 'Inv B', 'empresa_id' => $empresaB->id]);

    $chofer = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '64000001']);
    Vehiculo::factory()->create(['patente' => 'AAA010', 'empresa_id' => $this->empresa->id, 'inversion_id' => $this->inversion->id, 'user_id' => $chofer->id]);
    Vehiculo::factory()->create(['patente' => 'BBB010', 'empresa_id' => $empresaB->id, 'inversion_id' => $inversionB->id, 'user_id' => $chofer->id]);

    \App\Models\AperturaCaja::create(['empresa_id' => $this->empresa->id, 'user_id' => $this->admin->id]);

    $this->post('/gastos', [
        'fecha' => now()->toDateString(),
        'monto' => 1000,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
    ])->assertRedirect();

    $gasto = Gasto::latest('id')->first();

    // Reparto por empresa: ambas figuran 500/500 (refleja los autos alquilados).
    expect((float) $gasto->distribucion_empresas[$this->empresa->id])->toBe(500.0)
        ->and((float) $gasto->distribucion_empresas[$empresaB->id])->toBe(500.0);

    // Imputación a inversores: solo la parte de la empresa A (B queda sin imputar).
    expect((float) $gasto->distribucion[$invA->id])->toBe(500.0)
        ->and((float) array_sum($gasto->distribucion))->toBe(500.0);
});

it('rechaza registrar un gasto si no hay un período de caja abierto', function () {
    // Sin apertura: el alta de gasto debe rebotar con error y no crear nada.
    $this->post('/gastos', [
        'fecha' => now()->toDateString(),
        'monto' => 500,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
    ])->assertSessionHasErrors('tipo');

    expect(Gasto::count())->toBe(0);
});

it('archiva los gastos: tras cerrar no aparecen en la lista y un nuevo cierre solo toma los nuevos', function () {
    gastoTest(['tipo' => 'galpon', 'monto' => 1000]);

    // Primer cierre: toma el gasto inicial.
    cerrarCajaTest()->assertRedirect();
    expect((float) CierreGasto::latest('id')->first()->total_general)->toBe(1000.0);

    // La lista de gastos ya no muestra lo archivado.
    $this->get('/gastos')->assertInertia(fn (Assert $p) => $p->has('gastos', 0));

    // Nuevo gasto posterior al cierre.
    $this->travel(10)->seconds();
    gastoTest(['tipo' => 'taller', 'monto' => 250]);

    $this->get('/gastos')->assertInertia(fn (Assert $p) => $p->has('gastos', 1));

    // Segundo cierre: solo el gasto nuevo.
    cerrarCajaTest()->assertRedirect();
    expect((float) CierreGasto::latest('id')->first()->total_general)->toBe(250.0);
});

it('muestra el detalle del cierre de gastos con desglose', function () {
    gastoTest(['tipo' => 'galpon', 'monto' => 800]);
    $veh = vehiculoTest('CCC333');
    gastoTest(['tipo' => 'vehiculo', 'monto' => 600, 'vehiculo_id' => $veh->id]);

    cerrarCajaTest();
    $cierre = CierreGasto::first();

    $this->get("/cierres-gasto/{$cierre->id}")->assertInertia(fn (Assert $p) => $p
        ->component('CierresGasto/Show')
        ->where('cierre.total_general', 1400)
        ->where('porTipo.0.tipo', 'galpon')
        ->where('porTipo.0.total', 800)
        ->where('porVehiculo.0.patente', 'CCC333')
        ->where('porVehiculo.0.total', 600)
    );
});

it('descarga el PDF del cierre de gastos', function () {
    gastoTest(['monto' => 100]);
    cerrarCajaTest();
    $cierre = CierreGasto::first();

    $this->get("/pdf/cierres-gasto/{$cierre->id}")
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});

it('protege la exportación a Excel del cierre de gastos (solo admin)', function () {
    gastoTest(['monto' => 100]);
    cerrarCajaTest();
    $cierre = CierreGasto::first();

    // La ruta existe y está protegida: un no-admin no llega al controlador
    // (el middleware role:administrador corta antes de ejecutar el writer).
    $administrativo = User::factory()->create(['role' => UserRole::ADMINISTRATIVO, 'dni' => '50000009']);
    $this->actingAs($administrativo)->get("/excel/cierres-gasto/{$cierre->id}")->assertForbidden();
});

it('los gastos globales se cierran una sola vez para todas las empresas', function () {
    // Segunda empresa con su propio vehículo.
    $empresaB = Empresa::create(['nombre' => 'Empresa B']);
    $inversionB = Inversion::create(['nombre' => 'Inv B', 'empresa_id' => $empresaB->id]);
    $vehB = Vehiculo::factory()->create(['patente' => 'BBB222', 'inversion_id' => $inversionB->id, 'empresa_id' => $empresaB->id]);
    $vehA = vehiculoTest('AAA111');

    // Gasto global (sin vehículo) + gasto de vehículo en cada empresa.
    gastoTest(['tipo' => 'galpon', 'monto' => 1000, 'vehiculo_id' => null]);
    gastoTest(['tipo' => 'vehiculo', 'monto' => 500, 'vehiculo_id' => $vehA->id]);
    gastoTest(['tipo' => 'vehiculo', 'monto' => 700, 'vehiculo_id' => $vehB->id]);

    // Cierre en empresa A: incluye el global (1000) + vehículo A (500) = 1500.
    session(['active_company_id' => $this->empresa->id]);
    cerrarCajaTest()->assertRedirect();
    $cierreA = CierreGasto::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)->latest('id')->first();
    expect((float) $cierreA->total_general)->toBe(1500.0);

    // En empresa B: el gasto global YA está archivado (cerrado en A); solo
    // queda pendiente el gasto de vehículo de B.
    session(['active_company_id' => $empresaB->id]);
    $this->get('/gastos')->assertInertia(fn (Assert $p) => $p
        ->has('gastos', 1)
        ->where('gastos.0.vehiculo.patente', 'BBB222')
    );

    // Cierre en empresa B: solo el vehículo B (700), sin volver a contar el global.
    cerrarCajaTest()->assertRedirect();
    $cierreB = CierreGasto::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
        ->where('empresa_id', $empresaB->id)->latest('id')->first();
    expect((float) $cierreB->total_general)->toBe(700.0);
});

it('solo el administrador puede ver el detalle de un cierre de gastos', function () {
    gastoTest(['monto' => 100]);
    cerrarCajaTest();
    $cierre = CierreGasto::first();

    $administrativo = User::factory()->create(['role' => UserRole::ADMINISTRATIVO, 'dni' => '50000002']);
    $mecanico = User::factory()->create(['role' => UserRole::MECANICO, 'dni' => '50000003']);

    $this->actingAs($administrativo)->get("/cierres-gasto/{$cierre->id}")->assertForbidden();
    $this->actingAs($mecanico)->get("/cierres-gasto/{$cierre->id}")->assertForbidden();
});
