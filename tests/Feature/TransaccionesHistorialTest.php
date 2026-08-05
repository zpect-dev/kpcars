<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Articulo;
use App\Models\Transaccion;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'must_change_password' => false,
    ]);

    $this->articulo = Articulo::create(['descripcion' => 'Filtro de Aceite', 'stock' => 10]);

    $this->activa = Transaccion::create([
        'articulo_id' => $this->articulo->id,
        'user_id' => $this->admin->id,
        'tipo' => 'IN',
        'cantidad' => 5,
        'inactiva' => false,
    ]);

    $this->anulada = Transaccion::create([
        'articulo_id' => $this->articulo->id,
        'user_id' => $this->admin->id,
        'tipo' => 'OUT',
        'cantidad' => 3,
        'inactiva' => true,
    ]);
});

it('muestra en el historial las transacciones anuladas marcadas como devolución', function () {
    $this->actingAs($this->admin)
        ->get('/transactions')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Transactions/Index')
            ->has('transactions.data', 2)
            ->where('filters.estado', 'todas')
            // La anulada llega con el flag que la vista marca como devolución.
            ->where('transactions.data.0.id', $this->anulada->id)
            ->where('transactions.data.0.inactiva', true)
            ->where('transactions.data.1.inactiva', false)
        );
});

it('filtra sólo devoluciones', function () {
    $this->actingAs($this->admin)
        ->get('/transactions?estado=anuladas')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('transactions.data', 1)
            ->where('transactions.data.0.id', $this->anulada->id)
        );
});

it('filtra el historial sin devoluciones', function () {
    $this->actingAs($this->admin)
        ->get('/transactions?estado=activas')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('transactions.data', 1)
            ->where('transactions.data.0.id', $this->activa->id)
        );
});

it('anular deja la transacción en el historial y devuelve el stock', function () {
    $this->actingAs($this->admin)
        ->post("/transactions/{$this->activa->id}/annul")
        ->assertRedirect();

    expect(Transaccion::withoutGlobalScope('activa')->find($this->activa->id)->inactiva)->toBeTrue()
        ->and($this->articulo->fresh()->stock)->toBe(5);

    $this->actingAs($this->admin)
        ->get('/transactions')
        ->assertInertia(fn ($page) => $page->has('transactions.data', 2));
});
