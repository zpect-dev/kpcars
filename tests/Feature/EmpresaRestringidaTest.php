<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresaA = Empresa::create(['nombre' => 'Empresa A']);
    $this->empresaB = Empresa::create(['nombre' => 'Empresa B']);
});

it('administrativo restringido queda fijado a su empresa y no puede switchear', function () {
    $admvo = User::factory()->create([
        'role' => UserRole::ADMINISTRATIVO,
        'dni' => '70000001',
        'empresa_default_id' => $this->empresaA->id,
        'empresa_restringida_id' => $this->empresaB->id,
    ]);

    // El Gate switch-empresa es false para él.
    expect(Gate::forUser($admvo)->allows('switch-empresa'))->toBeFalse();

    // Aunque la sesión apunte a otra empresa, el middleware la fuerza a la restringida.
    $this->actingAs($admvo)
        ->withSession(['active_company_id' => $this->empresaA->id])
        ->get('/dashboard');

    expect(session('active_company_id'))->toBe($this->empresaB->id);
});

it('administrativo restringido recibe empresas_disponibles vacío (sin switcher)', function () {
    $admvo = User::factory()->create([
        'role' => UserRole::ADMINISTRATIVO,
        'dni' => '70000002',
        'empresa_restringida_id' => $this->empresaA->id,
    ]);

    $this->actingAs($admvo)->get('/dashboard')->assertInertia(fn ($p) => $p
        ->where('auth.permissions.can_switch_empresa', false)
        ->where('auth.empresas_disponibles', [])
        ->where('auth.active_company.id', $this->empresaA->id)
    );
});

it('administrativo restringido NO puede usar /empresa/switch', function () {
    $admvo = User::factory()->create([
        'role' => UserRole::ADMINISTRATIVO,
        'dni' => '70000003',
        'empresa_restringida_id' => $this->empresaA->id,
    ]);

    $this->actingAs($admvo)
        ->post('/empresa/switch', ['empresa_id' => $this->empresaB->id])
        ->assertForbidden();
});

it('administrativo SIN restricción sigue pudiendo switchear', function () {
    $admvo = User::factory()->create([
        'role' => UserRole::ADMINISTRATIVO,
        'dni' => '70000004',
        'empresa_default_id' => $this->empresaA->id,
        'empresa_restringida_id' => null,
    ]);

    expect(Gate::forUser($admvo)->allows('switch-empresa'))->toBeTrue();

    $this->actingAs($admvo)
        ->from('/dashboard')
        ->post('/empresa/switch', ['empresa_id' => $this->empresaB->id])
        ->assertRedirect();

    expect(session('active_company_id'))->toBe($this->empresaB->id);
});

it('UserController persiste empresa_restringida_id para administrativo', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '70000005',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    $this->post('/users', [
        'name' => 'Admvo Restringido',
        'dni' => '70009999',
        'role' => 'administrativo',
        'empresa_restringida_id' => $this->empresaB->id,
    ])->assertRedirect();

    $nuevo = User::where('dni', '70009999')->first();
    expect($nuevo->empresa_restringida_id)->toBe($this->empresaB->id);
});

it('empresa_restringida_id se ignora para roles que no son admin/administrativo', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '70000006',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    $this->post('/users', [
        'name' => 'Mec Test',
        'dni' => '70008888',
        'role' => 'mecanico',
        'empresa_restringida_id' => $this->empresaB->id, // debe ignorarse
    ])->assertRedirect();

    expect(User::where('dni', '70008888')->first()->empresa_restringida_id)->toBeNull();
});
