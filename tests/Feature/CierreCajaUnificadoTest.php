<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\AperturaCaja;
use App\Models\Articulo;
use App\Models\CierreCaja;
use App\Models\CierreDetalle;
use App\Models\CierreGasto;
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
        'dni' => '70000001',
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);
});

function vehUnif(string $patente): Vehiculo
{
    return Vehiculo::factory()->create([
        'patente' => $patente,
        'inversion_id' => test()->inversion->id,
        'empresa_id' => test()->empresa->id,
    ]);
}

function cobroUnif(Vehiculo $veh, float $precio, int $cantidad): void
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

function gastoUnif(array $overrides = []): Gasto
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

it('abre un período de caja y el index lo refleja', function () {
    $this->post('/cobros/abrir')->assertRedirect();

    expect(AperturaCaja::abierta()->count())->toBe(1);

    $this->get('/cobros')->assertInertia(fn (Assert $p) => $p
        ->where('abierta', true)
        ->where('apertura.user.name', $this->admin->name)
    );
});

it('no permite abrir dos períodos a la vez', function () {
    $this->post('/cobros/abrir')->assertRedirect();
    $this->post('/cobros/abrir')->assertSessionHas('warning');

    expect(AperturaCaja::count())->toBe(1);
});

it('no permite cerrar sin un período abierto', function () {
    $veh = vehUnif('AAA111');
    cobroUnif($veh, 100, 1);

    $this->post('/cobros/cierre')->assertSessionHas('warning');

    expect(CierreCaja::count())->toBe(0);
});

it('rechaza cerrar cuando no hay cobros ni gastos pendientes', function () {
    $this->post('/cobros/abrir')->assertRedirect();
    $this->post('/cobros/cierre')->assertSessionHas('warning');

    expect(CierreCaja::count())->toBe(0)
        ->and(AperturaCaja::abierta()->count())->toBe(1);
});

it('el cierre unificado congela cobros y gastos juntos y cierra la apertura', function () {
    $veh = vehUnif('AAA111');
    cobroUnif($veh, 100, 2);                                   // cobros = 200
    gastoUnif(['tipo' => 'galpon', 'monto' => 500]);          // gasto global = 500
    gastoUnif(['tipo' => 'vehiculo', 'monto' => 300, 'vehiculo_id' => $veh->id]); // gasto vehículo = 300

    $this->post('/cobros/abrir')->assertRedirect();
    $this->post('/cobros/cierre')->assertRedirect()->assertSessionHas('success');

    $cierre = CierreCaja::first();
    expect($cierre)->not->toBeNull();

    // Cobros snapshot por inversión.
    expect((float) CierreDetalle::where('cierre_id', $cierre->id)->sum('total'))->toBe(200.0);

    // Gastos archivados como hijo del cierre de caja.
    $cierreGasto = CierreGasto::where('cierre_caja_id', $cierre->id)->first();
    expect($cierreGasto)->not->toBeNull()
        ->and((float) $cierreGasto->total_general)->toBe(800.0);

    // La apertura quedó cerrada y los cobros/gastos ya no están pendientes.
    expect(AperturaCaja::abierta()->count())->toBe(0)
        ->and(Cobro::query()->pendientes()->count())->toBe(0)
        ->and(Gasto::query()->pendientes()->count())->toBe(0);
});

it('el index muestra cobros y gastos del período por separado', function () {
    $veh = vehUnif('AAA111');
    cobroUnif($veh, 100, 2);                          // cobros = 200
    gastoUnif(['tipo' => 'galpon', 'monto' => 500]);  // gastos = 500

    $this->get('/cobros')->assertInertia(fn (Assert $p) => $p
        ->component('Cobros/Index')
        ->where('totalGeneral', 200)
        ->where('gastosResumen.total', 500)
        ->where('gastosResumen.count', 1)
    );
});

it('la pestaña Gastos excluye la flota y el integrado de Inventario la ancla al vehículo', function () {
    $veh = vehUnif('AAA111');
    cobroUnif($veh, 100, 2);                                                        // cobros = 200
    gastoUnif(['tipo' => 'galpon', 'monto' => 500]);                                // no-flota = 500
    gastoUnif(['tipo' => 'vehiculo', 'monto' => 300, 'vehiculo_id' => $veh->id]);   // flota = 300

    $this->get('/cobros')->assertInertia(fn (Assert $p) => $p
        // Pestaña Gastos: solo el no-flota (galpón), la flota NO aparece acá.
        ->where('gastosResumen.total', 500)
        ->where('gastosResumen.count', 1)
        ->where('gastosResumen.gastos.0.tipo', 'galpon')
        // Inventario integrado: la flota queda anclada al vehículo.
        ->where('resumenIntegrado.0.total_cobros', 200)
        ->where('resumenIntegrado.0.total_gastos', 300)
        ->where('resumenIntegrado.0.vehiculos.0.patente', 'AAA111')
        ->where('resumenIntegrado.0.vehiculos.0.gastos', 300)
        // El total de gastos a cerrar incluye todo (flota + no-flota).
        ->where('totalGastos', 800)
    );
});

it('el historial de cierres expone los totales de cobros y gastos', function () {
    $veh = vehUnif('AAA111');
    cobroUnif($veh, 100, 2);
    gastoUnif(['tipo' => 'galpon', 'monto' => 500]);

    $this->post('/cobros/abrir');
    $this->post('/cobros/cierre');

    $cierre = CierreCaja::first();

    $this->get('/cobros')->assertInertia(fn (Assert $p) => $p
        ->where('historialCierres.0.total_cobros', 200)
        ->where('historialCierres.0.total_gastos', 500)
        ->where('historialCierres.0.total', 700)
        ->where('historialCierres.0.gasto_cierre_id', $cierre->cierreGasto->id)
    );
});

it('solo el administrador puede abrir y cerrar la caja', function () {
    $administrativo = User::factory()->create(['role' => UserRole::ADMINISTRATIVO, 'dni' => '70000002']);

    $this->actingAs($administrativo);
    session(['active_company_id' => $this->empresa->id]);

    $this->post('/cobros/abrir')->assertForbidden();
    $this->post('/cobros/cierre')->assertForbidden();
});
