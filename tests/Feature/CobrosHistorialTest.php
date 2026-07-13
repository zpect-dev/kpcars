<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Articulo;
use App\Models\CierreCaja;
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
    $this->empresa = Empresa::create(['nombre' => 'Empresa Hist']);
    $this->inversion = Inversion::create(['nombre' => 'Inv Hist', 'empresa_id' => $this->empresa->id]);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '71000001',
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);
});

function histVeh(string $patente): Vehiculo
{
    return Vehiculo::factory()->create([
        'patente' => $patente,
        'inversion_id' => test()->inversion->id,
        'empresa_id' => test()->empresa->id,
    ]);
}

function histCobro(Vehiculo $veh, float $precio, int $cantidad): void
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

/** Abre caja, registra cobro + gasto y cierra: devuelve el CierreCaja creado. */
function histCierre(): CierreCaja
{
    $veh = histVeh('HIS'.random_int(100, 999));
    histCobro($veh, 100, 2); // cobros = 200
    Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 500,
        'user_id' => test()->admin->id,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
        'vehiculo_id' => null,
    ]);

    test()->post('/cobros/abrir')->assertRedirect();
    test()->post('/cobros/cierre')->assertRedirect()->assertSessionHas('success');

    return CierreCaja::latest()->firstOrFail();
}

it('el historial lista los cierres con sus totales', function () {
    $cierre = histCierre();

    $this->get('/cobros/historial')->assertOk()->assertInertia(fn (Assert $p) => $p
        ->component('Cobros/Historial')
        ->has('cierres', 1)
        ->where('cierres.0.id', $cierre->id)
        ->where('cierres.0.total_cobros', 200)
        ->where('cierres.0.total_gastos', 500)
        ->where('cierres.0.total', 700)
    );
});

it('la réplica de un cierre reusa Cobros/Index con la meta historico y los datos del período', function () {
    $cierre = histCierre();

    $this->get("/cobros/historial/{$cierre->id}")->assertOk()->assertInertia(fn (Assert $p) => $p
        ->component('Cobros/Index')
        ->where('historico.id', $cierre->id)
        ->where('abierta', false)
        ->where('totalGeneral', 200)
        ->has('resumen', 1)
        ->has('resumenIntegrado')
        ->has('gastosResumen')
    );
});

it('el index de cobros del período actual queda vacío después del cierre', function () {
    histCierre();

    // Tras cerrar, el período actual no tiene cobros pendientes.
    $this->get('/cobros')->assertOk()->assertInertia(fn (Assert $p) => $p
        ->component('Cobros/Index')
        ->where('totalGeneral', 0)
        ->missing('historico')
    );
});

it('exporta en PDF los gastos de un cierre histórico', function () {
    $cierre = histCierre(); // incluye un gasto galpón de 500

    $res = $this->get("/pdf/cobros-gastos/{$cierre->id}");
    $res->assertOk();
    expect($res->headers->get('content-type'))->toContain('application/pdf');
});

it('exporta en PDF los gastos del período actual', function () {
    Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 250,
        'user_id' => $this->admin->id,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'taller',
        'vehiculo_id' => null,
    ]);

    $res = $this->get('/pdf/cobros-gastos');
    $res->assertOk();
    expect($res->headers->get('content-type'))->toContain('application/pdf');
});

it('las cards de gastos muestran el reparto por empresa', function () {
    $emp2 = Empresa::create(['nombre' => 'Empresa Dos']);

    // Gasto global (galpón) repartido entre la empresa activa y otra.
    Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 237000,
        'user_id' => $this->admin->id,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
        'vehiculo_id' => null,
        'distribucion_empresas' => [
            $this->empresa->id => 219444.45,
            $emp2->id => 17555.55,
        ],
    ]);

    $this->get('/cobros')->assertOk()->assertInertia(fn (Assert $p) => $p
        ->component('Cobros/Index')
        ->where('gastosResumen.cards.0.key', 'empresa_'.$this->empresa->id)
        ->where('gastosResumen.cards.0.total', 219444.45)
        ->where('gastosResumen.cards.1.key', 'empresa_'.$emp2->id)
        ->where('gastosResumen.cards.1.total', 17555.55)
        ->where('gastosResumen.cards.3.key', 'galpon')
        ->where('gastosResumen.cards.3.total', 237000)
    );
});

it('no permite ver la réplica de un cierre de otra empresa', function () {
    $cierre = histCierre();

    // Cambiar a otra empresa activa: CierreCaja está tenant-scopeado, así que
    // el binding del modelo no lo encuentra para otra empresa → 404.
    $otra = Empresa::create(['nombre' => 'Otra Empresa']);
    $this->admin->empresas()->syncWithoutDetaching([$otra->id]);
    session(['active_company_id' => $otra->id]);

    $this->get("/cobros/historial/{$cierre->id}")->assertNotFound();
});
