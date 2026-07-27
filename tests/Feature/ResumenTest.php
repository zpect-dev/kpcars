<?php

declare(strict_types=1);

use App\Actions\CalcularResumenAction;
use App\Actions\CreateGastoAction;
use App\Enums\UserRole;
use App\Models\AperturaRecaudacion;
use App\Models\CierreRecaudacion;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Inversion;
use App\Models\Recaudacion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'must_change_password' => false,
    ]);

    $this->empresa = Empresa::create(['nombre' => 'Empresa Uno']);
    $this->inversion = Inversion::create(['nombre' => 'INV_01', 'empresa_id' => $this->empresa->id]);
    $this->vehiculo = Vehiculo::factory()->create([
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
        'precio' => 100000,
    ]);
});

/** Período cerrado completo: apertura + recaudación del vehículo + cierre fechado. */
function cierreConRecaudacion(Vehiculo $vehiculo, float $total, string $fechaCierre): CierreRecaudacion
{
    $apertura = AperturaRecaudacion::create([
        'empresa_id' => $vehiculo->empresa_id,
        'user_id' => test()->admin->id,
    ]);

    $cierre = CierreRecaudacion::create([
        'empresa_id' => $vehiculo->empresa_id,
        'user_id' => test()->admin->id,
    ]);
    $cierre->created_at = $fechaCierre;
    $cierre->save();

    Recaudacion::create([
        'vehiculo_id' => $vehiculo->id,
        'user_id' => test()->admin->id,
        'empresa_id' => $vehiculo->empresa_id,
        'apertura_id' => $apertura->id,
        'cierre_id' => $cierre->id,
        'efectivo' => $total,
        'transferencia' => 0,
        'total' => $total,
        'descuento' => 0,
        'precio' => (float) $vehiculo->precio,
    ]);

    $apertura->update(['cierre_id' => $cierre->id]);

    return $cierre;
}

/** Gasto mínimo válido, con overrides. */
function gastoBase(array $overrides = []): Gasto
{
    return Gasto::create(array_merge([
        'fecha' => '2026-07-05',
        'monto' => 100,
        'user_id' => test()->admin->id,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
    ], $overrides));
}

/** Ejecuta la Action con julio 2026 como rango por defecto. */
function resumen(array $overrides = []): array
{
    return app(CalcularResumenAction::class)->execute(array_merge([
        'desde' => '2026-07-01',
        'hasta' => '2026-07-31',
        'empresa_id' => null,
        'inversion_id' => null,
        'vehiculo_ids' => [],
        'tipo' => null,
        'incluir_abierto' => false,
    ], $overrides));
}

it('atribuye los ingresos por la fecha del cierre del período', function () {
    cierreConRecaudacion($this->vehiculo, 1000, '2026-07-10 12:00:00');
    cierreConRecaudacion($this->vehiculo, 500, '2026-06-10 12:00:00');

    $r = resumen();

    expect($r['totales']['ingresos'])->toBe(1000.0)
        ->and($r['cierres_en_rango'])->toBe(1)
        ->and($r['por_vehiculo'])->toHaveCount(1)
        ->and($r['por_vehiculo'][0]['ingresos'])->toBe(1000.0)
        ->and($r['por_vehiculo'][0]['patente'])->toBe($this->vehiculo->patente);
});

it('deja el período en curso fuera de los ingresos salvo que se pida incluirlo', function () {
    $apertura = AperturaRecaudacion::create([
        'empresa_id' => $this->empresa->id,
        'user_id' => $this->admin->id,
    ]);
    Recaudacion::create([
        'vehiculo_id' => $this->vehiculo->id,
        'user_id' => $this->admin->id,
        'empresa_id' => $this->empresa->id,
        'apertura_id' => $apertura->id,
        'efectivo' => 300,
        'transferencia' => 0,
        'total' => 300,
        'descuento' => 0,
        'precio' => 100000,
    ]);

    $r = resumen();

    expect($r['totales']['ingresos'])->toBe(0.0)
        ->and($r['abierto']['total'])->toBe(300.0)
        ->and($r['abierto']['incluido'])->toBeFalse();

    $r = resumen(['incluir_abierto' => true]);

    expect($r['totales']['ingresos'])->toBe(300.0)
        ->and($r['abierto']['incluido'])->toBeTrue();
});

it('baja los gastos de vehículo por vehículo y deja los globales sólo en totales', function () {
    gastoBase(['tipo' => 'vehiculo', 'vehiculo_id' => $this->vehiculo->id, 'monto' => 200]);
    gastoBase(['tipo' => 'galpon', 'monto' => 100, 'fecha' => '2026-07-06']);
    gastoBase(['tipo' => 'vehiculo', 'vehiculo_id' => $this->vehiculo->id, 'monto' => 999, 'fecha' => '2026-08-05']);

    $r = resumen();

    expect($r['totales']['egresos'])->toBe(300.0)
        ->and($r['totales']['neto'])->toBe(-300.0)
        ->and($r['por_vehiculo'])->toHaveCount(1)
        ->and($r['por_vehiculo'][0]['egresos'])->toBe(200.0)
        ->and($r['por_tipo']->pluck('total', 'tipo')->all())->toBe(['vehiculo' => 200.0, 'galpon' => 100.0]);
});

