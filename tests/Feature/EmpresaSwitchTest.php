<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresaA = Empresa::create(['nombre' => 'Empresa A']);
    $this->empresaB = Empresa::create(['nombre' => 'Empresa B']);
});

it('inicializa active_company_id desde empresa_default_id en la primera request del admin', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '10000001',
        'empresa_default_id' => $this->empresaB->id,
    ]);

    $this->actingAs($admin)->get('/dashboard');

    expect(session('active_company_id'))->toBe($this->empresaB->id);
});

it('cae a la primera empresa alfabéticamente cuando el admin no tiene empresa_default_id', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '10000002',
        'empresa_default_id' => null,
    ]);

    $this->actingAs($admin)->get('/dashboard');

    expect(session('active_company_id'))->toBe($this->empresaA->id);
});

it('resetea active_company_id si la empresa de sesión ya no existe', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '10000003',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $this->actingAs($admin)
        ->withSession(['active_company_id' => 9999])
        ->get('/dashboard');

    expect(session('active_company_id'))->toBe($this->empresaA->id);
});

it('fuerza active_company_id al empresa_id del inversor en cada request', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '10000004',
        'empresa_id' => $this->empresaB->id,
        'empresa_default_id' => $this->empresaB->id,
    ]);

    $this->actingAs($inversor)
        ->withSession(['active_company_id' => $this->empresaA->id])
        ->get('/mi-cuenta');

    expect(session('active_company_id'))->toBe($this->empresaB->id);
});

it('no setea active_company_id para mecánicos (entidades globales)', function () {
    $mecanico = User::factory()->create([
        'role' => UserRole::MECANICO,
        'dni' => '10000005',
    ]);

    $this->actingAs($mecanico)->get('/appointments');

    expect(session('active_company_id'))->toBeNull();
});

it('admin puede cambiar de empresa via POST /empresa/switch y persiste como default', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '10000006',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $this->actingAs($admin)
        ->from('/dashboard')
        ->post('/empresa/switch', ['empresa_id' => $this->empresaB->id])
        ->assertRedirect('/dashboard')
        ->assertSessionHas('success');

    expect(session('active_company_id'))->toBe($this->empresaB->id)
        ->and($admin->fresh()->empresa_default_id)->toBe($this->empresaB->id);
});

it('administrativo también puede cambiar de empresa', function () {
    $administrativo = User::factory()->create([
        'role' => UserRole::ADMINISTRATIVO,
        'dni' => '10000007',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $this->actingAs($administrativo)
        ->from('/dashboard')
        ->post('/empresa/switch', ['empresa_id' => $this->empresaB->id])
        ->assertRedirect();

    expect(session('active_company_id'))->toBe($this->empresaB->id);
});

it('inversor NO puede usar /empresa/switch (gate switch-empresa)', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '10000008',
        'empresa_id' => $this->empresaA->id,
    ]);

    $this->actingAs($inversor)
        ->post('/empresa/switch', ['empresa_id' => $this->empresaB->id])
        ->assertForbidden();
});

it('mecánico NO puede usar /empresa/switch', function () {
    $mecanico = User::factory()->create([
        'role' => UserRole::MECANICO,
        'dni' => '10000009',
    ]);

    $this->actingAs($mecanico)
        ->post('/empresa/switch', ['empresa_id' => $this->empresaB->id])
        ->assertForbidden();
});

it('rechaza switch a empresa inexistente', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '10000010',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $this->actingAs($admin)
        ->from('/dashboard')
        ->post('/empresa/switch', ['empresa_id' => 99999])
        ->assertSessionHasErrors('empresa_id');
});
