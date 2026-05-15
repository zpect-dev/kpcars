<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\DeudaMovimiento;
use App\Models\Inversion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '99999999',
    ]);

    $this->inversion = Inversion::create(['nombre' => 'Test Inversion']);

    $this->inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '11111111',
    ]);
});

// ─── /inversiones (index) ──────────────────────────────────────────────────

it('admin puede ver el panel de inversiones', function () {
    $this->actingAs($this->admin)
        ->get('/inversiones')
        ->assertOk()
        ->assertInertia(fn ($p) => $p->component('Inversiones/Index')
            ->has('inversiones')
            ->has('inversoresDisponibles')
            ->where('maxInversores', Inversion::MAX_INVERSORES)
        );
});

it('inversor no puede acceder al panel de inversiones', function () {
    $this->actingAs($this->inversor)
        ->get('/inversiones')
        ->assertForbidden();
});

it('chofer no puede acceder al panel de inversiones', function () {
    $chofer = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '22222222']);

    $this->actingAs($chofer)
        ->get('/inversiones')
        ->assertForbidden();
});

it('mecanico no puede acceder al panel de inversiones', function () {
    $mecanico = User::factory()->create(['role' => UserRole::MECANICO, 'dni' => '33333333']);

    $this->actingAs($mecanico)
        ->get('/inversiones')
        ->assertForbidden();
});

it('usuario no autenticado es redirigido', function () {
    $this->get('/inversiones')->assertRedirect('/login');
});

it('index muestra inversiones con sus inversores y saldos', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    DeudaMovimiento::create([
        'inversion_id' => $this->inversion->id,
        'user_id' => $this->inversor->id,
        'tipo' => 'cargo',
        'monto' => 100000.00,
        'registrado_por' => $this->admin->id,
    ]);

    DeudaMovimiento::create([
        'inversion_id' => $this->inversion->id,
        'user_id' => $this->inversor->id,
        'tipo' => 'pago',
        'monto' => 30000.00,
        'registrado_por' => $this->admin->id,
    ]);

    $this->actingAs($this->admin)
        ->get('/inversiones')
        ->assertOk()
        ->assertInertia(fn ($p) => $p->component('Inversiones/Index')
            ->has('inversiones.0.inversores', 1)
            ->where('inversiones.0.inversores.0.tiene_deuda', true)
            ->where('inversiones.0.inversores.0.saldo_deuda', fn ($v) => (float) $v === 70000.0)
        );
});

it('solo lista inversores activos en inversoresDisponibles', function () {
    User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '44444444',
        'inactivo' => true,
    ]);

    $this->actingAs($this->admin)
        ->get('/inversiones')
        ->assertOk()
        ->assertInertia(fn ($p) => $p->has('inversoresDisponibles', 1));
});

// ─── attach inversor ────────────────────────────────────────────────────────

it('admin puede asignar un inversor a una inversion', function () {
    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores", [
            'user_id' => $this->inversor->id,
            'tiene_deuda' => false,
            'es_financiador' => false,
        ])
        ->assertRedirect();

    expect($this->inversion->inversores()->count())->toBe(1);
});

it('admin puede asignar inversor marcado como deudor', function () {
    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores", [
            'user_id' => $this->inversor->id,
            'tiene_deuda' => true,
            'es_financiador' => false,
        ])
        ->assertRedirect();

    $pivot = $this->inversion->inversores()->first()->pivot;
    expect((bool) $pivot->tiene_deuda)->toBeTrue();
    expect((bool) $pivot->es_financiador)->toBeFalse();
});

it('admin puede asignar inversor marcado como financiador', function () {
    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores", [
            'user_id' => $this->inversor->id,
            'tiene_deuda' => false,
            'es_financiador' => true,
        ])
        ->assertRedirect();

    $pivot = $this->inversion->inversores()->first()->pivot;
    expect((bool) $pivot->es_financiador)->toBeTrue();
});

it('rechaza asignar inversor como deudor Y financiador al mismo tiempo', function () {
    $this->actingAs($this->admin)
        ->from('/inversiones')
        ->post("/inversiones/{$this->inversion->id}/inversores", [
            'user_id' => $this->inversor->id,
            'tiene_deuda' => true,
            'es_financiador' => true,
        ])
        ->assertRedirect('/inversiones')
        ->assertSessionHas('error');

    expect($this->inversion->inversores()->count())->toBe(0);
});