it('filtra por inversión y por vehículos puntuales, dejando fuera los globales', function () {
    $inversion2 = Inversion::create(['nombre' => 'INV_02', 'empresa_id' => $this->empresa->id]);
    $vehiculo2 = Vehiculo::factory()->create([
        'inversion_id' => $inversion2->id,
        'empresa_id' => $this->empresa->id,
        'precio' => 100000,
    ]);

    cierreConRecaudacion($this->vehiculo, 1000, '2026-07-10 12:00:00');
    cierreConRecaudacion($vehiculo2, 700, '2026-07-11 12:00:00');
    gastoBase(['tipo' => 'vehiculo', 'vehiculo_id' => $this->vehiculo->id, 'monto' => 200]);
    gastoBase(['tipo' => 'vehiculo', 'vehiculo_id' => $vehiculo2->id, 'monto' => 50]);
    gastoBase(['tipo' => 'galpon', 'monto' => 100]);

    $r = resumen(['inversion_id' => $this->inversion->id]);

    expect($r['totales']['ingresos'])->toBe(1000.0)
        ->and($r['totales']['egresos'])->toBe(200.0)
        ->and($r['por_vehiculo'])->toHaveCount(1)
        ->and($r['por_vehiculo'][0]['vehiculo_id'])->toBe($this->vehiculo->id);

    $r = resumen(['vehiculo_ids' => [$vehiculo2->id]]);

    expect($r['totales']['ingresos'])->toBe(700.0)
        ->and($r['totales']['egresos'])->toBe(50.0)
        ->and($r['por_vehiculo'])->toHaveCount(1)
        ->and($r['por_vehiculo'][0]['vehiculo_id'])->toBe($vehiculo2->id);
});

it('con filtro de empresa los globales aportan la parte congelada de esa empresa', function () {
    $empresa2 = Empresa::create(['nombre' => 'Empresa Dos']);

    gastoBase([
        'tipo' => 'galpon',
        'monto' => 100,
        'distribucion_empresas' => [$this->empresa->id => 60, $empresa2->id => 40],
    ]);
    // Kevin/stock no tienen dimensión de empresa: quedan fuera del filtro.
    gastoBase(['tipo' => 'kevin', 'monto' => 500, 'fecha' => '2026-07-06']);

    $r = resumen(['empresa_id' => $this->empresa->id]);

    expect($r['totales']['egresos'])->toBe(60.0)
        ->and($r['por_tipo']->pluck('total', 'tipo')->all())->toBe(['galpon' => 60.0]);

    $r = resumen();

    expect($r['totales']['egresos'])->toBe(600.0);
});

it('replica el reparto del gasto en gasto_distribuciones al crearlo', function () {
    $inversor1 = User::factory()->create(['role' => UserRole::INVERSOR]);
    $inversor2 = User::factory()->create(['role' => UserRole::INVERSOR]);
    DB::table('inversion_user')->insert([
        ['inversion_id' => $this->inversion->id, 'user_id' => $inversor1->id, 'es_financiador' => false, 'deuda' => 0],
        ['inversion_id' => $this->inversion->id, 'user_id' => $inversor2->id, 'es_financiador' => false, 'deuda' => 0],
    ]);

    $gasto = app(CreateGastoAction::class)->execute([
        'fecha' => '2026-07-05',
        'monto' => 100,
        'user_id' => $this->admin->id,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'descripcion' => null,
        'tipo' => 'vehiculo',
        'vehiculo_id' => $this->vehiculo->id,
    ]);

    expect($gasto->distribuciones()->count())->toBe(2);
    $this->assertDatabaseHas('gasto_distribuciones', ['gasto_id' => $gasto->id, 'user_id' => $inversor1->id, 'monto' => 50.00]);
    $this->assertDatabaseHas('gasto_distribuciones', ['gasto_id' => $gasto->id, 'user_id' => $inversor2->id, 'monto' => 50.00]);
});

it('permite el resumen al administrador y lo niega al administrativo', function () {
    $this->actingAs($this->admin)
        ->get('/resumen')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Resumen/Index')
            ->has('resumen.totales')
            ->has('resumen.por_vehiculo')
            ->has('filters'));

    $administrativo = User::factory()->create([
        'role' => UserRole::ADMINISTRATIVO,
        'must_change_password' => false,
    ]);

    $this->actingAs($administrativo)->get('/resumen')->assertForbidden();
});
