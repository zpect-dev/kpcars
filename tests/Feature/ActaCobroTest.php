<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Acta;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'must_change_password' => false,
    ]);
});

/** Crea un acta con importe cobrable. */
function actaBase(array $overrides = []): Acta
{
    return Acta::create(array_merge([
        'patente' => 'AA123BB',
        'jurisdiccion' => 'BSAS',
        'clave' => 'BSAS:'.uniqid(),
        'acta' => '02-105-0001',
        'motivo' => 'Exceso de velocidad',
        'monto' => 20000,
        'estado' => 'vigente',
    ], $overrides));
}

it('registra un cobro parcial y luego lo completa', function () {
    $acta = actaBase();

    // Pago parcial: 10.000 de 20.000.
    $this->actingAs($this->admin)
        ->patch("/actas/{$acta->id}/cobrado", [
            'monto' => 10000,
            'fecha_cobro' => '2026-08-01',
        ])
        ->assertRedirect();

    $acta->refresh();
    expect((float) $acta->monto_cobrado)->toBe(10000.0)
        ->and($acta->cobrado)->toBeFalse()
        ->and($acta->pagos()->count())->toBe(1);

    // Segundo pago: salda el total.
    $this->actingAs($this->admin)
        ->patch("/actas/{$acta->id}/cobrado", [
            'monto' => 10000,
            'fecha_cobro' => '2026-08-05',
        ])
        ->assertRedirect();

    $acta->refresh();
    expect((float) $acta->monto_cobrado)->toBe(20000.0)
        ->and($acta->cobrado)->toBeTrue()
        ->and($acta->cobrada_en?->toDateString())->toBe('2026-08-05');
});

it('reinicia el cobro borrando los pagos', function () {
    $acta = actaBase();

    $this->actingAs($this->admin)->patch("/actas/{$acta->id}/cobrado", [
        'monto' => 20000,
        'fecha_cobro' => '2026-08-01',
    ]);

    expect($acta->refresh()->cobrado)->toBeTrue();

    $this->actingAs($this->admin)
        ->patch("/actas/{$acta->id}/cobrado", ['reset' => true])
        ->assertRedirect();

    $acta->refresh();
    expect($acta->cobrado)->toBeFalse()
        ->and((float) $acta->monto_cobrado)->toBe(0.0)
        ->and($acta->pagos()->count())->toBe(0);
});

it('elimina un pago puntual y recalcula el cobro', function () {
    $acta = actaBase();

    $this->actingAs($this->admin)->patch("/actas/{$acta->id}/cobrado", [
        'monto' => 20000,
        'fecha_cobro' => '2026-08-01',
    ]);

    $pago = $acta->pagos()->first();

    $this->actingAs($this->admin)
        ->delete("/actas/{$acta->id}/pagos/{$pago->id}")
        ->assertRedirect();

    $acta->refresh();
    expect($acta->cobrado)->toBeFalse()
        ->and((float) $acta->monto_cobrado)->toBe(0.0);
});

it('marca pago voluntario (CABA sin vencer) sin volver a descontar', function () {
    $acta = actaBase([
        'jurisdiccion' => 'CABA',
        'acta' => null,
        'monto' => 20000,
        'fecha_vencimiento' => '2099-01-01',
    ]);

    expect($acta->esPagoVoluntario())->toBeTrue()
        // No se divide: el monto es el que ya vino del feed.
        ->and($acta->montoACobrar())->toBe(20000.0);

    // Se cobra el monto tal cual.
    $this->actingAs($this->admin)->patch("/actas/{$acta->id}/cobrado", [
        'monto' => 20000,
        'fecha_cobro' => '2026-08-01',
    ]);

    expect($acta->refresh()->cobrado)->toBeTrue();
});

it('no marca pago voluntario cuando el vencimiento ya pasó', function () {
    $acta = actaBase([
        'jurisdiccion' => 'CABA',
        'acta' => null,
        'monto' => 20000,
        'fecha_vencimiento' => '2020-01-01',
    ]);

    expect($acta->esPagoVoluntario())->toBeFalse();
});

it('no marca pago voluntario en BSAS aunque no esté vencida', function () {
    $acta = actaBase(['jurisdiccion' => 'BSAS', 'monto' => 20000, 'fecha_vencimiento' => '2099-01-01']);

    expect($acta->esPagoVoluntario())->toBeFalse();
});

it('clasifica como punto rojo cuando no hay vencimiento ni monto', function () {
    $acta = actaBase(['monto' => null, 'fecha_vencimiento' => null, 'acta' => null]);

    expect($acta->esPuntoRojo())->toBeTrue()
        ->and($acta->sinImporte())->toBeTrue()
        ->and($acta->montoAdeudado())->toBe(0.0);
});

it('no deja cobrar un acta sin importe (CABA sin monto)', function () {
    $acta = actaBase(['jurisdiccion' => 'CABA', 'monto' => null, 'acta' => null]);

    $this->actingAs($this->admin)
        ->patch("/actas/{$acta->id}/cobrado", [
            'monto' => 5000,
            'fecha_cobro' => '2026-08-01',
        ])
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($acta->refresh()->pagos()->count())->toBe(0);
});
