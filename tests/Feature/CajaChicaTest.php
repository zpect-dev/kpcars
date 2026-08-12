<?php

declare(strict_types=1);

use App\Actions\AbrirCajaAction;
use App\Models\CajaChicaMovimiento;
use App\Models\CierreGasto;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\PeriodoCajaChica;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa = Empresa::create(['nombre' => 'EMP_CAJA']);
    $this->admin = User::factory()->create(['role' => 'administrador']);
    $this->inversion = Inversion::create(['nombre' => 'Inv A', 'empresa_id' => $this->empresa->id]);
    $this->vehiculo = Vehiculo::factory()->create([
        'empresa_id' => $this->empresa->id,
        'inversion_id' => $this->inversion->id,
        'patente' => 'CCC333',
    ]);

    session(['active_company_id' => $this->empresa->id]);

    // Abrir el período de caja: arrastra la apertura de la caja chica.
    app(AbrirCajaAction::class)->execute($this->admin);
});

/** Alta directa de un gasto por HTTP con los defaults del panel. */
function registrarGasto(array $overrides = []): array
{
    return [...[
        'fecha' => '2026-08-05',
        'monto' => 1000,
        'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo',
        'descripcion' => null,
        'tipo' => 'galpon',
        'vehiculo_id' => null,
    ], ...$overrides];
}

it('abre el período de caja chica junto con el período de caja', function () {
    $periodo = PeriodoCajaChica::actual();

    expect($periodo)->not->toBeNull()
        ->and($periodo->abierto_por)->toBe($this->admin->id)
        ->and($periodo->saldo())->toBe(0.0);
});

it('reusa el mismo período de caja chica si otra empresa abre su caja', function () {
    $otra = Empresa::create(['nombre' => 'EMP_2']);
    session(['active_company_id' => $otra->id]);

    app(AbrirCajaAction::class)->execute($this->admin);

    expect(PeriodoCajaChica::abierto()->count())->toBe(1);
});

it('suma al saldo al cargar un ingreso a la caja chica', function () {
    $this->actingAs($this->admin)
        ->post('/caja-chica/movimientos', [
            'tipo' => 'ingreso',
            'monto' => 50000,
            'fecha' => '2026-08-01',
            'nota' => 'Fondo inicial',
        ])
        ->assertRedirect();

    expect(CajaChicaMovimiento::saldo())->toBe(50000.0);
    $this->assertDatabaseHas('caja_chica_movimientos', [
        'periodo_id' => PeriodoCajaChica::actual()->id,
        'tipo' => 'ingreso',
        'monto' => 50000.00,
        'nota' => 'Fondo inicial',
        'registrado_por' => $this->admin->id,
    ]);
});

it('descuenta el gasto de la caja chica al registrarlo', function () {
    CajaChicaMovimiento::create([
        'periodo_id' => PeriodoCajaChica::actual()->id,
        'tipo' => 'ingreso',
        'monto' => 10000,
        'fecha' => '2026-08-01',
        'registrado_por' => $this->admin->id,
    ]);

    $this->actingAs($this->admin)
        ->post('/gastos', registrarGasto([
            'monto' => 2500,
            'metodo_pago' => 'transferencia',
            'descripcion' => 'Cubiertas',
            'tipo' => 'vehiculo',
            'vehiculo_id' => $this->vehiculo->id,
        ]))
        ->assertRedirect();

    // La transferencia también sale de la caja: descuentan todos los gastos.
    expect(CajaChicaMovimiento::saldo())->toBe(7500.0);

    $movimiento = CajaChicaMovimiento::where('tipo', 'gasto')->firstOrFail();
    expect((float) $movimiento->monto)->toBe(-2500.0)
        ->and($movimiento->periodo_id)->toBe(PeriodoCajaChica::actual()->id)
        ->and($movimiento->gasto_id)->not->toBeNull()
        ->and($movimiento->nota)->toBe('Vehículo CCC333 — Cubiertas');
});

