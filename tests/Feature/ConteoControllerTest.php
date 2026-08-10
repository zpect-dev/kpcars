<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Articulo;
use App\Models\Cobro;
use App\Models\Conteo;
use App\Models\Scopes\TenantScope;
use App\Models\Transaccion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::ADMINISTRADOR, 'dni' => '80000001']);
    $this->mecanico = User::factory()->create(['role' => UserRole::MECANICO, 'dni' => '80000002']);

    $this->aceite = Articulo::create(['descripcion' => 'Aceite', 'stock' => 10, 'min_stock' => 1, 'precio' => 100, 'repuestos' => true]);
});

it('admin ve la pantalla de conteo sin el stock esperado (a ciegas)', function () {
    $this->actingAs($this->admin)
        ->get('/conteos')
        ->assertOk()
        ->assertInertia(fn ($p) => $p
            ->component('Conteo/Index')
            ->has('items', 1)
            ->where('items.0.descripcion', 'Aceite')
            ->missing('items.0.stock'),
        );
});

it('mecánico no puede acceder al conteo', function () {
    $this->actingAs($this->mecanico)
        ->get('/conteos')
        ->assertForbidden();
});

it('el preview revela la diferencia sin aplicar nada', function () {
    $this->actingAs($this->admin)
        ->post('/conteos/preview', [
            'zona' => 'repuestos',
            'lineas' => [['articulo_id' => $this->aceite->id, 'fisico' => 8]],
        ])
        ->assertOk()
        ->assertInertia(fn ($p) => $p
            ->has('preview.lineas', 1)
            ->where('preview.lineas.0.esperado', 10)
            ->where('preview.lineas.0.diferencia', -2),
        );

    // El preview no toca el stock.
    expect($this->aceite->fresh()->stock)->toBe(10);
});

it('admin confirma un conteo con faltante y aplica el ajuste', function () {
    $this->actingAs($this->admin)
        ->post('/conteos', [
            'zona' => 'repuestos',
            'lineas' => [[
                'articulo_id' => $this->aceite->id,
                'fisico' => 8,
                'motivo' => 'perdida_no_explicada',
                'nota' => 'Faltan 2',
            ]],
        ])
        ->assertRedirect(route('conteos.index'))
        ->assertSessionHas('success');

    expect($this->aceite->fresh()->stock)->toBe(8)
        ->and(Transaccion::where('tipo', 'AJUSTE')->count())->toBe(1)
        ->and(Conteo::count())->toBe(1)
        // Un ajuste nunca genera cobro.
        ->and(Cobro::withoutGlobalScope(TenantScope::class)->count())->toBe(0);
});

it('rechaza confirmar una diferencia sin motivo (nada se aplica)', function () {
    $this->actingAs($this->admin)
        ->post('/conteos', [
            'zona' => 'repuestos',
            'lineas' => [['articulo_id' => $this->aceite->id, 'fisico' => 8]],
        ])
        ->assertSessionHasErrors('lineas');

    expect($this->aceite->fresh()->stock)->toBe(10)
        ->and(Conteo::count())->toBe(0);
});

it('mecánico no puede confirmar un conteo', function () {
    $this->actingAs($this->mecanico)
        ->post('/conteos', [
            'zona' => 'repuestos',
            'lineas' => [['articulo_id' => $this->aceite->id, 'fisico' => 8, 'motivo' => 'rotura', 'nota' => 'x']],
        ])
        ->assertForbidden();

    expect($this->aceite->fresh()->stock)->toBe(10);
});

it('devuelve los movimientos recientes de un artículo para investigar', function () {
    // Un AJUSTE previo que debe aparecer en la investigación.
    $this->actingAs($this->admin)->post('/conteos', [
        'zona' => 'repuestos',
        'lineas' => [['articulo_id' => $this->aceite->id, 'fisico' => 7, 'motivo' => 'rotura', 'nota' => 'Rota']],
    ]);

    $this->actingAs($this->admin)
        ->getJson("/conteos/movimientos/{$this->aceite->id}")
        ->assertOk()
        ->assertJsonPath('articulo.descripcion', 'Aceite')
        ->assertJsonPath('movimientos.0.tipo', 'AJUSTE')
        ->assertJsonPath('movimientos.0.cantidad', -3);
});
