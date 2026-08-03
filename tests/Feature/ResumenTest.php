<?php

declare(strict_types=1);

use App\Actions\AplicarSeleccionResumenAction;
use App\Actions\CalcularResumenAction;
use App\Actions\CreateGastoAction;
use App\Enums\UserRole;
use App\Models\AperturaRecaudacion;
use App\Models\Articulo;
use App\Models\CierreRecaudacion;
use App\Models\Cobro;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Inversion;
use App\Models\Recaudacion;
use App\Models\Transaccion;
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

/**
 * Simula una salida de inventario hacia un vehículo: artículo, transacción y
 * su cobro, tal como los deja ProcessStockMovementAction. `precio` es el de
 * venta (costo + markup), que es como el resumen valúa el repuesto.
 */
function repuestoParaVehiculo(
    Vehiculo $vehiculo,
    float $precio,
    int $cantidad,
    string $fecha,
    bool $inactiva = false,
): void {
    $articulo = Articulo::create([
        'descripcion' => 'Repuesto '.fake()->unique()->bothify('??##'),
        'codigo' => fake()->unique()->bothify('COD-####'),
        'repuestos' => true,
        'stock' => 100,
        'min_stock' => 1,
        'costo' => round($precio / Articulo::MARKUP, 2),
        'precio' => $precio,
    ]);

    $transaccion = Transaccion::create([
        'articulo_id' => $articulo->id,
        'user_id' => test()->admin->id,
        'vehiculo_id' => $vehiculo->id,
        'solicitante' => 'Taller',
        'tipo' => 'OUT',
        'cantidad' => $cantidad,
        'inactiva' => $inactiva,
    ]);
    $transaccion->created_at = $fecha;
    $transaccion->save();

    Cobro::create([
        'inversion_id' => $vehiculo->inversion_id,
        'transaccion_id' => $transaccion->id,
        'empresa_id' => $vehiculo->empresa_id,
    ]);
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

    // Sin filtro: el gasto de galpón entero. Kevin queda excluido del resumen.
    $r = resumen();

    expect($r['totales']['egresos'])->toBe(100.0);
});

it('unifica galpón, taller y oficina en una sola categoría', function () {
    gastoBase(['tipo' => 'galpon', 'monto' => 100]);
    gastoBase(['tipo' => 'taller', 'monto' => 50, 'fecha' => '2026-07-06']);
    gastoBase(['tipo' => 'oficina', 'monto' => 25, 'fecha' => '2026-07-07']);

    $r = resumen();

    expect($r['por_tipo']->pluck('total', 'tipo')->all())->toBe(['galpon' => 175.0])
        ->and($r['por_tipo'][0]['label'])->toBe('Galpón')
        ->and($r['totales']['egresos'])->toBe(175.0);
});

it('excluye del resumen los gastos de kevin y stock', function () {
    gastoBase(['tipo' => 'kevin', 'monto' => 500]);
    gastoBase(['tipo' => 'stock', 'monto' => 300, 'fecha' => '2026-07-06']);
    gastoBase(['tipo' => 'galpon', 'monto' => 100, 'fecha' => '2026-07-07']);

    $r = resumen();

    expect($r['totales']['egresos'])->toBe(100.0)
        ->and($r['por_tipo']->pluck('total', 'tipo')->all())->toBe(['galpon' => 100.0]);
});

it('suma al egreso del vehículo los repuestos de inventario a precio de venta', function () {
    gastoBase(['tipo' => 'vehiculo', 'vehiculo_id' => $this->vehiculo->id, 'monto' => 200]);
    repuestoParaVehiculo($this->vehiculo, precio: 1500, cantidad: 2, fecha: '2026-07-08');
    // Fuera del rango: no debe contar.
    repuestoParaVehiculo($this->vehiculo, precio: 9999, cantidad: 1, fecha: '2026-08-08');

    $r = resumen();

    expect($r['totales']['egresos'])->toBe(3200.0)
        ->and($r['por_tipo']->pluck('total', 'tipo')->all())->toBe(['repuesto' => 3000.0, 'vehiculo' => 200.0])
        ->and($r['por_vehiculo'])->toHaveCount(1);

    $fila = $r['por_vehiculo'][0];

    expect($fila['gastos'])->toBe(200.0)
        ->and($fila['repuestos'])->toBe(3000.0)
        ->and($fila['egresos'])->toBe(3200.0)
        ->and($fila['neto'])->toBe(-3200.0);
});

it('ignora los repuestos de transacciones anuladas', function () {
    repuestoParaVehiculo($this->vehiculo, precio: 1000, cantidad: 1, fecha: '2026-07-08');
    repuestoParaVehiculo($this->vehiculo, precio: 5000, cantidad: 1, fecha: '2026-07-09', inactiva: true);

    $r = resumen();

    expect($r['totales']['egresos'])->toBe(1000.0);
});

