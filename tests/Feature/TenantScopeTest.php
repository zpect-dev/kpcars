<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Cobro;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Inversion;
use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use App\Models\Transaccion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresaA = Empresa::create(['nombre' => 'Empresa A']);
    $this->empresaB = Empresa::create(['nombre' => 'Empresa B']);

    $this->invA = Inversion::create(['nombre' => 'Inv A', 'empresa_id' => $this->empresaA->id]);
    $this->invB = Inversion::create(['nombre' => 'Inv B', 'empresa_id' => $this->empresaB->id]);

    $this->vehA = Vehiculo::create([
        'patente' => 'AAA111',
        'marca' => 'Toyota',
        'modelo' => 'Etios',
        'anio' => '2020',
        'inversion_id' => $this->invA->id,
        'empresa_id' => $this->empresaA->id,
    ]);
    $this->vehB = Vehiculo::create([
        'patente' => 'BBB222',
        'marca' => 'Renault',
        'modelo' => 'Kwid',
        'anio' => '2021',
        'inversion_id' => $this->invB->id,
        'empresa_id' => $this->empresaB->id,
    ]);
});

it('Vehiculo: filtra automáticamente por la empresa activa en sesión', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '20000001',
        'empresa_default_id' => $this->empresaA->id,
    ]);

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    $vehiculos = Vehiculo::all();
    expect($vehiculos)->toHaveCount(1)
        ->and($vehiculos->first()->id)->toBe($this->vehA->id);
});

it('Vehiculo: cambiar la empresa activa cambia los resultados sin recargar el modelo', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '20000002',
    ]);

    $this->actingAs($admin);

    session(['active_company_id' => $this->empresaA->id]);
    expect(Vehiculo::pluck('patente')->all())->toBe(['AAA111']);

    session(['active_company_id' => $this->empresaB->id]);
    expect(Vehiculo::pluck('patente')->all())->toBe(['BBB222']);
});

it('Vehiculo: withoutGlobalScope(TenantScope) devuelve cross-tenant', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '20000003',
    ]);

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    $todos = Vehiculo::withoutGlobalScope(TenantScope::class)->get();
    expect($todos)->toHaveCount(2);
});

it('Inversion: filtra por empresa activa', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '20000004',
    ]);

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaB->id]);

    $inversiones = Inversion::all();
    expect($inversiones)->toHaveCount(1)
        ->and($inversiones->first()->id)->toBe($this->invB->id);
});

it('Cobro: filtra por empresa activa', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '20000005',
    ]);

    $articulo = \App\Models\Articulo::create([
        'descripcion' => 'Aceite',
        'stock' => 10,
        'min_stock' => 1,
        'precio' => 100,
    ]);

    $txA = Transaccion::create([
        'articulo_id' => $articulo->id,
        'tipo' => 'OUT',
        'cantidad' => 1,
        'license_plate' => 'AAA111',
        'vehiculo_id' => $this->vehA->id,
        'user_id' => $admin->id,
    ]);
    $txB = Transaccion::create([
        'articulo_id' => $articulo->id,
        'tipo' => 'OUT',
        'cantidad' => 1,
        'license_plate' => 'BBB222',
        'vehiculo_id' => $this->vehB->id,
        'user_id' => $admin->id,
    ]);

    Cobro::create(['inversion_id' => $this->invA->id, 'transaccion_id' => $txA->id, 'empresa_id' => $this->empresaA->id]);
    Cobro::create(['inversion_id' => $this->invB->id, 'transaccion_id' => $txB->id, 'empresa_id' => $this->empresaB->id]);

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    expect(Cobro::count())->toBe(1)
        ->and(Cobro::first()->empresa_id)->toBe($this->empresaA->id);
});

it('Gasto: incluye gastos sin vehiculo (globales) Y los del vehículo de la empresa activa', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '20000006',
    ]);

    $gastoGlobal = Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 50000,
        'recibio' => 'Juan',
        'metodo_pago' => 'efectivo',
        'tipo' => 'galpon',
        'user_id' => $admin->id,
    ]);
    $gastoVehA = Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 30000,
        'recibio' => 'Juan',
        'metodo_pago' => 'efectivo',
        'tipo' => 'vehiculo',
        'vehiculo_id' => $this->vehA->id,
        'user_id' => $admin->id,
    ]);
    $gastoVehB = Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 20000,
        'recibio' => 'Juan',
        'metodo_pago' => 'efectivo',
        'tipo' => 'vehiculo',
        'vehiculo_id' => $this->vehB->id,
        'user_id' => $admin->id,
    ]);

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    $gastos = Gasto::pluck('id')->sort()->values()->all();
    expect($gastos)->toBe([$gastoGlobal->id, $gastoVehA->id]);
});