it('deja el saldo en negativo si el gasto supera lo cargado', function () {
    $this->actingAs($this->admin)
        ->post('/gastos', registrarGasto(['monto' => 3000]))
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect(CajaChicaMovimiento::saldo())->toBe(-3000.0);
});

it('devuelve la plata a la caja al eliminar el gasto', function () {
    CajaChicaMovimiento::create([
        'periodo_id' => PeriodoCajaChica::actual()->id,
        'tipo' => 'ingreso',
        'monto' => 10000,
        'fecha' => '2026-08-01',
        'registrado_por' => $this->admin->id,
    ]);

    $this->actingAs($this->admin)->post('/gastos', registrarGasto(['monto' => 4000, 'tipo' => 'oficina']));

    expect(CajaChicaMovimiento::saldo())->toBe(6000.0);

    $gastoId = CajaChicaMovimiento::where('tipo', 'gasto')->firstOrFail()->gasto_id;

    $this->actingAs($this->admin)->delete("/gastos/{$gastoId}")->assertRedirect();

    expect(CajaChicaMovimiento::saldo())->toBe(10000.0)
        ->and(CajaChicaMovimiento::where('tipo', 'gasto')->count())->toBe(0);
});

it('cierra el período de caja chica con el cierre de gastos y el siguiente arranca en cero', function () {
    $this->actingAs($this->admin)->post('/caja-chica/movimientos', [
        'tipo' => 'ingreso',
        'monto' => 9000,
        'fecha' => '2026-08-01',
    ]);
    $this->actingAs($this->admin)->post('/gastos', registrarGasto(['monto' => 4000]));

    $periodo = PeriodoCajaChica::actual();
    expect($periodo->saldo())->toBe(5000.0);

    $this->actingAs($this->admin)->post('/cobros/cierre')->assertRedirect();

    $periodo->refresh();
    expect($periodo->cerrado_at)->not->toBeNull()
        ->and($periodo->cerrado_por)->toBe($this->admin->id)
        ->and($periodo->cierre_caja_id)->not->toBeNull()
        // Sin período abierto la caja no existe: el saldo viejo no se arrastra.
        ->and(PeriodoCajaChica::actual())->toBeNull()
        ->and(CajaChicaMovimiento::saldo())->toBe(0.0);

    // El período nuevo arranca en cero, no en los 5000 que sobraron.
    app(AbrirCajaAction::class)->execute($this->admin);

    expect(PeriodoCajaChica::actual()->id)->not->toBe($periodo->id)
        ->and(CajaChicaMovimiento::saldo())->toBe(0.0);
});

it('rechaza mover la caja chica si no hay período abierto', function () {
    $this->actingAs($this->admin)->post('/gastos', registrarGasto(['monto' => 1000]));
    $this->actingAs($this->admin)->post('/cobros/cierre');

    $this->actingAs($this->admin)
        ->post('/caja-chica/movimientos', [
            'tipo' => 'ingreso',
            'monto' => 5000,
            'fecha' => '2026-08-10',
        ])
        ->assertSessionHasErrors('monto');
});

it('expone la caja chica del período en el detalle del cierre de gastos', function () {
    $this->actingAs($this->admin)->post('/caja-chica/movimientos', [
        'tipo' => 'ingreso',
        'monto' => 9000,
        'fecha' => '2026-08-01',
        'nota' => 'Fondo inicial',
    ]);
    $this->actingAs($this->admin)->post('/gastos', registrarGasto(['monto' => 4000]));
    $this->actingAs($this->admin)->post('/cobros/cierre');

    $cierreGasto = CierreGasto::firstOrFail();

    $this->actingAs($this->admin)
        ->get("/cierres-gasto/{$cierreGasto->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('CierresGasto/Show')
            ->where('cajaChica.ingresos', 9000)
            ->where('cajaChica.egresos', 4000)
            ->where('cajaChica.saldo', 5000)
            ->has('cajaChica.movimientos', 2)
        );

    $this->actingAs($this->admin)
        ->get("/pdf/cierres-gasto/{$cierreGasto->id}")
        ->assertOk();
});

