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

it('crea un cierre con el snapshot por tipo y por patente', function () {
    gastoTest(['tipo' => 'galpon', 'monto' => 1000]);
    gastoTest(['tipo' => 'taller', 'monto' => 500]);
    gastoTest(['tipo' => 'oficina', 'monto' => 200]);

    $veh1 = vehiculoTest('AAA111');
    $veh2 = vehiculoTest('BBB222');
    gastoTest(['tipo' => 'vehiculo', 'monto' => 300, 'vehiculo_id' => $veh1->id]);
    gastoTest(['tipo' => 'vehiculo', 'monto' => 700, 'vehiculo_id' => $veh1->id]);
    gastoTest(['tipo' => 'vehiculo', 'monto' => 400, 'vehiculo_id' => $veh2->id]);

    $this->post('/cierres-gasto')->assertRedirect();

    $cierre = CierreGasto::first();
    expect($cierre)->not->toBeNull()
        ->and((float) $cierre->total_general)->toBe(3100.0);

    $detalles = $cierre->detalles;
    // 3 categorías + 2 vehículos
    expect($detalles)->toHaveCount(5);

    $porTipo = $detalles->where('tipo', '!=', 'vehiculo')->pluck('total', 'tipo')
        ->map(fn ($v) => (float) $v);
    expect($porTipo['galpon'])->toBe(1000.0)
        ->and($porTipo['taller'])->toBe(500.0)
        ->and($porTipo['oficina'])->toBe(200.0);

    $porPatente = $detalles->where('tipo', 'vehiculo')->pluck('total', 'patente')
        ->map(fn ($v) => (float) $v);
    expect($porPatente['AAA111'])->toBe(1000.0)
        ->and($porPatente['BBB222'])->toBe(400.0);
});

it('rechaza cerrar cuando no hay gastos pendientes', function () {
    $this->post('/cierres-gasto')->assertSessionHas('error');

    expect(CierreGasto::count())->toBe(0);
});

it('archiva los gastos: tras cerrar no aparecen en la lista y un nuevo cierre solo toma los nuevos', function () {
    gastoTest(['tipo' => 'galpon', 'monto' => 1000]);

    // Primer cierre: toma el gasto inicial.
    $this->post('/cierres-gasto')->assertRedirect();
    expect((float) CierreGasto::latest('id')->first()->total_general)->toBe(1000.0);

    // La lista de gastos ya no muestra lo archivado.
    $this->get('/gastos')->assertInertia(fn (Assert $p) => $p->has('gastos', 0));

    // Nuevo gasto posterior al cierre.
    $this->travel(10)->seconds();
    gastoTest(['tipo' => 'taller', 'monto' => 250]);

    $this->get('/gastos')->assertInertia(fn (Assert $p) => $p->has('gastos', 1));

    // Segundo cierre: solo el gasto nuevo.
    $this->post('/cierres-gasto')->assertRedirect();
    expect((float) CierreGasto::latest('id')->first()->total_general)->toBe(250.0);
});

it('muestra el detalle del cierre con desglose', function () {
    gastoTest(['tipo' => 'galpon', 'monto' => 800]);
    $veh = vehiculoTest('CCC333');
    gastoTest(['tipo' => 'vehiculo', 'monto' => 600, 'vehiculo_id' => $veh->id]);

    $this->post('/cierres-gasto');
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

it('lista los cierres realizados', function () {
    gastoTest(['monto' => 100]);
    $this->post('/cierres-gasto');

    $this->get('/cierres-gasto')->assertInertia(fn (Assert $p) => $p
        ->component('CierresGasto/Index')
        ->has('cierres.data', 1)
    );
});

it('descarga el PDF del cierre', function () {
    gastoTest(['monto' => 100]);
    $this->post('/cierres-gasto');
    $cierre = CierreGasto::first();

    $this->get("/pdf/cierres-gasto/{$cierre->id}")
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});

it('protege la exportación a Excel del cierre (solo admin)', function () {
    gastoTest(['monto' => 100]);
    $this->post('/cierres-gasto');
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
    $this->post('/cierres-gasto')->assertRedirect();
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
    $this->post('/cierres-gasto')->assertRedirect();
    $cierreB = CierreGasto::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
        ->where('empresa_id', $empresaB->id)->latest('id')->first();
    expect((float) $cierreB->total_general)->toBe(700.0);
});

it('solo el administrador puede acceder a los cierres de gastos', function () {
    $administrativo = User::factory()->create(['role' => UserRole::ADMINISTRATIVO, 'dni' => '50000002']);
    $mecanico = User::factory()->create(['role' => UserRole::MECANICO, 'dni' => '50000003']);

    $this->actingAs($administrativo)->get('/cierres-gasto')->assertForbidden();
    $this->actingAs($mecanico)->get('/cierres-gasto')->assertForbidden();
});
