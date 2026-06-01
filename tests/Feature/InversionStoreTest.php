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
    $this->empresa = Empresa::create(['nombre' => 'Empresa Test']);
    $this->admin = User::factory()->create(['role' => UserRole::ADMINISTRADOR, 'dni' => '70000001']);
});

it('el administrador crea una inversión en la empresa activa', function () {
    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);

    $this->post('/inversiones', ['nombre' => 'Inversión 7'])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $inv = Inversion::withoutGlobalScope(TenantScope::class)->first();
    expect($inv)->not->toBeNull()
        ->and($inv->nombre)->toBe('Inversión 7')
        ->and($inv->empresa_id)->toBe($this->empresa->id);
});

it('rechaza un nombre duplicado dentro de la misma empresa', function () {
    Inversion::create(['nombre' => 'Inversión 7', 'empresa_id' => $this->empresa->id]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);

    $this->post('/inversiones', ['nombre' => 'Inversión 7'])
        ->assertSessionHasErrors('nombre');

    expect(Inversion::withoutGlobalScope(TenantScope::class)->count())->toBe(1);
});

it('permite el mismo nombre en empresas distintas', function () {
    $empresaB = Empresa::create(['nombre' => 'Empresa B']);
    Inversion::create(['nombre' => 'Inversión 7', 'empresa_id' => $empresaB->id]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);

    $this->post('/inversiones', ['nombre' => 'Inversión 7'])
        ->assertSessionHasNoErrors();

    expect(Inversion::withoutGlobalScope(TenantScope::class)->count())->toBe(2);
});

it('requiere el nombre', function () {
    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);

    $this->post('/inversiones', ['nombre' => ''])
        ->assertSessionHasErrors('nombre');
});

it('el administrativo no puede crear inversiones', function () {
    $administrativo = User::factory()->create(['role' => UserRole::ADMINISTRATIVO, 'dni' => '70000002']);

    $this->actingAs($administrativo);
    session(['active_company_id' => $this->empresa->id]);

    $this->post('/inversiones', ['nombre' => 'Inversión X'])->assertForbidden();

    expect(Inversion::withoutGlobalScope(TenantScope::class)->count())->toBe(0);
});