it('rechaza asignar un usuario que no tiene rol inversor', function () {
    $chofer = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '55555555']);

    $this->actingAs($this->admin)
        ->from('/inversiones')
        ->post("/inversiones/{$this->inversion->id}/inversores", [
            'user_id' => $chofer->id,
        ])
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($this->inversion->inversores()->count())->toBe(0);
});

it('rechaza asignar el mismo inversor dos veces', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->withoutExceptionHandling();

    try {
        $this->actingAs($this->admin)
            ->post("/inversiones/{$this->inversion->id}/inversores", [
                'user_id' => $this->inversor->id,
            ]);
        $this->fail('Expected RuntimeException was not thrown.');
    } catch (RuntimeException $e) {
        expect($e->getMessage())->toContain('ya está asignado');
    }

    expect($this->inversion->inversores()->count())->toBe(1);
});

it('bloquea asignar mas de 6 inversores', function () {
    for ($i = 0; $i < Inversion::MAX_INVERSORES; $i++) {
        $u = User::factory()->create([
            'role' => UserRole::INVERSOR,
            'dni' => '7000000'.$i,
        ]);
        $this->inversion->inversores()->attach($u->id, [
            'tiene_deuda' => false,
            'es_financiador' => false,
        ]);
    }

    $extra = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '88888888',
    ]);

    $this->withoutExceptionHandling();

    try {
        $this->actingAs($this->admin)
            ->post("/inversiones/{$this->inversion->id}/inversores", [
                'user_id' => $extra->id,
            ]);
        $this->fail('Expected RuntimeException was not thrown.');
    } catch (RuntimeException $e) {
        expect($e->getMessage())->toContain('Máximo');
    }

    expect($this->inversion->inversores()->count())->toBe(Inversion::MAX_INVERSORES);
});

it('valida user_id como exists:users,id al asignar', function () {
    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores", [
            'user_id' => 999999,
        ])
        ->assertSessionHasErrors('user_id');
});

it('valida user_id requerido al asignar', function () {
    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores", [])
        ->assertSessionHasErrors('user_id');
});

it('inversor no puede asignar inversores', function () {
    $this->actingAs($this->inversor)
        ->post("/inversiones/{$this->inversion->id}/inversores", [
            'user_id' => $this->inversor->id,
        ])
        ->assertForbidden();
});

// ─── update inversor ────────────────────────────────────────────────────────

it('admin puede actualizar flags de un inversor asignado', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->admin)
        ->patch("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}", [
            'tiene_deuda' => true,
            'es_financiador' => false,
        ])
        ->assertRedirect();

    $pivot = $this->inversion->inversores()->first()->pivot;
    expect((bool) $pivot->tiene_deuda)->toBeTrue();
});

it('update rechaza deudor Y financiador a la vez', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->admin)
        ->from('/inversiones')
        ->patch("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}", [
            'tiene_deuda' => true,
            'es_financiador' => true,
        ])
        ->assertRedirect()
        ->assertSessionHas('error');

    $pivot = $this->inversion->inversores()->first()->pivot;
    expect((bool) $pivot->tiene_deuda)->toBeFalse();
    expect((bool) $pivot->es_financiador)->toBeFalse();
});

it('update requiere ambos flags booleanos', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->admin)
        ->patch("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}", [])
        ->assertSessionHasErrors(['tiene_deuda', 'es_financiador']);
});

it('inversor no puede actualizar flags', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->inversor)
        ->patch("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}", [
            'tiene_deuda' => true,
            'es_financiador' => false,
        ])
        ->assertForbidden();
});

// ─── detach inversor ────────────────────────────────────────────────────────

it('admin puede quitar un inversor de la inversion', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->admin)
        ->delete("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}")
        ->assertRedirect();

    expect($this->inversion->inversores()->count())->toBe(0);
});

it('inversor no puede quitar inversores', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->inversor)
        ->delete("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}")
        ->assertForbidden();
});

// ─── deuda show ────────────────────────────────────────────────────────────