it('Gasto: withoutGlobalScope devuelve todos los gastos cross-tenant', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '20000007',
    ]);

    Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 100,
        'recibio' => 'X',
        'metodo_pago' => 'efectivo',
        'tipo' => 'vehiculo',
        'vehiculo_id' => $this->vehA->id,
        'user_id' => $admin->id,
    ]);
    Gasto::create([
        'fecha' => now()->toDateString(),
        'monto' => 200,
        'recibio' => 'Y',
        'metodo_pago' => 'efectivo',
        'tipo' => 'vehiculo',
        'vehiculo_id' => $this->vehB->id,
        'user_id' => $admin->id,
    ]);

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    expect(Gasto::count())->toBe(1)
        ->and(Gasto::withoutGlobalScope(GastoTenantScope::class)->count())->toBe(2);
});

it('TenantScope: no-op cuando no hay sesión (CLI/queue context)', function () {
    // Sin acting-as ni session: el scope no aplica.
    expect(Vehiculo::count())->toBe(2)
        ->and(Inversion::count())->toBe(2);
});

it('Inversor: solo ve datos de su empresa porque SetActiveCompany lo fuerza', function () {
    $inversor = User::factory()->create([
        'role' => UserRole::INVERSOR,
        'dni' => '20000008',
        'empresa_default_id' => $this->empresaB->id,
    ]);
    $inversor->empresas()->sync([$this->empresaB->id]);

    $this->actingAs($inversor);

    // Aunque maliciosamente intente setear la otra empresa, el middleware la reemplaza
    // en la siguiente request. En este test simulamos directamente la sesión post-middleware.
    session(['active_company_id' => $this->empresaB->id]);

    expect(Vehiculo::pluck('patente')->all())->toBe(['BBB222']);
});

it('Cierres (Inversion/Caja): filtran por empresa activa y aislan cálculos', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '20000099',
    ]);

    // Cierre en empresa A.
    $cierreInvA = \App\Models\CierreInversion::create([
        'empresa_id' => $this->empresaA->id,
        'ejecutado_por' => $admin->id,
        'periodo_inicio' => now()->subWeek(),
        'periodo_fin' => now(),
        'total_recaudado' => 1000,
        'total_distribuido' => 1000,
    ]);

    // Cierre en empresa B.
    $cierreInvB = \App\Models\CierreInversion::create([
        'empresa_id' => $this->empresaB->id,
        'ejecutado_por' => $admin->id,
        'periodo_inicio' => now()->subWeek(),
        'periodo_fin' => now(),
        'total_recaudado' => 2000,
        'total_distribuido' => 2000,
    ]);

    \App\Models\CierreCaja::create(['empresa_id' => $this->empresaA->id, 'user_id' => $admin->id]);
    \App\Models\CierreCaja::create(['empresa_id' => $this->empresaB->id, 'user_id' => $admin->id]);

    $this->actingAs($admin);

    // En empresa A: sólo veo los cierres de A.
    session(['active_company_id' => $this->empresaA->id]);
    expect(\App\Models\CierreInversion::count())->toBe(1)
        ->and(\App\Models\CierreInversion::first()->id)->toBe($cierreInvA->id)
        ->and(\App\Models\CierreCaja::count())->toBe(1);

    // En empresa B: sólo veo los de B. El "último cierre" cambia.
    session(['active_company_id' => $this->empresaB->id]);
    expect(\App\Models\CierreInversion::count())->toBe(1)
        ->and(\App\Models\CierreInversion::latest('periodo_fin')->first()->id)->toBe($cierreInvB->id);

    // withoutGlobalScope expone ambos.
    expect(\App\Models\CierreInversion::withoutGlobalScope(TenantScope::class)->count())->toBe(2);
});

it('ProcessCierreInversionAction asigna empresa_id desde la sesión', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '20000098',
    ]);

    // Construyo 1 inversión con 6 inversores en empresa B.
    $inv = $this->invB;
    for ($i = 1; $i <= 6; $i++) {
        $inv->inversores()->attach(
            User::factory()->create([
                'role' => UserRole::INVERSOR,
                'dni' => '209000'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
            ])->id,
            ['tiene_deuda' => false, 'es_financiador' => false],
        );
    }

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaB->id]);

    $action = new \App\Actions\ProcessCierreInversionAction;
    $cierre = $action->execute([$inv->id => 1200], $admin, 100.0);

    expect($cierre->empresa_id)->toBe($this->empresaB->id);
});

it('ProcessCierreInversionAction acepta menos de 6 inversores y divide por la cantidad real', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '21000001',
    ]);

    // Inversión con sólo 3 inversores (sin deudores).
    $inv = $this->invA;
    $inversores = [];
    for ($i = 1; $i <= 3; $i++) {
        $u = User::factory()->create([
            'role' => UserRole::INVERSOR,
            'dni' => '21000'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
        ]);
        $u->empresas()->sync([$this->empresaA->id]);
        $inv->inversores()->attach($u->id, ['tiene_deuda' => false, 'es_financiador' => false]);
        $inversores[] = $u;
    }

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    $action = new \App\Actions\ProcessCierreInversionAction;
    $cierre = $action->execute([$inv->id => 1200], $admin, null);

    // Cada uno recibe 1200 / 3 = 400 (no 1200 / 6 = 200).
    $pagos = \App\Models\CierreInversionPago::where('cierre_id', $cierre->id)->get();
    expect($pagos)->toHaveCount(3);
    foreach ($pagos as $p) {
        expect((float) $p->monto)->toBe(400.0);
    }

    expect((float) $cierre->total_recaudado)->toBe(1200.0)
        ->and((float) $cierre->total_distribuido)->toBe(1200.0);
});

