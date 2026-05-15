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
        'dni' => '90000001',
    ]);

    $this->inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '90000002',
    ]);
});

it('inversor puede ver su cuenta', function () {
    $this->actingAs($this->inversor)
        ->get('/mi-cuenta')
        ->assertOk()
        ->assertInertia(fn ($p) => $p->component('MiCuenta/Index')->has('inversiones'));
});

it('admin no puede acceder a mi-cuenta', function () {
    $this->actingAs($this->admin)
        ->get('/mi-cuenta')
        ->assertForbidden();
});

it('chofer no puede acceder a mi-cuenta', function () {
    $chofer = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '90000003']);
    $this->actingAs($chofer)
        ->get('/mi-cuenta')
        ->assertForbidden();
});

it('mecanico no puede acceder a mi-cuenta', function () {
    $mec = User::factory()->create(['role' => UserRole::MECANICO, 'dni' => '90000004']);
    $this->actingAs($mec)
        ->get('/mi-cuenta')
        ->assertForbidden();
});

it('usuario no autenticado es redirigido', function () {
    $this->get('/mi-cuenta')->assertRedirect('/login');
});

it('inversor sin inversiones ve lista vacia', function () {
    $this->actingAs($this->inversor)
        ->get('/mi-cuenta')
        ->assertOk()
        ->assertInertia(fn ($p) => $p->has('inversiones', 0));
});

it('inversor solo ve sus propias inversiones', function () {
    $inv1 = Inversion::create(['nombre' => 'A']);
    $inv2 = Inversion::create(['nombre' => 'B']);
    $otroInversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '90000005',
    ]);

    $inv1->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);
    $inv2->inversores()->attach($otroInversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    $this->actingAs($this->inversor)
        ->get('/mi-cuenta')
        ->assertInertia(fn ($p) => $p->has('inversiones', 1)
            ->where('inversiones.0.id', $inv1->id)
        );
});

it('saldo se calcula correctamente en mi-cuenta', function () {
    $inv = Inversion::create(['nombre' => 'C']);
    $inv->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => true,
        'es_financiador' => false,
    ]);

    DeudaMovimiento::create([
        'inversion_id' => $inv->id,
        'user_id' => $this->inversor->id,
        'tipo' => 'cargo',
        'monto' => 80000,
        'registrado_por' => $this->admin->id,
    ]);
    DeudaMovimiento::create([
        'inversion_id' => $inv->id,
        'user_id' => $this->inversor->id,
        'tipo' => 'pago',
        'monto' => 30000,
        'registrado_por' => $this->admin->id,
    ]);

    $this->actingAs($this->inversor)
        ->get('/mi-cuenta')
        ->assertInertia(fn ($p) => $p->where('inversiones.0.saldo', fn ($v) => (float) $v === 50000.0)
            ->has('inversiones.0.movimientos', 2)
            ->where('inversiones.0.tiene_deuda', true)
        );
});

it('inversor no ve movimientos de otros inversores en la misma inversion', function () {
    $inv = Inversion::create(['nombre' => 'D']);
    $otroInversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '90000006',
    ]);

    $inv->inversores()->attach([
        $this->inversor->id => ['tiene_deuda' => true, 'es_financiador' => false],
        $otroInversor->id => ['tiene_deuda' => true, 'es_financiador' => false],
    ]);

    DeudaMovimiento::create([
        'inversion_id' => $inv->id,
        'user_id' => $this->inversor->id,
        'tipo' => 'cargo',
        'monto' => 100,
        'registrado_por' => $this->admin->id,
    ]);
    DeudaMovimiento::create([
        'inversion_id' => $inv->id,
        'user_id' => $otroInversor->id,
        'tipo' => 'cargo',
        'monto' => 999,
        'registrado_por' => $this->admin->id,
    ]);

    $this->actingAs($this->inversor)
        ->get('/mi-cuenta')
        ->assertInertia(fn ($p) => $p->has('inversiones.0.movimientos', 1)
            ->where('inversiones.0.saldo', fn ($v) => (float) $v === 100.0)
        );
});
