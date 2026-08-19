<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\AperturaRecaudacion;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Recaudacion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa = Empresa::create(['nombre' => 'EMP_GUARDADO']);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '30000001',
        'empresa_default_id' => $this->empresa->id,
    ]);

    $this->chofer = User::factory()->create([
        'role' => UserRole::CHOFER,
        'dni' => '30000002',
    ]);

    $this->inversion = Inversion::create(['nombre' => 'INV', 'empresa_id' => $this->empresa->id]);

    $this->vehiculo = Vehiculo::withoutGlobalScopes()->create([
        'patente' => 'PRE111',
        'marca' => 'Toyota',
        'modelo' => 'Etios',
        'anio' => '2020',
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
        'user_id' => $this->chofer->id,
        'precio' => 100000,
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);
});

/** Crea una apertura con la fila congelada al precio indicado. */
function guardadoApertura(float $precioSnapshot): AperturaRecaudacion
{
    $apertura = AperturaRecaudacion::create([
        'empresa_id' => test()->empresa->id,
        'user_id' => test()->admin->id,
    ]);

    Recaudacion::create([
        'vehiculo_id' => test()->vehiculo->id,
        'user_id' => test()->chofer->id,
        'empresa_id' => test()->empresa->id,
        'apertura_id' => $apertura->id,
        'efectivo' => 0,
        'transferencia' => 0,
        'total' => 0,
        'descuento' => 0,
        'precio' => $precioSnapshot,
        'descripcion' => null,
    ]);

    return $apertura;
}

it('guarda en la fila de la apertura que muestra el listado, no en una apertura vieja sin cerrar', function () {
    $vieja = guardadoApertura(100000);
    $nueva = guardadoApertura(100000);

    $this->patch("/recaudaciones/{$this->vehiculo->id}", [
        'efectivo' => 50000,
        'transferencia' => 0,
        'descuento' => 0,
        'descripcion' => '',
    ])->assertSessionHasNoErrors();

    $filaVieja = Recaudacion::where('apertura_id', $vieja->id)->first();
    $filaNueva = Recaudacion::where('apertura_id', $nueva->id)->first();

    expect((float) $filaNueva->total)->toBe(50000.0)
        ->and((float) $filaVieja->total)->toBe(0.0);
});

it('ignora las filas huérfanas sin apertura al guardar', function () {
    $apertura = guardadoApertura(100000);

    // Fila sin apertura y sin cierre: quedó de un período viejo y no se lista.
    $huerfana = Recaudacion::create([
        'vehiculo_id' => $this->vehiculo->id,
        'user_id' => $this->chofer->id,
        'empresa_id' => $this->empresa->id,
        'apertura_id' => null,
        'efectivo' => 0,
        'transferencia' => 0,
        'total' => 0,
        'descuento' => 0,
        'precio' => 100000,
        'descripcion' => null,
    ]);

    $this->patch("/recaudaciones/{$this->vehiculo->id}", [
        'efectivo' => 30000,
        'transferencia' => 0,
        'descuento' => 0,
        'descripcion' => '',
    ])->assertSessionHasNoErrors();

    expect((float) Recaudacion::where('apertura_id', $apertura->id)->first()->total)->toBe(30000.0)
        ->and((float) $huerfana->fresh()->total)->toBe(0.0);
});

it('valida el tope contra el precio congelado de la fila, no contra el del vehículo', function () {
    guardadoApertura(80000);

    // El vehículo vale más que la foto: el tope sigue siendo el de la foto.
    $this->vehiculo->update(['precio' => 150000]);

    $this->patch("/recaudaciones/{$this->vehiculo->id}", [
        'efectivo' => 100000,
        'transferencia' => 0,
        'descuento' => 0,
        'descripcion' => '',
    ])->assertSessionHasErrors('transferencia');

    expect((float) Recaudacion::first()->total)->toBe(0.0);
});

it('acepta un total igual al precio congelado menos el descuento', function () {
    guardadoApertura(100000);

    $this->patch("/recaudaciones/{$this->vehiculo->id}", [
        'efectivo' => 60000,
        'transferencia' => 30000,
        'descuento' => 10000,
        'descripcion' => 'pago completo',
    ])->assertSessionHasNoErrors();

    $r = Recaudacion::first();

    expect((float) $r->total)->toBe(90000.0)
        ->and((float) $r->precio)->toBe(100000.0)
        ->and($r->estado)->toBe('pagado');
});
