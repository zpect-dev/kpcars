<?php

declare(strict_types=1);

use App\Enums\DepositoMovimientoTipo;
use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Multa;
use App\Models\User;
use App\Models\UserDepositoMovimiento;
use App\Models\Vehiculo;

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'must_change_password' => false,
    ]);

    $this->chofer = User::factory()->create([
        'role' => UserRole::CHOFER,
        'must_change_password' => false,
    ]);
});

/** Saldo actual de la cuenta del chofer en una moneda. */
function saldoDeposito(User $chofer, string $moneda = 'ARS'): float
{
    return round((float) UserDepositoMovimiento::where('user_id', $chofer->id)
        ->where('moneda', $moneda)
        ->sum('monto'), 2);
}

it('registra el depósito inicial del alta con su fecha', function () {
    $this->actingAs($this->admin)
        ->post('/users', [
            'name' => 'Juan Chofer',
            'dni' => '30111222',
            'role' => UserRole::CHOFER->value,
            'depositos' => [
                ['monto' => 100000, 'moneda' => 'ARS', 'fecha' => '2026-03-10'],
            ],
        ])
        ->assertRedirect();

    $movimiento = UserDepositoMovimiento::firstWhere('user_id', User::firstWhere('dni', '30111222')->id);

    expect($movimiento->tipo)->toBe(DepositoMovimientoTipo::INGRESO)
        ->and((float) $movimiento->monto)->toBe(100000.0)
        ->and($movimiento->fecha->toDateString())->toBe('2026-03-10');
});

it('suma los depósitos posteriores en vez de reemplazar el anterior', function () {
    $this->actingAs($this->admin)
        ->post("/users/{$this->chofer->id}/deposito/movimientos", [
            'tipo' => 'ingreso',
            'moneda' => 'ARS',
            'monto' => 100000,
            'fecha' => '2026-03-10',
        ]);

    $this->actingAs($this->admin)
        ->post("/users/{$this->chofer->id}/deposito/movimientos", [
            'tipo' => 'ingreso',
            'moneda' => 'ARS',
            'monto' => 50000,
            'fecha' => '2026-04-02',
            'nota' => 'Completa la garantía',
        ]);

    $movimientos = UserDepositoMovimiento::where('user_id', $this->chofer->id)->ordenExtracto()->get();

    expect($movimientos)->toHaveCount(2)
        ->and($movimientos->first()->fecha->toDateString())->toBe('2026-03-10')
        ->and($movimientos->last()->fecha->toDateString())->toBe('2026-04-02')
        ->and(saldoDeposito($this->chofer))->toBe(150000.0);
});

it('lleva cuentas separadas por moneda', function () {
    foreach ([['ARS', 100000], ['USD', 500]] as [$moneda, $monto]) {
        $this->actingAs($this->admin)
            ->post("/users/{$this->chofer->id}/deposito/movimientos", [
                'tipo' => 'ingreso',
                'moneda' => $moneda,
                'monto' => $monto,
                'fecha' => '2026-03-10',
            ]);
    }

    expect(saldoDeposito($this->chofer, 'ARS'))->toBe(100000.0)
        ->and(saldoDeposito($this->chofer, 'USD'))->toBe(500.0);
});

it('descuenta el retiro y rechaza el que deja la cuenta en rojo', function () {
    $this->actingAs($this->admin)
        ->post("/users/{$this->chofer->id}/deposito/movimientos", [
            'tipo' => 'ingreso',
            'moneda' => 'ARS',
            'monto' => 100000,
            'fecha' => '2026-03-10',
        ]);

    $this->actingAs($this->admin)
        ->post("/users/{$this->chofer->id}/deposito/movimientos", [
            'tipo' => 'retiro',
            'moneda' => 'ARS',
            'monto' => 30000,
            'fecha' => '2026-05-01',
        ]);

    expect(saldoDeposito($this->chofer))->toBe(70000.0);

    $this->actingAs($this->admin)
        ->post("/users/{$this->chofer->id}/deposito/movimientos", [
            'tipo' => 'retiro',
            'moneda' => 'ARS',
            'monto' => 90000,
            'fecha' => '2026-05-02',
        ])
        ->assertSessionHasErrors('monto');

    expect(saldoDeposito($this->chofer))->toBe(70000.0);
});

it('exige nota en los ajustes', function () {
    $this->actingAs($this->admin)
        ->post("/users/{$this->chofer->id}/deposito/movimientos", [
            'tipo' => 'ajuste',
            'moneda' => 'ARS',
            'monto' => -5000,
            'fecha' => '2026-05-01',
        ])
        ->assertSessionHasErrors('nota');

    expect(UserDepositoMovimiento::where('user_id', $this->chofer->id)->count())->toBe(0);
});

it('corrige un movimiento con contraasiento sin borrar el original', function () {
    $this->actingAs($this->admin)
        ->post("/users/{$this->chofer->id}/deposito/movimientos", [
            'tipo' => 'ingreso',
            'moneda' => 'ARS',
            'monto' => 100000,
            'fecha' => '2026-03-10',
        ]);

    $original = UserDepositoMovimiento::firstWhere('user_id', $this->chofer->id);

    $this->actingAs($this->admin)
        ->post("/users/{$this->chofer->id}/deposito/movimientos/{$original->id}/revertir")
        ->assertRedirect();

    expect(UserDepositoMovimiento::where('user_id', $this->chofer->id)->count())->toBe(2)
        ->and(UserDepositoMovimiento::find($original->id))->not->toBeNull()
        ->and(saldoDeposito($this->chofer))->toBe(0.0);

    // El contraasiento no se puede revertir de nuevo.
    $this->actingAs($this->admin)
        ->post("/users/{$this->chofer->id}/deposito/movimientos/{$original->id}/revertir")
        ->assertSessionHasErrors('nota');
});
