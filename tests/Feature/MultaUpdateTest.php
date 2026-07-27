<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Multa;
use App\Models\User;
use App\Models\Vehiculo;

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'must_change_password' => false,
    ]);

    $empresa = Empresa::create(['nombre' => 'Empresa Test']);
    $inversion = Inversion::create(['nombre' => 'Inv Test', 'empresa_id' => $empresa->id]);
    $this->vehiculo = Vehiculo::factory()->create(['inversion_id' => $inversion->id]);
});

/** Crea una multa común (con importe) para el vehículo de prueba. */
function multaBase(array $overrides = []): Multa
{
    return Multa::create(array_merge([
        'vehiculo_id' => test()->vehiculo->id,
        'fecha' => '2026-05-01',
        'fecha_vencimiento' => '2026-06-01',
        'monto' => 20000,
        'descripcion' => 'Exceso de velocidad',
        'jurisdiccion' => 'GBA',
    ], $overrides));
}

it('pasa una multa a punto rojo conservando el importe', function () {
    $multa = multaBase();

    $this->actingAs($this->admin)
        ->patch("/multas/{$multa->id}", [
            'punto_rojo' => true,
            'monto' => 20000,
            'fecha_vencimiento' => '2026-06-01',
        ])
        ->assertRedirect();

    $multa->refresh();

    expect($multa->punto_rojo)->toBeTrue()
        // El precio se mantiene visible y la multa sigue contando en finanzas.
        ->and((float) $multa->monto)->toBe(20000.0)
        ->and($multa->sinImporte())->toBeFalse()
        ->and($multa->montoAdeudado())->toBe(20000.0);
});

it('deja el punto rojo sin importe cuando no se carga monto', function () {
    $multa = multaBase();

    $this->actingAs($this->admin)
        ->patch("/multas/{$multa->id}", ['punto_rojo' => true])
        ->assertRedirect();

    $multa->refresh();

    expect($multa->punto_rojo)->toBeTrue()
        ->and((float) $multa->monto)->toBe(0.0)
        ->and($multa->fecha_vencimiento)->toBeNull()
        ->and($multa->sinImporte())->toBeTrue()
        ->and($multa->montoAdeudado())->toBe(0.0);
});

it('permite sacarle el punto rojo a una multa y recuperar su importe', function () {
    $multa = multaBase(['monto' => 0, 'fecha_vencimiento' => null, 'punto_rojo' => true]);

    $this->actingAs($this->admin)
        ->patch("/multas/{$multa->id}", [
            'punto_rojo' => false,
            'monto' => 15000,
            'fecha_vencimiento' => '2026-06-01',
        ])
        ->assertRedirect();

    $multa->refresh();

    expect($multa->punto_rojo)->toBeFalse()
        ->and((float) $multa->monto)->toBe(15000.0)
        ->and($multa->sinImporte())->toBeFalse();
});

it('exige monto y vencimiento si la multa no es de punto rojo', function () {
    $multa = multaBase();

    $this->actingAs($this->admin)
        ->patch("/multas/{$multa->id}", ['punto_rojo' => false])
        ->assertSessionHasErrors(['monto', 'fecha_vencimiento']);
});

it('recalcula el estado del cobro cuando cambia el monto', function () {
    $multa = multaBase(['jurisdiccion' => 'GBA', 'monto' => 20000]);

    // El chofer pagó 10.000 de 20.000: pago parcial.
    $multa->pagos()->create([
        'monto' => 10000,
        'fecha' => '2026-05-10',
        'registrado_por' => $this->admin->id,
    ]);
    $multa->update(['monto_cobrado' => 10000, 'cobrado' => false]);

    // Al bajar el total a 10.000, ese pago ya salda la multa.
    $this->actingAs($this->admin)
        ->patch("/multas/{$multa->id}", [
            'monto' => 10000,
            'fecha_vencimiento' => '2026-06-01',
        ])
        ->assertRedirect();

    $multa->refresh();

    expect($multa->cobrado)->toBeTrue()
        ->and((float) $multa->monto_cobrado)->toBe(10000.0);
});
