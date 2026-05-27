<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresaA = Empresa::create(['nombre' => 'Empresa A']);
    $this->empresaB = Empresa::create(['nombre' => 'Empresa B']);
});

it('share: admin recibe permisos completos y empresas disponibles', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '40000001',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $this->actingAs($admin)->get('/dashboard')->assertInertia(fn ($p) => $p
        ->has('auth.user', fn ($u) => $u
            ->where('id', $admin->id)
            ->where('role', UserRole::ADMINISTRADOR->value)
            ->etc()
        )
        ->where('auth.active_company.id', $this->empresaA->id)
        ->where('auth.active_company.nombre', 'Empresa A')
        ->has('auth.empresas_disponibles', 2)
        ->where('auth.permissions.can_view_vehiculos', true)
        ->where('auth.permissions.can_view_cobros', true)
        ->where('auth.permissions.can_view_gastos', true)
        ->where('auth.permissions.can_view_inversiones', true)
        ->where('auth.permissions.can_manage_precios', true)
        ->where('auth.permissions.can_annul_transactions', true)
        ->where('auth.permissions.can_switch_empresa', true)
        ->where('auth.permissions.can_view_mi_cuenta', false)
    );
});

it('share: administrativo recibe permisos limitados y puede switchear empresa', function () {
    $admvo = User::factory()->create([
        'role' => UserRole::ADMINISTRATIVO,
        'dni' => '40000002',
        'empresa_default_id' => $this->empresaB->id,
    ]);

    $this->actingAs($admvo)->get('/dashboard')->assertInertia(fn ($p) => $p
        ->where('auth.active_company.id', $this->empresaB->id)
        ->has('auth.empresas_disponibles', 2)
        ->where('auth.permissions.can_view_vehiculos', true)
        ->where('auth.permissions.can_view_inventario', true)
        ->where('auth.permissions.can_view_turnos', true)
        ->where('auth.permissions.can_view_revisiones', true)
        ->where('auth.permissions.can_view_personal', true)
        ->where('auth.permissions.can_switch_empresa', true)
        // ── Bloqueado:
        ->where('auth.permissions.can_view_cobros', false)
        ->where('auth.permissions.can_view_gastos', false)
        ->where('auth.permissions.can_view_inversiones', false)
        ->where('auth.permissions.can_manage_precios', false)
        ->where('auth.permissions.can_annul_transactions', false)
        ->where('auth.permissions.can_view_mi_cuenta', false)
    );
});

it('share: mecánico ve solo inventario/turnos y NO recibe empresas disponibles', function () {
    $mec = User::factory()->create([
        'role' => UserRole::MECANICO,
        'dni' => '40000003',
    ]);

    $this->actingAs($mec)->get('/appointments')->assertInertia(fn ($p) => $p
        ->where('auth.active_company', null)
        ->where('auth.empresas_disponibles', [])
        ->where('auth.permissions.can_view_inventario', true)
        ->where('auth.permissions.can_view_turnos', true)
        ->where('auth.permissions.can_switch_empresa', false)
        ->where('auth.permissions.can_view_vehiculos', false)
        ->where('auth.permissions.can_view_revisiones', false)
        ->where('auth.permissions.can_view_personal', false)
        ->where('auth.permissions.can_view_cobros', false)
    );
});

it('share: inversor con inversiones tiene can_view_mi_cuenta=true', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '40000004',
        'empresa_default_id' => $this->empresaA->id,
    ]);
    $inversor->empresas()->sync([$this->empresaA->id]);
    $inv = Inversion::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
        ->create(['nombre' => 'Inv X', 'empresa_id' => $this->empresaA->id]);
    $inv->inversores()->attach($inversor->id, ['tiene_deuda' => false, 'es_financiador' => false]);

    $this->actingAs($inversor)->get('/mi-cuenta')->assertInertia(fn ($p) => $p
        ->where('auth.active_company.id', $this->empresaA->id)
        ->where('auth.empresas_disponibles', [])
        ->where('auth.permissions.can_view_mi_cuenta', true)
        ->where('auth.permissions.can_switch_empresa', false)
        ->where('auth.permissions.can_view_vehiculos', false)
    );
});

it('share: inversor con DOS empresas recibe ambas en empresas_disponibles y can_switch_empresa=true', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '40000044',
        'empresa_default_id' => $this->empresaA->id,
    ]);
    $inversor->empresas()->sync([$this->empresaA->id, $this->empresaB->id]);

    // Inversión en A para que can_view_mi_cuenta sea true.
    $inv = Inversion::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
        ->create(['nombre' => 'Inv Y', 'empresa_id' => $this->empresaA->id]);
    $inv->inversores()->attach($inversor->id, ['tiene_deuda' => false, 'es_financiador' => false]);

    $this->actingAs($inversor)->get('/mi-cuenta')->assertInertia(fn ($p) => $p
        ->where('auth.permissions.can_switch_empresa', true)
        ->has('auth.empresas_disponibles', 2)
    );
});

it('share: inversor sin inversiones tiene can_view_mi_cuenta=false', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '40000005',
    ]);
    $inversor->empresas()->sync([$this->empresaA->id]);

    // Endpoint público que respeta middleware web pero no requiere auth gate.
    $this->actingAs($inversor)->get('/')->assertInertia(fn ($p) => $p
        ->where('auth.permissions.can_view_mi_cuenta', false)
    );
})->skip('Mi cuenta hace abort 403 cuando no hay inversiones — el test del share requiere un endpoint accesible.');

it('share: el switch de empresa se refleja en active_company del siguiente request', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '40000006',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    // Request inicial: empresa A.
    $this->actingAs($admin)->get('/dashboard')->assertInertia(fn ($p) => $p
        ->where('auth.active_company.id', $this->empresaA->id)
    );

    // Cambio.
    $this->post('/empresa/switch', ['empresa_id' => $this->empresaB->id]);

    // Siguiente request: empresa B.
    $this->get('/dashboard')->assertInertia(fn ($p) => $p
        ->where('auth.active_company.id', $this->empresaB->id)
    );
});

it('share: usuario no autenticado expone auth.user=null y permissions=[]', function () {
    $this->get('/login')->assertInertia(fn ($p) => $p
        ->where('auth.user', null)
        ->where('auth.permissions', [])
        ->where('auth.empresas_disponibles', [])
    );
});

it('share: campos legacy removidos en Fase 8 NO están en el payload', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '49999999',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $response = $this->actingAs($admin)->get('/dashboard');

    $user = $response->inertiaProps('auth.user');

    expect($user)
        ->not->toHaveKey('absoluto')
        ->not->toHaveKey('empresa_acceso')
        ->not->toHaveKey('empresa_restringida_id')
        ->not->toHaveKey('tiene_inversiones')
        ->not->toHaveKey('empresa_id'); // Removido junto con la pivot empresa_user
});
