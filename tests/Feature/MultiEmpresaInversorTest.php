<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresaA = Empresa::create(['nombre' => 'Empresa A']);
    $this->empresaB = Empresa::create(['nombre' => 'Empresa B']);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '50000001',
        'empresa_default_id' => $this->empresaA->id,
    ]);
});

it('User::empresas relation devuelve solo las empresas del pivot', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '50000002',
    ]);
    $inversor->empresas()->sync([$this->empresaA->id, $this->empresaB->id]);

    expect($inversor->empresas()->pluck('empresas.id')->all())
        ->toEqualCanonicalizing([$this->empresaA->id, $this->empresaB->id]);

    expect($inversor->empresaIds())
        ->toEqualCanonicalizing([$this->empresaA->id, $this->empresaB->id]);
});

it('UserController::store crea inversor y sincroniza pivot empresas[]', function () {
    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresaA->id]);

    $this->post('/users', [
        'name' => 'Juan Multi',
        'dni' => '99999999',
        'role' => 'inversor',
        'empresas' => [$this->empresaA->id, $this->empresaB->id],
    ])->assertRedirect();

    $juan = User::where('dni', '99999999')->first();
    expect($juan)->not->toBeNull()
        ->and($juan->empresaIds())->toEqualCanonicalizing([$this->empresaA->id, $this->empresaB->id])
        ->and($juan->empresa_default_id)->toBe($this->empresaA->id);
});

it('UserController::store sin empresas usa la activa como default', function () {
    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresaB->id]);

    $this->post('/users', [
        'name' => 'Sin empresas explicitas',
        'dni' => '99999998',
        'role' => 'inversor',
    ])->assertRedirect();

    $u = User::where('dni', '99999998')->first();
    expect($u->empresaIds())->toBe([$this->empresaB->id]);
});

it('UserController::update sincroniza empresas (puede agregar y quitar)', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '50000003',
    ]);
    $inversor->empresas()->sync([$this->empresaA->id]);

    $this->actingAs($this->admin);

    $this->put("/users/{$inversor->id}", [
        'name' => $inversor->name,
        'dni' => $inversor->dni,
        'empresas' => [$this->empresaB->id], // Mueve de A a B
    ])->assertRedirect();

    expect($inversor->fresh()->empresaIds())->toBe([$this->empresaB->id]);
});

it('InversionController::index muestra solo inversores con la empresa activa en su pivot', function () {
    $inversorA = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '50000010',
    ]);
    $inversorA->empresas()->sync([$this->empresaA->id]);

    $inversorB = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '50000011',
    ]);
    $inversorB->empresas()->sync([$this->empresaB->id]);

    $inversorAB = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '50000012',
    ]);
    $inversorAB->empresas()->sync([$this->empresaA->id, $this->empresaB->id]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresaA->id]);

    $response = $this->get('/inversiones');
    $disponibles = collect($response->inertiaProps('inversoresDisponibles'))->pluck('id')->all();

    expect($disponibles)->toEqualCanonicalizing([$inversorA->id, $inversorAB->id])
        ->not->toContain($inversorB->id);
});

it('MiCuenta del inversor multi-empresa muestra inversiones de ambas (bypass TenantScope)', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '50000020',
        'empresa_default_id' => $this->empresaA->id,
    ]);
    $inversor->empresas()->sync([$this->empresaA->id, $this->empresaB->id]);

    $invA = Inversion::withoutGlobalScope(TenantScope::class)
        ->create(['nombre' => 'Inv A1', 'empresa_id' => $this->empresaA->id]);
    $invB = Inversion::withoutGlobalScope(TenantScope::class)
        ->create(['nombre' => 'Inv B1', 'empresa_id' => $this->empresaB->id]);

    $invA->inversores()->attach($inversor->id, ['tiene_deuda' => false, 'es_financiador' => false]);
    $invB->inversores()->attach($inversor->id, ['tiene_deuda' => false, 'es_financiador' => false]);

    $this->actingAs($inversor)->get('/mi-cuenta')->assertInertia(fn ($p) => $p
        ->has('inversiones', 2)
    );
});

it('Inversor sin empresas asignadas no recibe active_company_id', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '50000030',
    ]);
    // No sync — sin empresas.

    $this->actingAs($inversor)
        ->withSession(['active_company_id' => $this->empresaA->id])
        ->get('/login'); // Endpoint cualquiera que pase por SetActiveCompany.

    expect(session('active_company_id'))->toBeNull();
});