it('admin puede ver el detalle de deuda de un inversor', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    DeudaMovimiento::create([
        'inversion_id' => $this->inversion->id,
        'user_id' => $this->inversor->id,
        'tipo' => 'cargo',
        'monto' => 50000.00,
        'descripcion' => 'Aporte inicial',
        'registrado_por' => $this->admin->id,
    ]);

    $this->actingAs($this->admin)
        ->get("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda")
        ->assertOk()
        ->assertInertia(fn ($p) => $p->component('Inversiones/Deuda')
            ->has('movimientos', 1)
            ->where('saldo', fn ($v) => (float) $v === 50000.0)
            ->where('inversion.id', $this->inversion->id)
            ->where('user.id', $this->inversor->id)
        );
});

it('saldo se calcula como cargos menos pagos', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    foreach ([100, 50, 30] as $m) {
        DeudaMovimiento::create([
            'inversion_id' => $this->inversion->id,
            'user_id' => $this->inversor->id,
            'tipo' => 'cargo',
            'monto' => $m,
            'registrado_por' => $this->admin->id,
        ]);
    }
    foreach ([40, 20] as $m) {
        DeudaMovimiento::create([
            'inversion_id' => $this->inversion->id,
            'user_id' => $this->inversor->id,
            'tipo' => 'pago',
            'monto' => $m,
            'registrado_por' => $this->admin->id,
        ]);
    }

    $this->actingAs($this->admin)
        ->get("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda")
        ->assertInertia(fn ($p) => $p->where('saldo', fn ($v) => (float) $v === 120.0));
});

it('deuda show falla si el inversor no esta asignado a esa inversion', function () {
    $this->actingAs($this->admin)
        ->get("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda")
        ->assertNotFound();
});

it('inversor no puede ver el detalle admin de deuda', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->inversor)
        ->get("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda")
        ->assertForbidden();
});

// ─── deuda store ───────────────────────────────────────────────────────────

it('admin puede registrar un cargo', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda", [
            'tipo' => 'cargo',
            'monto' => 25000.50,
            'descripcion' => 'Préstamo mensual',
        ])
        ->assertRedirect();

    $mov = DeudaMovimiento::first();
    expect($mov->tipo)->toBe('cargo')
        ->and((float) $mov->monto)->toBe(25000.50)
        ->and($mov->descripcion)->toBe('Préstamo mensual')
        ->and($mov->registrado_por)->toBe($this->admin->id);
});

it('admin puede registrar un pago', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda", [
            'tipo' => 'pago',
            'monto' => 10000,
        ])
        ->assertRedirect();

    expect(DeudaMovimiento::where('tipo', 'pago')->count())->toBe(1);
});

it('rechaza monto cero o negativo', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda", [
            'tipo' => 'cargo',
            'monto' => 0,
        ])
        ->assertSessionHasErrors('monto');

    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda", [
            'tipo' => 'cargo',
            'monto' => -10,
        ])
        ->assertSessionHasErrors('monto');
});

it('rechaza tipo invalido en deuda', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda", [
            'tipo' => 'invalido',
            'monto' => 100,
        ])
        ->assertSessionHasErrors('tipo');
});

it('rechaza registrar deuda si el inversor no esta asignado', function () {
    $this->actingAs($this->admin)
        ->post("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda", [
            'tipo' => 'cargo',
            'monto' => 100,
        ])
        ->assertNotFound();
});

it('inversor no puede registrar movimientos de deuda', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->inversor)
        ->post("/inversiones/{$this->inversion->id}/inversores/{$this->inversor->id}/deuda", [
            'tipo' => 'cargo',
            'monto' => 100,
        ])
        ->assertForbidden();
});

// ─── relaciones modelo ─────────────────────────────────────────────────────

it('eliminar una inversion elimina las asignaciones y movimientos', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    DeudaMovimiento::create([
        'inversion_id' => $this->inversion->id,
        'user_id' => $this->inversor->id,
        'tipo' => 'cargo',
        'monto' => 100,
        'registrado_por' => $this->admin->id,
    ]);

    $this->inversion->delete();

    expect(DeudaMovimiento::count())->toBe(0);
    expect(\DB::table('inversion_user')->count())->toBe(0);
});

it('eliminar un user elimina las asignaciones', function () {
    $this->inversion->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->inversor->delete();

    expect(\DB::table('inversion_user')->count())->toBe(0);
});
