<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Multa;
use App\Models\User;
use App\Models\UserDepositoMovimiento;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

uses(RefreshDatabase::class);

function saldo(User $u): float
{
    return round((float) UserDepositoMovimiento::where('user_id', $u->id)->sum('monto'), 2);
}

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::ADMINISTRADOR, 'dni' => '92000001']);
    $this->chofer = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '92000002']);
});

it('el cobro de una multa por transferencia NO descuenta la cuenta de depósito', function () {
    // Saldo inicial.
    UserDepositoMovimiento::create([
        'user_id' => $this->chofer->id, 'moneda' => 'ARS', 'tipo' => 'ingreso',
        'monto' => 100000, 'fecha' => '2026-03-10', 'registrado_por' => $this->admin->id,
    ]);

    $empresa = Empresa::create(['nombre' => 'Emp Test']);
    $inversion = Inversion::create(['nombre' => 'Inv Test', 'empresa_id' => $empresa->id]);
    $vehiculo = Vehiculo::factory()->create(['inversion_id' => $inversion->id]);

    $multa = Multa::create([
        'vehiculo_id' => $vehiculo->id, 'conductor_id' => $this->chofer->id, 'fecha' => '2026-05-01',
        'monto' => 20000, 'descripcion' => 'Test', 'jurisdiccion' => 'GBA',
    ]);

    $this->actingAs($this->admin)
        ->patch("/multas/{$multa->id}/cobrado", [
            'monto' => 20000, 'fecha_cobro' => '2026-05-20', 'es_transferencia' => true,
        ])
        ->assertRedirect();

    // La multa quedó cobrada y por transferencia, pero el saldo NO se tocó.
    $pago = $multa->pagos()->first();
    expect($pago->es_transferencia)->toBeTrue()
        ->and($multa->fresh()->cobrado)->toBeTrue()
        ->and(saldo($this->chofer))->toBe(100000.0)
        ->and(UserDepositoMovimiento::where('tipo', 'descuento_multa')->count())->toBe(0);
});

it('el comando revierte los descuentos legacy y devuelve el saldo', function () {
    UserDepositoMovimiento::create([
        'user_id' => $this->chofer->id, 'moneda' => 'ARS', 'tipo' => 'ingreso',
        'monto' => 100000, 'fecha' => '2026-03-10', 'registrado_por' => $this->admin->id,
    ]);
    // Descuento legacy (lo que dejaba el viejo "pago con depósito").
    UserDepositoMovimiento::create([
        'user_id' => $this->chofer->id, 'moneda' => 'ARS', 'tipo' => 'descuento_multa',
        'monto' => -20000, 'fecha' => '2026-05-20', 'nota' => 'Multa #1', 'registrado_por' => $this->admin->id,
    ]);

    expect(saldo($this->chofer))->toBe(80000.0);

    // Dry-run: no escribe.
    Artisan::call('multas:revertir-depositos');
    expect(saldo($this->chofer))->toBe(80000.0);

    // Apply: contraasiento devuelve el saldo.
    Artisan::call('multas:revertir-depositos', ['--apply' => true]);
    expect(saldo($this->chofer))->toBe(100000.0)
        ->and(UserDepositoMovimiento::where('user_id', $this->chofer->id)->count())->toBe(3);

    // Idempotente: correr de nuevo no duplica.
    Artisan::call('multas:revertir-depositos', ['--apply' => true]);
    expect(saldo($this->chofer))->toBe(100000.0)
        ->and(UserDepositoMovimiento::where('user_id', $this->chofer->id)->count())->toBe(3);
});
