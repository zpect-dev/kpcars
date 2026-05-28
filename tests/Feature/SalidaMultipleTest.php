<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Articulo;
use App\Models\Cobro;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Scopes\TenantScope;
use App\Models\Transaccion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresaA = Empresa::create(['nombre' => 'Empresa A']);
    $this->empresaB = Empresa::create(['nombre' => 'Empresa B']);

    $this->invB = Inversion::create(['nombre' => 'Inv B', 'empresa_id' => $this->empresaB->id]);

    // Carro de empresa B (para verificar enrutamiento de cobro cross-empresa).
    $this->vehB = Vehiculo::create([
        'patente' => 'BBB222',
        'marca' => 'Renault',
        'modelo' => 'Kwid',
        'anio' => '2021',
        'inversion_id' => $this->invB->id,
        'empresa_id' => $this->empresaB->id,
    ]);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '60000001',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $this->aceite = Articulo::create(['descripcion' => 'Aceite', 'stock' => 10, 'min_stock' => 1, 'precio' => 100]);
    $this->filtro = Articulo::create(['descripcion' => 'Filtro', 'stock' => 5, 'min_stock' => 1, 'precio' => 200]);
});

it('procesa una salida múltiple: descuenta stock y genera cobros por línea', function () {
    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresaA->id]);

    $this->post('/articulos/salida-multiple', [
        'patente' => 'BBB222',
        'solicitante' => 'Taller',
        'lineas' => [
            ['articulo_id' => $this->aceite->id, 'cantidad' => 3],
            ['articulo_id' => $this->filtro->id, 'cantidad' => 2],
        ],
    ])->assertRedirect()->assertSessionHas('success');

    expect($this->aceite->fresh()->stock)->toBe(7)
        ->and($this->filtro->fresh()->stock)->toBe(3);

    // Dos transacciones OUT y dos cobros, enrutados a la empresa del carro (B).
    expect(Transaccion::where('tipo', 'OUT')->count())->toBe(2);

    $cobros = Cobro::withoutGlobalScope(TenantScope::class)->get();
    expect($cobros)->toHaveCount(2)
        ->and($cobros->pluck('empresa_id')->unique()->all())->toBe([$this->empresaB->id]);
});

it('es atómica: si una línea no tiene stock, no procesa NADA', function () {
    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresaA->id]);

    $this->post('/articulos/salida-multiple', [
        'patente' => 'BBB222',
        'lineas' => [
            ['articulo_id' => $this->aceite->id, 'cantidad' => 3],
            ['articulo_id' => $this->filtro->id, 'cantidad' => 999], // excede stock
        ],
    ])->assertSessionHasErrors('lineas');

    // Nada cambió: ni stock ni transacciones ni cobros.
    expect($this->aceite->fresh()->stock)->toBe(10)
        ->and($this->filtro->fresh()->stock)->toBe(5)
        ->and(Transaccion::count())->toBe(0)
        ->and(Cobro::withoutGlobalScope(TenantScope::class)->count())->toBe(0);
});

it('rechaza pedido sin líneas', function () {
    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresaA->id]);

    $this->post('/articulos/salida-multiple', [
        'patente' => 'BBB222',
        'lineas' => [],
    ])->assertSessionHasErrors('lineas');
});

it('mecánico puede registrar salida múltiple (inventario operativo)', function () {
    $mecanico = User::factory()->create([
        'role' => UserRole::MECANICO,
        'dni' => '60000002',
    ]);

    $this->actingAs($mecanico);

    $this->post('/articulos/salida-multiple', [
        'patente' => 'BBB222',
        'lineas' => [
            ['articulo_id' => $this->aceite->id, 'cantidad' => 1],
        ],
    ])->assertRedirect();

    expect($this->aceite->fresh()->stock)->toBe(9);
});

it('inversor NO puede registrar salida múltiple', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '60000003',
    ]);
    $inversor->empresas()->sync([$this->empresaA->id]);

    $this->actingAs($inversor)
        ->post('/articulos/salida-multiple', [
            'patente' => 'BBB222',
            'lineas' => [['articulo_id' => $this->aceite->id, 'cantidad' => 1]],
        ])
        ->assertForbidden();
});

it('salida a EXTERNO no genera cobro', function () {
    Vehiculo::create([
        'patente' => 'EXTERNO',
        'marca' => '-',
        'modelo' => '-',
        'anio' => '-',
        'inversion_id' => $this->invB->id,
        'empresa_id' => $this->empresaB->id,
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresaA->id]);

    $this->post('/articulos/salida-multiple', [
        'patente' => 'EXTERNO',
        'descripcion' => 'Venta mostrador',
        'lineas' => [['articulo_id' => $this->aceite->id, 'cantidad' => 2]],
    ])->assertRedirect();

    expect($this->aceite->fresh()->stock)->toBe(8)
        ->and(Cobro::withoutGlobalScope(TenantScope::class)->count())->toBe(0);
});

it('el historial de transacciones es GLOBAL (muestra OUT de todas las empresas)', function () {
    // Carro en empresa A.
    $invA = Inversion::create(['nombre' => 'Inv A', 'empresa_id' => $this->empresaA->id]);
    $vehA = Vehiculo::create([
        'patente' => 'AAA111',
        'marca' => 'Toyota',
        'modelo' => 'Etios',
        'anio' => '2020',
        'inversion_id' => $invA->id,
        'empresa_id' => $this->empresaA->id,
    ]);

    $this->actingAs($this->admin);

    // Egreso a empresa A (estando en A) y a empresa B (estando en A: inventario global).
    session(['active_company_id' => $this->empresaA->id]);
    (new \App\Actions\ProcessBulkStockOutAction)->execute(
        [['articulo_id' => $this->aceite->id, 'cantidad' => 1]], 'AAA111', 'Taller',
    );
    (new \App\Actions\ProcessBulkStockOutAction)->execute(
        [['articulo_id' => $this->filtro->id, 'cantidad' => 1]], 'BBB222', 'Taller',
    );

    // Estando en empresa A, el historial debe mostrar AMBAS transacciones OUT.
    $this->get('/transactions')->assertInertia(fn ($p) => $p
        ->has('transactions.data', 2)
    );

    // Y filtrando por la patente de la otra empresa también la encuentra.
    $this->get('/transactions?plate=BBB222')->assertInertia(fn ($p) => $p
        ->has('transactions.data', 1)
        ->where('transactions.data.0.vehiculo.patente', 'BBB222')
    );
});
