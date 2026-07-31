<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\AperturaRecaudacion;
use App\Models\Articulo;
use App\Models\CierreRecaudacion;
use App\Models\Cobro;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Inversion;
use App\Models\Recaudacion;
use App\Models\Setting;
use App\Models\Transaccion;
use App\Models\User;
use App\Models\Vehiculo;
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

it('mi cuenta totaliza autos y recaudación del período abierto por inversión', function () {
    Setting::set('cotizacion_dolar', '1000');

    $socio = moduloInversor('20000009');
    $inv = Inversion::create(['nombre' => 'INV_R', 'empresa_id' => $this->empresa->id]);
    $inv->inversores()->attach($socio->id, ['es_financiador' => false, 'deuda' => 0]);

    $apertura = AperturaRecaudacion::withoutGlobalScopes()->create([
        'empresa_id' => $this->empresa->id,
        'user_id' => $this->admin->id,
    ]);

    // Dos autos reales de la inversión con recaudación en el período abierto.
    foreach ([500, 300] as $i => $monto) {
        $veh = Vehiculo::withoutGlobalScopes()->create([
            'inversion_id' => $inv->id,
            'empresa_id' => $this->empresa->id,
            'patente' => "REAL_{$i}",
            'marca' => 'Test', 'modelo' => 'Test', 'anio' => '2020',
        ]);
        Recaudacion::withoutGlobalScopes()->create([
            'vehiculo_id' => $veh->id, 'empresa_id' => $this->empresa->id,
            'apertura_id' => $apertura->id, 'efectivo' => $monto, 'transferencia' => 0,
            'total' => $monto, 'descuento' => 0, 'precio' => $monto,
        ]);
    }

    // El vehículo ficticio EXTERNO no cuenta como auto ni suma su recaudación.
    $externo = Vehiculo::withoutGlobalScopes()->create([
        'inversion_id' => $inv->id, 'empresa_id' => $this->empresa->id,
        'patente' => 'EXTERNO', 'marca' => 'Test', 'modelo' => 'Test', 'anio' => '2020',
    ]);
    Recaudacion::withoutGlobalScopes()->create([
        'vehiculo_id' => $externo->id, 'empresa_id' => $this->empresa->id,
        'apertura_id' => $apertura->id, 'efectivo' => 999, 'transferencia' => 0,
        'total' => 999, 'descuento' => 0, 'precio' => 999,
    ]);

    // Recaudación ya cerrada (otro período): no debe sumar al total abierto.
    $cierre = CierreRecaudacion::withoutGlobalScopes()->create([
        'empresa_id' => $this->empresa->id, 'user_id' => $this->admin->id,
    ]);
    $vehCerrado = Vehiculo::withoutGlobalScopes()->create([
        'inversion_id' => $inv->id, 'empresa_id' => $this->empresa->id,
        'patente' => 'CERR_1', 'marca' => 'Test', 'modelo' => 'Test', 'anio' => '2020',
    ]);
    Recaudacion::withoutGlobalScopes()->create([
        'vehiculo_id' => $vehCerrado->id, 'empresa_id' => $this->empresa->id,
        'apertura_id' => $apertura->id, 'cierre_id' => $cierre->id,
        'efectivo' => 700, 'transferencia' => 0, 'total' => 700, 'descuento' => 0, 'precio' => 700,
    ]);

    $this->actingAs($socio)
        ->get('/mi-cuenta')
        ->assertOk()
        ->assertInertia(fn ($p) => $p
            ->component('MiCuenta/Index')
            ->where('cotizacionDolar', 1000)
            ->has('inversiones', 1)
            ->where('inversiones.0.nombre', 'INV_R')
            // 3 autos reales creados (2 abiertos + 1 cerrado); EXTERNO excluido.
            ->where('inversiones.0.autos', 3)
            // Sólo período abierto y sin EXTERNO: 500 + 300 = 800.
            ->where('inversiones.0.recaudado', 800)
        );
});

