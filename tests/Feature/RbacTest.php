<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Articulo;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa = Empresa::create(['nombre' => 'Empresa Test']);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '30000001',
        'empresa_default_id' => $this->empresa->id,
    ]);
    $this->administrativo = User::factory()->create([
        'role' => UserRole::ADMINISTRATIVO,
        'dni' => '30000002',
        'empresa_default_id' => $this->empresa->id,
    ]);
    $this->mecanico = User::factory()->create([
        'role' => UserRole::MECANICO,
        'dni' => '30000003',
    ]);
    $this->inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '30000004',
        'empresa_id' => $this->empresa->id,
    ]);
    $this->chofer = User::factory()->create([
        'role' => UserRole::CHOFER,
        'dni' => '30000005',
    ]);
});

// ─── Middleware EnsureRole ──────────────────────────────────────────────────

it('middleware role permite el rol indicado y rechaza al resto', function () {
    Route::middleware(['web', 'auth', 'role:administrador'])
        ->get('/test-solo-admin', fn () => 'ok');

    $this->actingAs($this->admin)->get('/test-solo-admin')->assertOk();
    $this->actingAs($this->administrativo)->get('/test-solo-admin')->assertForbidden();
    $this->actingAs($this->mecanico)->get('/test-solo-admin')->assertForbidden();
});

it('middleware role acepta múltiples roles', function () {
    Route::middleware(['web', 'auth', 'role:administrador,administrativo'])
        ->get('/test-admin-y-adminvo', fn () => 'ok');

    $this->actingAs($this->admin)->get('/test-admin-y-adminvo')->assertOk();
    $this->actingAs($this->administrativo)->get('/test-admin-y-adminvo')->assertOk();
    $this->actingAs($this->mecanico)->get('/test-admin-y-adminvo')->assertForbidden();
    $this->actingAs($this->inversor)->get('/test-admin-y-adminvo')->assertForbidden();
});

// ─── Gates semánticos ───────────────────────────────────────────────────────

it('matriz de gates respeta el contrato del sistema', function () {
    $matrix = [
        'view-vehiculos'       => ['admin', 'administrativo'],
        'view-inventario'      => ['admin', 'administrativo', 'mecanico'],
        'view-turnos'          => ['admin', 'administrativo', 'mecanico'],
        'view-revisiones'      => ['admin', 'administrativo'],
        'view-personal'        => ['admin', 'administrativo'],
        'view-cobros'          => ['admin'],
        'view-gastos'          => ['admin'],
        'view-inversiones'     => ['admin'],
        'view-cierres-inversion' => ['admin'],
        'manage-precios'       => ['admin'],
        'annul-transactions'   => ['admin'],
        'import-asignaciones'  => ['admin'],
        'switch-empresa'       => ['admin', 'administrativo'],
    ];

    $users = [
        'admin' => $this->admin,
        'administrativo' => $this->administrativo,
        'mecanico' => $this->mecanico,
        'inversor' => $this->inversor,
        'chofer' => $this->chofer,
    ];

    foreach ($matrix as $gate => $allowed) {
        foreach ($users as $name => $user) {
            $can = Gate::forUser($user)->allows($gate);
            $shouldAllow = in_array($name, $allowed, true);

            expect($can)
                ->toBe($shouldAllow, "Gate '{$gate}' para '{$name}' esperaba ".($shouldAllow ? 'allow' : 'deny'));
        }
    }
});

it('view-mi-cuenta requiere ser inversor con inversiones asignadas', function () {
    // Inversor sin inversiones → no puede.
    expect(Gate::forUser($this->inversor)->allows('view-mi-cuenta'))->toBeFalse();

    // Atacharle una inversión: ahora sí.
    $inv = Inversion::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
        ->create(['nombre' => 'Inv Test', 'empresa_id' => $this->empresa->id]);
    $inv->inversores()->attach($this->inversor->id, [
        'tiene_deuda' => false,
        'es_financiador' => false,
    ]);

    expect(Gate::forUser($this->inversor->fresh())->allows('view-mi-cuenta'))->toBeTrue();
    expect(Gate::forUser($this->admin)->allows('view-mi-cuenta'))->toBeFalse();
});

// ─── Policies ───────────────────────────────────────────────────────────────

it('VehiculoPolicy: solo admin/administrativo pueden gestionar vehículos', function () {
    $inversion = Inversion::create(['nombre' => 'Inv 1', 'empresa_id' => $this->empresa->id]);
    $vehiculo = Vehiculo::create([
        'patente' => 'TEST01',
        'marca' => 'X',
        'modelo' => 'Y',
        'anio' => '2020',
        'inversion_id' => $inversion->id,
        'empresa_id' => $this->empresa->id,
    ]);

    expect($this->admin->can('update', $vehiculo))->toBeTrue()
        ->and($this->administrativo->can('update', $vehiculo))->toBeTrue()
        ->and($this->mecanico->can('update', $vehiculo))->toBeFalse()
        ->and($this->inversor->can('update', $vehiculo))->toBeFalse();
});

it('ArticuloPolicy: mecánico puede ver/movimentar inventario, sólo admin toca precios', function () {
    $articulo = Articulo::create([
        'descripcion' => 'Test',
        'stock' => 10,
        'min_stock' => 1,
        'precio' => 100,
    ]);

    expect($this->mecanico->can('view', $articulo))->toBeTrue()
        ->and($this->mecanico->can('storeMovement', \App\Models\Articulo::class))->toBeTrue()
        ->and($this->mecanico->can('updatePrecio', $articulo))->toBeFalse()
        ->and($this->administrativo->can('updatePrecio', $articulo))->toBeFalse()
        ->and($this->admin->can('updatePrecio', $articulo))->toBeTrue();
});

it('UserPolicy: nadie puede modificar su propio rol/estado/absoluto', function () {
    expect($this->admin->can('updateRole', $this->admin))->toBeFalse()
        ->and($this->admin->can('toggleStatus', $this->admin))->toBeFalse()
        ->and($this->admin->can('toggleAbsoluto', $this->admin))->toBeFalse()
        ->and($this->admin->can('updateRole', $this->administrativo))->toBeTrue();
});

it('UserPolicy: administrativo puede gestionar usuarios (incluyendo crear admin)', function () {
    expect($this->administrativo->can('create', \App\Models\User::class))->toBeTrue()
        ->and($this->administrativo->can('update', $this->mecanico))->toBeTrue()
        ->and($this->administrativo->can('updateRole', $this->mecanico))->toBeTrue();
});

it('AppointmentPolicy: mecánico no puede cancelar turnos ni reabrir completados', function () {
    $appointment = \App\Models\Appointment::create([
        'service' => 'X',
        'license_plate' => 'ABC123',
        'applicant' => 'Y',
        'scheduled_date' => now()->toDateString(),
        'type' => 'normal',
        'status' => 'agendado',
    ]);

    // Estado normal: mecánico puede.
    expect($this->mecanico->can('updateStatus', [$appointment, 'completado']))->toBeTrue();

    // Mecánico no puede cancelar.
    expect($this->mecanico->can('updateStatus', [$appointment, 'cancelado']))->toBeFalse();

    // Cuando ya está completado, mecánico no puede tocar; admin sí.
    $appointment->update(['status' => 'completado']);
    expect($this->mecanico->can('updateStatus', [$appointment, 'agendado']))->toBeFalse()
        ->and($this->admin->can('updateStatus', [$appointment, 'agendado']))->toBeTrue();
});
