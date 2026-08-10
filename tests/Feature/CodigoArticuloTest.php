<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Articulo;
use App\Models\User;
use App\Support\GeneradorCodigoArticulo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::ADMINISTRADOR, 'dni' => '93000001']);
});

it('arma la familia con las 3 primeras letras del tipo', function () {
    expect(GeneradorCodigoArticulo::familia('Amortiguador Delantero Derecho Corolla'))->toBe('AMO')
        ->and(GeneradorCodigoArticulo::familia('Filtro Aceite Etios'))->toBe('FIL')
        // Ignora acentos y stopwords iniciales.
        ->and(GeneradorCodigoArticulo::familia('Líquido de Freno'))->toBe('LIQ');
});

it('numera correlativo dentro de la familia', function () {
    // ArrayObject: la clausura ve las altas posteriores (una arrow fn captura
    // los arrays por valor).
    $usados = new ArrayObject;
    $existe = fn (string $c) => isset($usados[$c]);

    $a = GeneradorCodigoArticulo::corto('Amortiguador Delantero', $existe);
    $usados[$a] = true;
    $b = GeneradorCodigoArticulo::corto('Amortiguador Trasero', $existe);
    $usados[$b] = true;
    $c = GeneradorCodigoArticulo::corto('Filtro Aceite', $existe);

    expect($a)->toBe('AMO-01')
        ->and($b)->toBe('AMO-02')
        ->and($c)->toBe('FIL-01')
        // Largo fijo de 6 caracteres.
        ->and(strlen($a))->toBe(6);
});

it('autogenera el código al crear un artículo', function () {
    $this->actingAs($this->admin)
        ->post('/articulos', [
            'descripcion' => 'Amortiguador Delantero Derecho Corolla',
            'stock' => 5,
            'min_stock' => 1,
            'repuestos' => true,
        ])
        ->assertRedirect();

    expect(Articulo::first()->codigo)->toBe('AMO-01');
});

it('no repite el código entre artículos de la misma familia', function () {
    $this->actingAs($this->admin)->post('/articulos', [
        'descripcion' => 'Amortiguador Delantero', 'stock' => 1, 'min_stock' => 1, 'repuestos' => true,
    ]);
    $this->actingAs($this->admin)->post('/articulos', [
        'descripcion' => 'Amortiguador Trasero', 'stock' => 1, 'min_stock' => 1, 'repuestos' => true,
    ]);

    expect(Articulo::pluck('codigo')->all())->toBe(['AMO-01', 'AMO-02']);
});

it('sumar stock a un artículo existente no le cambia el código', function () {
    $this->actingAs($this->admin)->post('/articulos', [
        'descripcion' => 'Bateria', 'stock' => 2, 'min_stock' => 1, 'repuestos' => true,
    ]);

    $codigo = Articulo::first()->codigo;

    $this->actingAs($this->admin)->post('/articulos', [
        'descripcion' => 'Bateria', 'stock' => 3, 'min_stock' => 1, 'repuestos' => true,
    ]);

    expect(Articulo::count())->toBe(1)
        ->and(Articulo::first()->codigo)->toBe($codigo)
        ->and(Articulo::first()->stock)->toBe(5);
});

it('rechaza editar un artículo con un código ya usado', function () {
    $this->actingAs($this->admin)->post('/articulos', [
        'descripcion' => 'Bateria', 'stock' => 1, 'min_stock' => 1, 'repuestos' => true,
    ]);
    $this->actingAs($this->admin)->post('/articulos', [
        'descripcion' => 'Radiador', 'stock' => 1, 'min_stock' => 1, 'repuestos' => true,
    ]);

    $radiador = Articulo::where('descripcion', 'Radiador')->first();

    $this->actingAs($this->admin)
        ->patch("/articulos/{$radiador->id}", [
            'descripcion' => 'Radiador',
            'codigo' => 'BAT-01', // ya es de Bateria
            'repuestos' => true,
            'min_stock' => 1,
        ])
        ->assertSessionHasErrors('codigo');

    expect($radiador->fresh()->codigo)->toBe('RAD-01');
});

it('permite fijar un código propio si está libre', function () {
    $this->actingAs($this->admin)->post('/articulos', [
        'descripcion' => 'Bateria', 'stock' => 1, 'min_stock' => 1, 'repuestos' => true,
    ]);

    $bateria = Articulo::first();

    $this->actingAs($this->admin)
        ->patch("/articulos/{$bateria->id}", [
            'descripcion' => 'Bateria',
            'codigo' => 'bat-99',
            'repuestos' => true,
            'min_stock' => 1,
        ])
        ->assertRedirect();

    // Se normaliza a mayúsculas.
    expect($bateria->fresh()->codigo)->toBe('BAT-99');
});