it('ProcessCierreInversionAction saltea inversiones sin inversores (registra recaudación, no genera pagos)', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '21000099',
    ]);

    $invSinInversores = $this->invA;

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    $action = new \App\Actions\ProcessCierreInversionAction;
    $cierre = $action->execute([$invSinInversores->id => 500], $admin, null);

    // La recaudación queda registrada.
    $recaudaciones = \App\Models\CierreInversionRecaudacion::where('cierre_id', $cierre->id)->get();
    expect($recaudaciones)->toHaveCount(1)
        ->and((float) $recaudaciones->first()->monto)->toBe(500.0);

    // Pero no se generan pagos.
    expect(\App\Models\CierreInversionPago::where('cierre_id', $cierre->id)->count())->toBe(0);

    // El total_recaudado refleja la recaudación, pero total_distribuido es 0.
    expect((float) $cierre->total_recaudado)->toBe(500.0)
        ->and((float) $cierre->total_distribuido)->toBe(0.0);
});

it('ProcessCierreInversionAction sigue rechazando más de 6 inversores en una inversión', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '21000100',
    ]);

    // Esto no debería ocurrir normalmente (attachInversor lo bloquea), pero
    // testeamos defense-in-depth.
    $inv = $this->invA;
    for ($i = 0; $i < 7; $i++) {
        $u = User::factory()->create([
            'role' => UserRole::INVERSOR,
            'dni' => '21500'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
        ]);
        $u->empresas()->sync([$this->empresaA->id]);
        $inv->inversores()->attach($u->id, ['tiene_deuda' => false, 'es_financiador' => false]);
    }

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    $action = new \App\Actions\ProcessCierreInversionAction;

    expect(fn () => $action->execute([$inv->id => 600], $admin, null))
        ->toThrow(\RuntimeException::class, 'el máximo permitido es 6');
});

it('Revisiones es GLOBAL: el panel y el cierre abarcan carros de todas las empresas', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '22000001',
    ]);

    // Asigno conductores a vehA (empresaA) y vehB (empresaB).
    $choferA = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '22000010']);
    $choferB = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '22000011']);
    $this->vehA->update(['user_id' => $choferA->id]);
    $this->vehB->update(['user_id' => $choferB->id]);

    $this->actingAs($admin);
    session(['active_company_id' => $this->empresaA->id]);

    // El panel de revisiones muestra AMBOS carros, no sólo el de la empresa activa.
    $this->get('/revisiones')->assertInertia(fn ($p) => $p->has('vehiculos', 2));

    // El cierre abarca ambos carros (CierreRevision NO es scopeado).
    $action = new \App\Actions\CerrarRevisionesAction;
    $cierre = $action->execute($admin);

    expect($cierre->detalles()->count())->toBe(2);

    // Visible desde la otra empresa también (global).
    session(['active_company_id' => $this->empresaB->id]);
    expect(\App\Models\CierreRevision::count())->toBe(1);
});

it('Desactivar chofer desasigna sus vehículos en TODAS las empresas, no sólo la activa', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '22000050',
    ]);

    // Chofer con un vehículo en cada empresa.
    $chofer = User::factory()->create(['role' => UserRole::CHOFER, 'dni' => '22000051']);
    $this->vehA->update(['user_id' => $chofer->id]);
    $this->vehB->update(['user_id' => $chofer->id]);

    $this->actingAs($admin);
    // Empresa activa = A, pero el chofer también tiene el carro de B.
    session(['active_company_id' => $this->empresaA->id]);

    $this->patch("/users/{$chofer->id}/toggle-status")->assertRedirect();

    // Ambos vehículos quedan desasignados, sin importar la empresa activa.
    $this->vehA->refresh();
    $this->vehB->refresh();
    expect($this->vehA->user_id)->toBeNull()
        ->and($this->vehB->user_id)->toBeNull();
});

it('Inventario es GLOBAL: egreso a un carro de otra empresa enruta el cobro a la empresa del carro', function () {
    $admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '22000002',
    ]);

    $articulo = \App\Models\Articulo::create([
        'descripcion' => 'Filtro',
        'stock' => 10,
        'min_stock' => 1,
        'precio' => 500,
        'repuestos' => true, // se factura al vehículo (genera cobro)
    ]);

    $this->actingAs($admin);
    // Estoy en empresa A pero despacho al carro de empresa B.
    session(['active_company_id' => $this->empresaA->id]);

    $action = new \App\Actions\ProcessStockMovementAction;
    $action->execute($articulo, 'OUT', 2, $this->vehB->patente, 'Taller');

    // El cobro se generó y quedó asignado a la empresa del carro (B), no a la activa (A).
    $cobro = Cobro::withoutGlobalScope(TenantScope::class)->first();
    expect($cobro)->not->toBeNull()
        ->and($cobro->empresa_id)->toBe($this->empresaB->id)
        ->and($cobro->inversion_id)->toBe($this->invB->id);
});