it('revierte un movimiento manual con un contraasiento y no permite revertirlo dos veces', function () {
    $movimiento = CajaChicaMovimiento::create([
        'periodo_id' => PeriodoCajaChica::actual()->id,
        'tipo' => 'ingreso',
        'monto' => 8000,
        'fecha' => '2026-08-01',
        'registrado_por' => $this->admin->id,
    ]);

    $this->actingAs($this->admin)
        ->post("/caja-chica/movimientos/{$movimiento->id}/revertir")
        ->assertRedirect();

    expect(CajaChicaMovimiento::saldo())->toBe(0.0)
        ->and(CajaChicaMovimiento::count())->toBe(2);

    // El original sigue existiendo: el libro es append-only.
    $this->assertDatabaseHas('caja_chica_movimientos', ['id' => $movimiento->id, 'monto' => 8000.00]);

    $this->actingAs($this->admin)
        ->post("/caja-chica/movimientos/{$movimiento->id}/revertir")
        ->assertSessionHasErrors('nota');
});

it('no permite revertir el descuento de un gasto', function () {
    $this->actingAs($this->admin)->post('/gastos', registrarGasto(['monto' => 1000, 'tipo' => 'taller']));

    $movimiento = CajaChicaMovimiento::where('tipo', 'gasto')->firstOrFail();

    $this->actingAs($this->admin)
        ->post("/caja-chica/movimientos/{$movimiento->id}/revertir")
        ->assertSessionHasErrors('nota');

    expect(CajaChicaMovimiento::saldo())->toBe(-1000.0);
});

it('exige nota en los ajustes y respeta el signo del monto', function () {
    $this->actingAs($this->admin)
        ->post('/caja-chica/movimientos', [
            'tipo' => 'ajuste',
            'monto' => -500,
            'fecha' => '2026-08-02',
            'nota' => '',
        ])
        ->assertSessionHasErrors('nota');

    $this->actingAs($this->admin)
        ->post('/caja-chica/movimientos', [
            'tipo' => 'ajuste',
            'monto' => -500,
            'fecha' => '2026-08-02',
            'nota' => 'Faltante en el arqueo',
        ])
        ->assertRedirect();

    expect(CajaChicaMovimiento::saldo())->toBe(-500.0);
});

it('niega la carga de caja chica a un no administrador', function () {
    $administrativo = User::factory()->create(['role' => 'administrativo']);

    $this->actingAs($administrativo)
        ->post('/caja-chica/movimientos', [
            'tipo' => 'ingreso',
            'monto' => 1000,
            'fecha' => '2026-08-01',
        ])
        ->assertForbidden();

    expect(CajaChicaMovimiento::count())->toBe(0);
});

it('expone saldo y extracto de la caja en la vista de gastos', function () {
    CajaChicaMovimiento::create([
        'periodo_id' => PeriodoCajaChica::actual()->id,
        'tipo' => 'ingreso',
        'monto' => 12000,
        'fecha' => '2026-08-01',
        'nota' => 'Fondo inicial',
        'registrado_por' => $this->admin->id,
    ]);

    $this->actingAs($this->admin)
        ->get('/gastos')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Gastos/Index')
            ->where('cajaChica.periodo_abierto', true)
            ->where('cajaChica.saldo', 12000)
            ->where('cajaChica.ingresos', 12000)
            ->where('cajaChica.egresos', 0)
            ->has('cajaChica.movimientos', 1)
            ->where('cajaChica.movimientos.0.tipo', 'ingreso')
            ->where('cajaChica.movimientos.0.registrado_por', $this->admin->name)
        );
});
