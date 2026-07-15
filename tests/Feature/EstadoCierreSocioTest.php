<?php

declare(strict_types=1);

use App\Actions\BuildEstadoCierreSocioAction;
use App\Actions\ProcessCierreUnificadoAction;
use App\Enums\UserRole;
use App\Models\AperturaRecaudacion;
use App\Models\CierreSueldo;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Inversion;
use App\Models\Recaudacion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa1 = Empresa::create(['nombre' => 'EMP_1']);
    $this->empresa2 = Empresa::create(['nombre' => 'EMP_2']);

    $this->admin = User::factory()->create(['role' => UserRole::ADMINISTRADOR, 'dni' => '10000001']);
    $this->socio = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '20000001', 'name' => 'Socio Uno']);

    $this->inv = Inversion::create(['nombre' => 'INV_1', 'empresa_id' => $this->empresa1->id]);
    $this->inv->inversores()->attach($this->socio->id, ['es_financiador' => false, 'deuda' => 0]);

    // Recaudación de 100.000 en un vehículo de la inversión (empresa 1).
    $ap1 = AperturaRecaudacion::withoutGlobalScopes()->create([
        'empresa_id' => $this->empresa1->id,
        'user_id' => $this->admin->id,
    ]);
    $this->veh = Vehiculo::withoutGlobalScopes()->create([
        'inversion_id' => $this->inv->id,
        'empresa_id' => $this->empresa1->id,
        'patente' => 'AAA111', 'marca' => 'Fiat', 'modelo' => 'Cronos', 'anio' => '2021',
    ]);
    Recaudacion::withoutGlobalScopes()->create([
        'vehiculo_id' => $this->veh->id,
        'empresa_id' => $this->empresa1->id,
        'apertura_id' => $ap1->id,
        'efectivo' => 100000, 'transferencia' => 0, 'total' => 100000, 'descuento' => 0, 'precio' => 100000,
    ]);

    // Empresa 2 con apertura vacía (el cierre unificado exige apertura por empresa).
    AperturaRecaudacion::withoutGlobalScopes()->create([
        'empresa_id' => $this->empresa2->id,
        'user_id' => $this->admin->id,
    ]);

    // Gastos del período: flota 5.000 + global galpón repartido (8.000 a EMP_1).
    Gasto::create([
        'fecha' => now()->toDateString(), 'monto' => 5000, 'user_id' => $this->admin->id,
        'recibio' => 'Taller', 'metodo_pago' => 'efectivo', 'tipo' => 'vehiculo', 'vehiculo_id' => $this->veh->id,
    ]);
    Gasto::create([
        'fecha' => now()->toDateString(), 'monto' => 10000, 'user_id' => $this->admin->id,
        'recibio' => 'Dueño', 'metodo_pago' => 'efectivo', 'tipo' => 'galpon', 'vehiculo_id' => null,
        'distribucion_empresas' => [$this->empresa1->id => 8000, $this->empresa2->id => 2000],
    ]);

    (new ProcessCierreUnificadoAction)->execute(1000, $this->admin);
    $this->cierre = CierreSueldo::latest()->firstOrFail();
});

it('arma el estado con recaudación, gastos prorrateados y sueldo', function () {
    $estado = app(BuildEstadoCierreSocioAction::class)->execute($this->cierre, $this->socio);

    expect($estado['totales']['recaudado'])->toBe(100000.0);

    $e = $estado['empresas']->firstWhere('empresa_nombre', 'EMP_1');
    expect($e)->not->toBeNull()
        ->and($e['recaudacion_empresa'])->toBe(100000.0)
        ->and($e['mi_recaudacion'])->toBe(100000.0)
        ->and($e['mi_fraccion'])->toBe(1.0)
        ->and($e['gastos']['flota_total'])->toBe(5000.0)
        ->and($e['gastos']['globales_empresa'])->toBe(8000.0)
        ->and($e['gastos']['globales_mi_parte'])->toBe(8000.0)
        ->and($e['gastos']['total'])->toBe(13000.0)
        ->and($e['sueldo']['total'])->toBeGreaterThan(0.0);
});

it('el socio ve su estado del cierre', function () {
    $this->actingAs($this->socio)
        ->get("/mi-cuenta/cierres/{$this->cierre->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('MiCuenta/EstadoCierre')
            ->where('cierre.id', $this->cierre->id)
            ->where('totales.recaudado', 100000)
            ->has('empresas', 1)
        );
});

it('un socio no ve el estado de un cierre en el que no participó', function () {
    $otro = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '20000009']);
    // Le damos una inversión (para pasar el Gate) pero DESPUÉS del cierre → sin participación.
    $this->inv->inversores()->attach($otro->id, ['es_financiador' => false, 'deuda' => 0]);

    $this->actingAs($otro)
        ->get("/mi-cuenta/cierres/{$this->cierre->id}")
        ->assertNotFound();
});

it('exporta el PDF del estado del cierre', function () {
    $res = $this->actingAs($this->socio)->get("/pdf/mi-cuenta/cierres/{$this->cierre->id}");
    $res->assertOk();
    expect($res->headers->get('content-type'))->toContain('application/pdf');
});