it('acota los repuestos al filtrar por vehículo', function () {
    $vehiculo2 = Vehiculo::factory()->create([
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
        'precio' => 100000,
    ]);

    repuestoParaVehiculo($this->vehiculo, precio: 1000, cantidad: 1, fecha: '2026-07-08');
    repuestoParaVehiculo($vehiculo2, precio: 7000, cantidad: 1, fecha: '2026-07-08');

    $r = resumen(['vehiculo_ids' => [$vehiculo2->id]]);

    expect($r['totales']['egresos'])->toBe(7000.0)
        ->and($r['por_vehiculo'])->toHaveCount(1)
        ->and($r['por_vehiculo'][0]['repuestos'])->toBe(7000.0);
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

it('AplicarSeleccionResumenAction recorta el resumen a la selección y re-suma sin tocar los totales del período', function () {
    $vehiculo2 = Vehiculo::factory()->create([
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
        'precio' => 100000,
    ]);

    cierreConRecaudacion($this->vehiculo, 1000, '2026-07-10 12:00:00');
    cierreConRecaudacion($vehiculo2, 700, '2026-07-11 12:00:00');
    gastoBase(['tipo' => 'vehiculo', 'vehiculo_id' => $this->vehiculo->id, 'monto' => 200]);
    gastoBase(['tipo' => 'galpon', 'monto' => 100, 'fecha' => '2026-07-06']);

    $r = resumen();

    expect($r['por_vehiculo'])->toHaveCount(2)
        ->and($r['por_tipo'])->toHaveCount(2);

    $seleccionado = app(AplicarSeleccionResumenAction::class)->execute($r, [$vehiculo2->id], ['galpon']);

    expect($seleccionado['seleccion']['activa'])->toBeTrue()
        ->and($seleccionado['por_vehiculo'])->toHaveCount(1)
        ->and($seleccionado['por_vehiculo'][0]['vehiculo_id'])->toBe($vehiculo2->id)
        ->and($seleccionado['seleccion']['vehiculo']['ingresos'])->toBe(700.0)
        ->and($seleccionado['por_tipo'])->toHaveCount(1)
        ->and($seleccionado['seleccion']['tipo_total'])->toBe(100.0)
        ->and($seleccionado['totales']['ingresos'])->toBe(1700.0);
});

it('sin selección, AplicarSeleccionResumenAction deja el resumen intacto', function () {
    $r = resumen();
    $sinSeleccion = app(AplicarSeleccionResumenAction::class)->execute($r, [], []);

    expect($sinSeleccion['seleccion']['activa'])->toBeFalse()
        ->and($sinSeleccion['por_vehiculo'])->toHaveCount($r['por_vehiculo']->count())
        ->and($sinSeleccion['por_tipo'])->toHaveCount($r['por_tipo']->count());
});

it('exporta PDF y Excel del resumen filtrando por la selección tildada en pantalla', function () {
    $vehiculo2 = Vehiculo::factory()->create([
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
        'precio' => 100000,
    ]);
    cierreConRecaudacion($this->vehiculo, 1000, '2026-07-10 12:00:00');
    cierreConRecaudacion($vehiculo2, 700, '2026-07-11 12:00:00');

    $query = http_build_query([
        'desde' => '2026-07-01',
        'hasta' => '2026-07-31',
        'sel_vehiculo_ids' => [$vehiculo2->id],
    ]);

    $this->actingAs($this->admin)->get('/pdf/resumen?'.$query)
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');

    $this->actingAs($this->admin)->get('/excel/resumen?'.$query)
        ->assertOk();
});

it('el detalle de un vehículo lista ingresos y egresos con fecha', function () {
    // Ingreso: recaudación cerrada en el rango.
    cierreConRecaudacion($this->vehiculo, 1000, '2026-07-10 12:00:00');
    // Egreso: gasto de flota en el rango.
    gastoBase([
        'tipo' => 'vehiculo', 'vehiculo_id' => $this->vehiculo->id,
        'fecha' => '2026-07-12', 'monto' => 300, 'descripcion' => 'Cambio de aceite',
    ]);
    // Egreso: repuesto (2 × 250 = 500) en el rango.
    repuestoParaVehiculo($this->vehiculo, 250, 2, '2026-07-15 09:00:00');
    // Fuera del rango: no debe aparecer.
    cierreConRecaudacion($this->vehiculo, 999, '2026-06-10 12:00:00');

    $this->actingAs($this->admin)
        ->get("/resumen/vehiculo/{$this->vehiculo->id}?desde=2026-07-01&hasta=2026-07-31")
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Resumen/Vehiculo')
            ->where('vehiculo.patente', $this->vehiculo->patente)
            // Ingresos: sólo el cierre en rango (1000).
            ->has('ingresos', 1)
            ->where('ingresos.0.monto', 1000)
            ->where('ingresos.0.fecha', '2026-07-10')
            // Egresos: gasto (300) + repuesto (500), ordenados por fecha.
            ->has('egresos', 2)
            ->where('egresos.0.tipo', 'gasto')
            ->where('egresos.0.monto', 300)
            ->where('egresos.1.tipo', 'repuesto')
            ->where('egresos.1.monto', 500)
            ->where('totales.ingresos', 1000)
            ->where('totales.egresos', 800)
            ->where('totales.neto', 200)
        );
});
