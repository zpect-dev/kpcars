<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa = Empresa::create(['nombre' => 'EMP_1']);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '10000001',
        'empresa_default_id' => $this->empresa->id,
    ]);
});

/** Helper: inversor perteneciente a la empresa del test. */
function moduloInversor(string $dni): User
{
    $u = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => $dni,
        'inactivo' => false,
    ]);
    $u->empresas()->sync([test()->empresa->id]);

    return $u;
}

it('crea una inversión eligiendo los financiadores en el mismo paso', function () {
    $f1 = moduloInversor('20000001');
    $f2 = moduloInversor('20000002');

    $this->actingAs($this->admin)
        ->post('/inversiones', [
            'nombre' => 'INV_12',
            'financiadores' => [$f1->id, $f2->id],
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $inv = Inversion::withoutGlobalScopes()->where('nombre', 'INV_12')->first();
    expect($inv)->not->toBeNull()
        ->and($inv->empresa_id)->toBe($this->empresa->id);

    $pivotes = DB::table('inversion_user')->where('inversion_id', $inv->id)->get();
    expect($pivotes)->toHaveCount(2);
    foreach ($pivotes as $p) {
        expect((bool) $p->es_financiador)->toBeTrue()
            ->and((float) $p->deuda)->toBe(0.0);
    }
});

it('rechaza financiadores que no tienen rol inversor', function () {
    $chofer = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '30000001']);

    $this->actingAs($this->admin)
        ->post('/inversiones', [
            'nombre' => 'INV_13',
            'financiadores' => [$chofer->id],
        ])
        ->assertRedirect()
        ->assertSessionHas('error');

    expect(Inversion::withoutGlobalScopes()->where('nombre', 'INV_13')->exists())->toBeFalse();
});

it('configura las inversiones y deuda del inversor desde Personal', function () {
    $inv1 = Inversion::create(['nombre' => 'INV_1', 'empresa_id' => $this->empresa->id]);
    $inv2 = Inversion::create(['nombre' => 'INV_2', 'empresa_id' => $this->empresa->id]);
    $socio = moduloInversor('20000006');

    $this->actingAs($this->admin)
        ->put("/users/{$socio->id}/inversiones", [
            'inversiones' => [
                ['inversion_id' => $inv1->id, 'es_financiador' => false, 'deuda' => 800],
                ['inversion_id' => $inv2->id, 'es_financiador' => true, 'deuda' => 0],
            ],
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect(DB::table('inversion_user')->where('user_id', $socio->id)->count())->toBe(2);

    $p1 = DB::table('inversion_user')->where('user_id', $socio->id)->where('inversion_id', $inv1->id)->first();
    expect((float) $p1->deuda)->toBe(800.0);

    // Quitar una inversión del set la desasigna.
    $this->actingAs($this->admin)
        ->put("/users/{$socio->id}/inversiones", [
            'inversiones' => [
                ['inversion_id' => $inv2->id, 'es_financiador' => true, 'deuda' => 0],
            ],
        ])
        ->assertRedirect();

    expect(DB::table('inversion_user')->where('user_id', $socio->id)->count())->toBe(1);
});

it('el administrativo no puede configurar inversiones desde Personal', function () {
    $administrativo = User::factory()->create([
        'role' => UserRole::ADMINISTRATIVO,
        'dni' => '10000002',
    ]);
    $socio = moduloInversor('20000007');

    $this->actingAs($administrativo)
        ->put("/users/{$socio->id}/inversiones", ['inversiones' => []])
        ->assertForbidden();
});

it('mi cuenta muestra las inversiones con deuda y estado del inversor', function () {
    $socio = moduloInversor('20000008');
    $inv = Inversion::create(['nombre' => 'INV_1', 'empresa_id' => $this->empresa->id]);
    $inv->inversores()->attach($socio->id, ['es_financiador' => false, 'deuda' => 350]);

    $this->actingAs($socio)
        ->get('/mi-cuenta')
        ->assertOk()
        ->assertInertia(fn ($p) => $p
            ->component('MiCuenta/Index')
            ->has('inversiones', 1)
            ->where('inversiones.0.nombre', 'INV_1')
            ->where('inversiones.0.deuda', 350)
            ->where('inversiones.0.es_financiador', false)
        );
});
