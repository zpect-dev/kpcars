<?php

declare(strict_types=1);

use App\Actions\ProcessStockMovementAction;
use App\Models\Articulo;
use App\Models\Inversion;
use App\Models\Transaccion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create([
        'dni' => '12341234',
        'password' => bcrypt('password'),
    ]);
    $this->inversion = Inversion::create(['nombre' => 'Test Inversion']);
    
    $this->action = new ProcessStockMovementAction();
});

it('ingresa stock correctamente sin patente', function () {
    $articulo = Articulo::create([
        'descripcion' => 'Filtro de Aceite',
        'stock' => 10,
    ]);

    $this->actingAs($this->user);

    $this->action->execute($articulo, 'IN', 15);

    $articulo->refresh();

    expect($articulo->stock)->toBe(25);
    expect(Transaccion::count())->toBe(1);
    
    $transaccion = Transaccion::first();
    expect($transaccion->tipo)->toBe('IN')
        ->and($transaccion->cantidad)->toBe(15)
        ->and($transaccion->vehiculo_id)->toBeNull();
});

it('egresa stock correctamente indicando patente', function () {
    $articulo = Articulo::create([
        'descripcion' => 'Batería 12V',
        'stock' => 5,
    ]);

    $vehiculo = Vehiculo::create([
        'inversion_id' => $this->inversion->id,
        'patente' => 'AB123CD',
        'marca' => 'Toyota',
        'modelo' => 'Corolla',
        'anio' => '2020',
    ]);

    $this->actingAs($this->user);

    $this->action->execute($articulo, 'OUT', 2, 'AB123CD');

    $articulo->refresh();

    expect($articulo->stock)->toBe(3);
    
    $transaccion = Transaccion::first();
    expect($transaccion->tipo)->toBe('OUT')
        ->and($transaccion->cantidad)->toBe(2)
        ->and($transaccion->vehiculo_id)->toBe($vehiculo->id);
});

it('falla al procesar un egreso si no se indica la patente', function () {
    $articulo = Articulo::create([
        'descripcion' => 'Llanta 15"',
        'stock' => 20,
    ]);

    $this->actingAs($this->user);

    $this->action->execute($articulo, 'OUT', 4, null);

})->throws(InvalidArgumentException::class, 'La patente es obligatoria para registrar un egreso de mercadería.');

it('falla al procesar un egreso si no hay stock suficiente', function () {
    $articulo = Articulo::create([
        'descripcion' => 'Bujía',
        'stock' => 2,
    ]);

    $vehiculo = Vehiculo::create([
        'inversion_id' => $this->inversion->id,
        'patente' => 'XYZ987',
        'marca' => 'Ford',
        'modelo' => 'Focus',
        'anio' => '2019',
    ]);

    $this->actingAs($this->user);

    // Debe lanzar Exception por falta de stock
    $this->action->execute($articulo, 'OUT', 5, 'XYZ987');

})->throws(Exception::class, 'Stock insuficiente para realizar esta operación.');