it('mi cuenta arma los gastos del período: flota de sus inversiones y globales con su parte', function () {
    Setting::set('cotizacion_dolar', '1000');

    $socio = moduloInversor('20000010');
    $otro = moduloInversor('20000011');

    $inv = Inversion::create(['nombre' => 'INV_G', 'empresa_id' => $this->empresa->id]);
    $inv->inversores()->attach($socio->id, ['es_financiador' => false, 'deuda' => 0]);

    $veh = Vehiculo::withoutGlobalScopes()->create([
        'inversion_id' => $inv->id, 'empresa_id' => $this->empresa->id,
        'patente' => 'GAS_1', 'marca' => 'Test', 'modelo' => 'Test', 'anio' => '2020',
    ]);

    // Gasto de flota de su inversión: monto completo al total, mitad le toca.
    Gasto::create([
        'fecha' => now()->toDateString(), 'monto' => 400,
        'user_id' => $this->admin->id, 'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo', 'tipo' => 'vehiculo',
        'vehiculo_id' => $veh->id,
        'distribucion' => [$socio->id => 200, $otro->id => 200],
    ]);

    // Gasto global (galpón): monto completo al total, sólo su parte en mi_parte.
    Gasto::create([
        'fecha' => now()->toDateString(), 'monto' => 1000,
        'user_id' => $this->admin->id, 'recibio' => 'Galpón',
        'metodo_pago' => 'efectivo', 'tipo' => 'galpon',
        'vehiculo_id' => null,
        'distribucion' => [$socio->id => 100, $otro->id => 900],
    ]);

    // Gasto de flota de una inversión ajena: no debe aparecer.
    $invAjena = Inversion::create(['nombre' => 'INV_AJENA', 'empresa_id' => $this->empresa->id]);
    $vehAjeno = Vehiculo::withoutGlobalScopes()->create([
        'inversion_id' => $invAjena->id, 'empresa_id' => $this->empresa->id,
        'patente' => 'AJENO_1', 'marca' => 'Test', 'modelo' => 'Test', 'anio' => '2020',
    ]);
    Gasto::create([
        'fecha' => now()->toDateString(), 'monto' => 555,
        'user_id' => $this->admin->id, 'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo', 'tipo' => 'vehiculo',
        'vehiculo_id' => $vehAjeno->id,
        'distribucion' => [$otro->id => 555],
    ]);

    $this->actingAs($socio)
        ->get('/mi-cuenta')
        ->assertOk()
        ->assertInertia(fn ($p) => $p
            ->component('MiCuenta/Index')
            // 400 flota propia + 1000 galpón; la flota ajena (555) no suma.
            ->where('gastos.total', 1400)
            ->where('gastos.globales.total', 1000)
            ->where('gastos.globales.mi_parte', 100)
            ->has('gastos.globales.items', 1)
            ->has('gastos.flota', 1)
            ->where('gastos.flota.0.inversion_id', $inv->id)
            ->where('gastos.flota.0.total', 400)
            ->where('gastos.flota.0.mi_parte', 200)
            ->has('gastos.flota.0.items', 1)
            ->where('gastos.flota.0.items.0.vehiculo', 'GAS_1 · Test Test')
        );
});

it('mi cuenta incluye los repuestos de inventario en la flota, con parte igualitaria', function () {
    $socio = moduloInversor('20000012');
    $otro = moduloInversor('20000013');

    // Inversión con DOS inversores: el repuesto se reparte en partes iguales.
    $inv = Inversion::create(['nombre' => 'INV_R', 'empresa_id' => $this->empresa->id]);
    $inv->inversores()->attach($socio->id, ['es_financiador' => false, 'deuda' => 0]);
    $inv->inversores()->attach($otro->id, ['es_financiador' => false, 'deuda' => 0]);

    $veh = Vehiculo::withoutGlobalScopes()->create([
        'inversion_id' => $inv->id, 'empresa_id' => $this->empresa->id,
        'patente' => 'REP_1', 'marca' => 'Test', 'modelo' => 'Test', 'anio' => '2020',
    ]);

    // Gasto de flota: su parte viene del reparto congelado.
    Gasto::create([
        'fecha' => now()->toDateString(), 'monto' => 400,
        'user_id' => $this->admin->id, 'recibio' => 'Proveedor',
        'metodo_pago' => 'efectivo', 'tipo' => 'vehiculo',
        'vehiculo_id' => $veh->id,
        'distribucion' => [$socio->id => 200, $otro->id => 200],
    ]);

    // Repuesto colocado al auto desde inventario: 2 × 300 = 600, valuado a
    // precio de venta. Sin cierre de caja previo → cuenta como del período.
    $articulo = Articulo::create([
        'descripcion' => 'Filtro de aceite', 'codigo' => 'FIL-1',
        'stock' => 10, 'min_stock' => 1, 'costo' => 200, 'precio' => 300,
    ]);
    $tx = Transaccion::create([
        'articulo_id' => $articulo->id, 'user_id' => $this->admin->id,
        'vehiculo_id' => $veh->id, 'solicitante' => 'Taller',
        'tipo' => 'OUT', 'cantidad' => 2, 'inactiva' => false,
    ]);
    Cobro::create([
        'inversion_id' => $inv->id, 'transaccion_id' => $tx->id,
        'empresa_id' => $this->empresa->id,
    ]);

    $this->actingAs($socio)
        ->get('/mi-cuenta')
        ->assertOk()
        ->assertInertia(fn ($p) => $p
            ->component('MiCuenta/Index')
            // 400 gasto + 600 repuesto (sin dividir).
            ->where('gastos.total', 1000)
            ->has('gastos.flota', 1)
            ->where('gastos.flota.0.total', 1000)
            // 200 (gasto, reparto) + 300 (repuesto 600 / 2 inversores).
            ->where('gastos.flota.0.mi_parte', 500)
            // Gasto + repuesto en el detalle; el repuesto va después.
            ->has('gastos.flota.0.items', 2)
            ->where('gastos.flota.0.items.1.tipo', 'repuesto')
            ->where('gastos.flota.0.items.1.monto', 600)
            ->where('gastos.flota.0.items.1.vehiculo', 'REP_1 · Test Test')
        );
});
