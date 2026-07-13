<?php

declare(strict_types=1);

use App\Actions\BuildResumenIntegradoAction;
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

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa = Empresa::create(['nombre' => 'Empresa PDF']);
    $this->inversion = Inversion::create(['nombre' => 'INV_1', 'empresa_id' => $this->empresa->id]);
    $this->admin = User::factory()->create(['role' => UserRole::ADMINISTRADOR, 'dni' => '72000001']);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);

    $this->veh = Vehiculo::factory()->create([
        'patente' => 'PDF123',
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
    ]);

    // Cobro de 200 sobre el vehículo.
    $art = Articulo::create(['descripcion' => 'Filtro', 'stock' => 100, 'min_stock' => 1, 'precio' => 100]);
    $tx = Transaccion::create([
        'articulo_id' => $art->id,
        'user_id' => $this->admin->id,
        'vehiculo_id' => $this->veh->id,
        'tipo' => 'OUT',
        'cantidad' => 2,
    ]);
    Cobro::create([
        'inversion_id' => $this->inversion->id,
        'transaccion_id' => $tx->id,
        'empresa_id' => $this->empresa->id,
    ]);

    // Gasto de flota (tipo vehículo) de 300 sobre el mismo auto.
    Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 300,
        'user_id' => $this->admin->id,
        'recibio' => 'Taller',
        'metodo_pago' => 'efectivo',
        'tipo' => 'vehiculo',
        'vehiculo_id' => $this->veh->id,
    ]);
});

it('el PDF de cobros incluye los gastos de cada auto', function () {
    $resumen = app(BuildResumenIntegradoAction::class)->execute();
    $html = view('pdf.cobros', ['resumen' => $resumen, 'total' => $resumen->sum('total')])->render();

    expect($html)
        ->toContain('PDF123')
        ->toContain('Cobros $200')
        ->toContain('Gastos $300')
        ->toContain('Gasto ·');

    $res = $this->get('/pdf/cobros');
    $res->assertOk();
    expect($res->headers->get('content-type'))->toContain('application/pdf');
});

it('el PDF del cierre de caja incluye los gastos de cada auto', function () {
    $this->post('/cobros/abrir')->assertRedirect();
    $this->post('/cobros/cierre')->assertRedirect();
    $cierre = CierreCaja::latest()->firstOrFail();

    $previous = CierreCaja::where('created_at', '<', $cierre->created_at)->latest()->value('created_at');
    $resumen = app(BuildResumenIntegradoAction::class)->execute(
        $previous?->toDateTimeString(),
        $cierre->created_at->toDateTimeString(),
    );
    $empresas = $resumen->groupBy('empresa_nombre');
    $html = view('pdf.cierre-caja', [
        'cierre' => $cierre->load('user:id,name'),
        'empresas' => $empresas,
        'total' => $resumen->sum('total'),
    ])->render();

    expect($html)
        ->toContain('PDF123')
        ->toContain('Gastos $300')
        ->toContain('Gasto ·');

    $res = $this->get("/pdf/cierres-caja/{$cierre->id}");
    $res->assertOk();
    expect($res->headers->get('content-type'))->toContain('application/pdf');
});
