<?php

declare(strict_types=1);

use App\Actions\ProcessCierreUnificadoAction;
use App\Actions\RecalcularSueldosAction;
use App\Enums\UserRole;
use App\Models\AperturaRecaudacion;
use App\Models\CierreRecaudacion;
use App\Models\CierreSueldo;
use App\Models\CierreSueldoAbono;
use App\Models\CierreSueldoPago;
use App\Models\CierreSueldoSocio;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Recaudacion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa1 = Empresa::create(['nombre' => 'EMP_1']);
    $this->empresa2 = Empresa::create(['nombre' => 'EMP_2']);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '10000001',
    ]);

    $this->action = new ProcessCierreUnificadoAction;
});

/** @return array<int, User> */
function unificadoInversores(int $count, string $prefix = '2'): array
{
    $users = [];
    for ($i = 0; $i < $count; $i++) {
        $users[] = User::factory()->create([
            'role' => UserRole::INVERSOR,
            'dni' => $prefix.str_pad((string) $i, 7, '0', STR_PAD_LEFT),
            'name' => 'Inversor '.$prefix.'-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
        ]);
    }

    return $users;
}

/** @param array<int, array{es_financiador?: bool, deuda?: float}> $flags */
function unificadoInversion(string $nombre, Empresa $empresa, array $inversores, array $flags = []): Inversion
{
    $inv = Inversion::create(['nombre' => $nombre, 'empresa_id' => $empresa->id]);
    foreach ($inversores as $idx => $u) {
        $inv->inversores()->attach($u->id, [
            'es_financiador' => $flags[$idx]['es_financiador'] ?? false,
            'deuda' => $flags[$idx]['deuda'] ?? 0,
        ]);
    }

    return $inv;
}

function unificadoApertura(Empresa $empresa, User $admin, array $recaudadoPorInversion = []): AperturaRecaudacion
{
    $apertura = AperturaRecaudacion::withoutGlobalScopes()->create([
        'empresa_id' => $empresa->id,
        'user_id' => $admin->id,
    ]);

    foreach ($recaudadoPorInversion as $inversionId => $monto) {
        $vehiculo = Vehiculo::withoutGlobalScopes()->create([
            'inversion_id' => $inversionId,
            'empresa_id' => $empresa->id,
            'patente' => 'T'.str_pad((string) random_int(0, 99999), 5, '0', STR_PAD_LEFT),
            'marca' => 'Test', 'modelo' => 'Test', 'anio' => '2020',
        ]);

        Recaudacion::withoutGlobalScopes()->create([
            'vehiculo_id' => $vehiculo->id,
            'empresa_id' => $empresa->id,
            'apertura_id' => $apertura->id,
            'efectivo' => $monto, 'transferencia' => 0, 'total' => $monto,
            'descuento' => 0, 'precio' => $monto,
        ]);
    }

    return $apertura;
}

function unificadoDeuda(Inversion $inv, User $u): float
{
    return (float) DB::table('inversion_user')
        ->where('inversion_id', $inv->id)->where('user_id', $u->id)->value('deuda');
}

/** Cambia la decisión de un socio (abona/no + abono) y recalcula, como el endpoint. */
function unificadoDecidir(CierreSueldo $cierre, User $u, bool $abona, ?float $abonoMonto = null): void
{
    CierreSueldoSocio::where('cierre_sueldo_id', $cierre->id)->where('user_id', $u->id)
        ->update(['abona' => $abona, 'abono_monto' => $abona ? ($abonoMonto ?? 0) : 0]);

    app(RecalcularSueldosAction::class)->execute($cierre->fresh());
}

// ─── Pre-condiciones ───────────────────────────────────────────────────────

it('rechaza el cierre si alguna empresa no tiene apertura abierta', function () {
    unificadoApertura($this->empresa1, $this->admin);

    expect(fn () => $this->action->execute(1000, $this->admin))
        ->toThrow(RuntimeException::class, 'EMP_2');
});

it('rechaza el cierre si una inversión supera MAX_INVERSORES', function () {
    $invs = unificadoInversores(7);
    unificadoInversion('EXC', $this->empresa1, $invs);

    unificadoApertura($this->empresa1, $this->admin);
    unificadoApertura($this->empresa2, $this->admin);

    expect(fn () => $this->action->execute(1000, $this->admin))
        ->toThrow(RuntimeException::class, 'el máximo permitido es '.Inversion::MAX_INVERSORES);
});

it('rechaza el cierre si una inversión tiene deudores pero no financiadores', function () {
    $invs = unificadoInversores(3);
    unificadoInversion('SINFIN', $this->empresa1, $invs, [0 => ['deuda' => 100]]);

    unificadoApertura($this->empresa1, $this->admin);
    unificadoApertura($this->empresa2, $this->admin);

    expect(fn () => $this->action->execute(1000, $this->admin))
        ->toThrow(RuntimeException::class, 'deudores pero no financiadores');
});

it('rechaza el cierre si un vehículo apunta a una inversión de otra empresa', function () {
    $invs = unificadoInversores(2);
    $inv = unificadoInversion('INV_1', $this->empresa1, $invs);

    unificadoApertura($this->empresa1, $this->admin);
    $apertura2 = unificadoApertura($this->empresa2, $this->admin);

    $vehiculo = Vehiculo::withoutGlobalScopes()->create([
        'inversion_id' => $inv->id, 'empresa_id' => $this->empresa2->id,
        'patente' => 'CRUZA1', 'marca' => 'Test', 'modelo' => 'Test', 'anio' => '2020',
    ]);
    Recaudacion::withoutGlobalScopes()->create([
        'vehiculo_id' => $vehiculo->id, 'empresa_id' => $this->empresa2->id,
        'apertura_id' => $apertura2->id, 'efectivo' => 100, 'transferencia' => 0,
        'total' => 100, 'descuento' => 0, 'precio' => 100,
    ]);

    expect(fn () => $this->action->execute(1000, $this->admin))
        ->toThrow(RuntimeException::class, 'CRUZA1');

    expect(AperturaRecaudacion::withoutGlobalScopes()->whereNull('cierre_id')->count())->toBe(2)
        ->and(CierreSueldo::count())->toBe(0);
});

// ─── Cierre base ───────────────────────────────────────────────────────────

it('congela las recaudaciones de ambas empresas y las vincula al cierre de sueldos', function () {
    $invs = unificadoInversores(2);
    $inv1 = unificadoInversion('INV_1', $this->empresa1, [$invs[0]]);
    $inv2 = unificadoInversion('INV_2', $this->empresa2, [$invs[1]]);

    $ap1 = unificadoApertura($this->empresa1, $this->admin, [$inv1->id => 600]);
    $ap2 = unificadoApertura($this->empresa2, $this->admin, [$inv2->id => 400]);

    $cierre = $this->action->execute(1450.5, $this->admin);

    expect($cierre)->toBeInstanceOf(CierreSueldo::class)
        ->and((float) $cierre->tasa)->toBe(1450.5)
        ->and($cierre->ejecutado_por)->toBe($this->admin->id);

    $cierresRec = CierreRecaudacion::withoutGlobalScopes()->where('cierre_sueldo_id', $cierre->id)->get();
    expect($cierresRec)->toHaveCount(2)
        ->and($cierresRec->pluck('empresa_id')->sort()->values()->all())
        ->toBe([$this->empresa1->id, $this->empresa2->id]);

    expect(AperturaRecaudacion::withoutGlobalScopes()->whereNull('cierre_id')->count())->toBe(0)
        ->and(Recaudacion::withoutGlobalScopes()->whereNull('cierre_id')->count())->toBe(0);

    expect($ap1->fresh()->cierre_id)->not->toBeNull()
        ->and($ap2->fresh()->cierre_id)->not->toBeNull();
});

it('reparte la parte completa cuando no hay deudores', function () {
    $invs = unificadoInversores(3);
    $inv = unificadoInversion('INV_1', $this->empresa1, $invs);

    unificadoApertura($this->empresa1, $this->admin, [$inv->id => 600]);
    unificadoApertura($this->empresa2, $this->admin);

    $cierre = $this->action->execute(1000, $this->admin);

    $pagos = CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)->get();
    expect($pagos)->toHaveCount(3);
    foreach ($pagos as $p) {
        expect((float) $p->monto)->toBe(200.0)
            ->and($p->concepto)->toBe(CierreSueldoPago::CONCEPTO_PARTE_COMPLETA);
    }
    // Sin deudores no hay decisiones por socio.
    expect(CierreSueldoSocio::where('cierre_sueldo_id', $cierre->id)->count())->toBe(0);
});

it('saltea inversiones sin recaudación o sin inversores', function () {
    $invs = unificadoInversores(2);
    $conInversores = unificadoInversion('INV_1', $this->empresa1, $invs);
    $sinInversores = unificadoInversion('INV_2', $this->empresa1, []);

    unificadoApertura($this->empresa1, $this->admin, [
        $conInversores->id => 0, $sinInversores->id => 500,
    ]);
    unificadoApertura($this->empresa2, $this->admin);

    $cierre = $this->action->execute(1000, $this->admin);

    expect(CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)->count())->toBe(0);
});

// ─── Nueva dinámica: creación "como si todos abonaran" ──────────────────────

it('al crear, el deudor cobra media parte (como si abonara) y su abono baja la deuda por el sueldo generado', function () {
    [$deudor, $financiador, $normal] = unificadoInversores(3);

    $inv = unificadoInversion('INV_1', $this->empresa1, [$deudor, $financiador, $normal], [
        0 => ['deuda' => 500], 1 => ['es_financiador' => true],
    ]);

    unificadoApertura($this->empresa1, $this->admin, [$inv->id => 600]);
    unificadoApertura($this->empresa2, $this->admin);

    $cierre = $this->action->execute(1000, $this->admin);

    $pagos = CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)->get()->keyBy('user_id');

    // Parte = 200. Deudor por defecto abona → media parte 100.
    expect((float) $pagos[$deudor->id]->monto)->toBe(100.0)
        ->and($pagos[$deudor->id]->concepto)->toBe(CierreSueldoPago::CONCEPTO_MEDIA_PARTE_DEUDOR)
        ->and((float) $pagos[$normal->id]->monto)->toBe(200.0);

    expect((float) CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)
        ->where('user_id', $financiador->id)->sum('monto'))->toBe(300.0);

    // El abono se presetea al sueldo generado (100) y baja la deuda.
    $socio = CierreSueldoSocio::where('cierre_sueldo_id', $cierre->id)->where('user_id', $deudor->id)->first();
    expect((float) $socio->abono_monto)->toBe(100.0)
        ->and($socio->abona)->toBeTrue()
        ->and(unificadoDeuda($inv, $deudor))->toBe(400.0);

    expect((float) CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)->sum('monto'))->toBe(600.0);
});

it('marcar No abona pone el sueldo en cero, redistribuye al financiador y revierte el abono', function () {
    [$deudor, $financiador, $normal] = unificadoInversores(3);

    $inv = unificadoInversion('INV_1', $this->empresa1, [$deudor, $financiador, $normal], [
        0 => ['deuda' => 500], 1 => ['es_financiador' => true],
    ]);

    unificadoApertura($this->empresa1, $this->admin, [$inv->id => 600]);
    unificadoApertura($this->empresa2, $this->admin);

    $cierre = $this->action->execute(1000, $this->admin);

    // Toggle a NO abona.
    unificadoDecidir($cierre, $deudor, false);

    $pagos = CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)->get();
    $pagoDeudor = $pagos->firstWhere('user_id', $deudor->id);
    expect((float) $pagoDeudor->monto)->toBe(0.0)
        ->and($pagoDeudor->concepto)->toBe(CierreSueldoPago::CONCEPTO_CERO_DEUDOR);

    // Financiador: 200 propios + 200 cedidos = 400.
    expect((float) $pagos->where('user_id', $financiador->id)->sum(fn ($p) => (float) $p->monto))->toBe(400.0);

    // El abono se revierte: la deuda vuelve a 500 y no quedan abonos.
    expect(unificadoDeuda($inv, $deudor))->toBe(500.0)
        ->and(CierreSueldoAbono::where('cierre_sueldo_id', $cierre->id)->count())->toBe(0);
});

it('volver a Abona recalcula como si nunca se hubiera tocado No abona', function () {
    [$deudor, $financiador, $normal] = unificadoInversores(3);

    $inv = unificadoInversion('INV_1', $this->empresa1, [$deudor, $financiador, $normal], [
        0 => ['deuda' => 500], 1 => ['es_financiador' => true],
    ]);

    unificadoApertura($this->empresa1, $this->admin, [$inv->id => 600]);
    unificadoApertura($this->empresa2, $this->admin);

    $cierre = $this->action->execute(1000, $this->admin);

    unificadoDecidir($cierre, $deudor, false);
    unificadoDecidir($cierre, $deudor, true, 100); // vuelve con el sueldo generado

    $pagos = CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)->get()->keyBy('user_id');
    expect((float) $pagos[$deudor->id]->monto)->toBe(100.0)
        ->and($pagos[$deudor->id]->concepto)->toBe(CierreSueldoPago::CONCEPTO_MEDIA_PARTE_DEUDOR)
        ->and(unificadoDeuda($inv, $deudor))->toBe(400.0);
});

it('el abono es editable hacia arriba y baja más deuda, con tope en el saldo', function () {
    [$deudor, $financiador] = unificadoInversores(2);

    $inv = unificadoInversion('INV_1', $this->empresa1, [$deudor, $financiador], [
        0 => ['deuda' => 500], 1 => ['es_financiador' => true],
    ]);

    unificadoApertura($this->empresa1, $this->admin, [$inv->id => 600]);
    unificadoApertura($this->empresa2, $this->admin);

    $cierre = $this->action->execute(1000, $this->admin);

    // Paga más que el sueldo generado: 300 (tope en 500 → baja a 200).
    unificadoDecidir($cierre, $deudor, true, 300);
    expect(unificadoDeuda($inv, $deudor))->toBe(200.0);

    // Paga más que la deuda: se topea en 200 restante (deuda a 0).
    unificadoDecidir($cierre, $deudor, true, 9999);
    expect(unificadoDeuda($inv, $deudor))->toBe(0.0);
});

it('deudor en 3ra posición del ranking cobra cero aunque abone', function () {
    [$deudor, $financiador] = unificadoInversores(2);

    $inv1 = unificadoInversion('INV_1', $this->empresa1, [$deudor, $financiador], [0 => ['deuda' => 100], 1 => ['es_financiador' => true]]);
    $inv2 = unificadoInversion('INV_2', $this->empresa1, [$deudor, $financiador], [0 => ['deuda' => 100], 1 => ['es_financiador' => true]]);
    $inv3 = unificadoInversion('INV_3', $this->empresa1, [$deudor, $financiador], [0 => ['deuda' => 100], 1 => ['es_financiador' => true]]);

    unificadoApertura($this->empresa1, $this->admin, [$inv1->id => 200, $inv2->id => 200, $inv3->id => 200]);
    unificadoApertura($this->empresa2, $this->admin);

    $cierre = $this->action->execute(1000, $this->admin); // por defecto abona

    $pagosDeudor = CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)
        ->where('user_id', $deudor->id)->get()->keyBy('inversion_id');

    expect((float) $pagosDeudor[$inv1->id]->monto)->toBe(50.0)
        ->and((float) $pagosDeudor[$inv2->id]->monto)->toBe(50.0)
        ->and((float) $pagosDeudor[$inv3->id]->monto)->toBe(0.0)
        ->and($pagosDeudor[$inv3->id]->concepto)->toBe(CierreSueldoPago::CONCEPTO_CERO_DEUDOR);
});

it('calcula el ranking por empresa por separado', function () {
    [$deudor, $financiador] = unificadoInversores(2);

    $inv1 = unificadoInversion('INV_1', $this->empresa1, [$deudor, $financiador], [0 => ['deuda' => 100], 1 => ['es_financiador' => true]]);
    $inv2 = unificadoInversion('INV_2', $this->empresa1, [$deudor, $financiador], [0 => ['deuda' => 100], 1 => ['es_financiador' => true]]);
    $inv3 = unificadoInversion('INV_9', $this->empresa2, [$deudor, $financiador], [0 => ['deuda' => 100], 1 => ['es_financiador' => true]]);

    unificadoApertura($this->empresa1, $this->admin, [$inv1->id => 200, $inv2->id => 200]);
    unificadoApertura($this->empresa2, $this->admin, [$inv3->id => 200]);

    $cierre = $this->action->execute(1000, $this->admin);

    $pagoEmpresa2 = CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)
        ->where('user_id', $deudor->id)->where('inversion_id', $inv3->id)->first();

    expect((float) $pagoEmpresa2->monto)->toBe(50.0)
        ->and($pagoEmpresa2->concepto)->toBe(CierreSueldoPago::CONCEPTO_MEDIA_PARTE_DEUDOR)
        ->and($pagoEmpresa2->empresa_id)->toBe($this->empresa2->id);
});

it('ajusta los redondeos para que la suma cuadre exacta con lo recaudado', function () {
    $invs = unificadoInversores(3);
    $inv = unificadoInversion('INV_1', $this->empresa1, $invs);

    unificadoApertura($this->empresa1, $this->admin, [$inv->id => 100]);
    unificadoApertura($this->empresa2, $this->admin);

    $cierre = $this->action->execute(1000, $this->admin);

    $pagos = CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)->get();
    expect(round((float) $pagos->sum(fn ($p) => (float) $p->monto), 2))->toBe(100.0);
});

// ─── Endpoints ─────────────────────────────────────────────────────────────

it('el endpoint del cierre unificado ejecuta y redirige al detalle del cierre', function () {
    $invs = unificadoInversores(2);
    $inv = unificadoInversion('INV_1', $this->empresa1, $invs);

    unificadoApertura($this->empresa1, $this->admin, [$inv->id => 600]);
    unificadoApertura($this->empresa2, $this->admin);

    $response = $this->actingAs($this->admin)->post('/recaudaciones/cierre', ['tasa' => 1450]);

    $cierre = CierreSueldo::latest('id')->first();
    expect($cierre)->not->toBeNull();
    $response->assertRedirect('/cierres-sueldo/'.$cierre->id);
});

it('el endpoint devuelve error flash si falta una apertura', function () {
    unificadoApertura($this->empresa1, $this->admin);

    $response = $this->actingAs($this->admin)->post('/recaudaciones/cierre', ['tasa' => 1450]);

    $response->assertSessionHas('error');
    expect(CierreSueldo::count())->toBe(0);
});

it('el endpoint de socio actualiza la decisión y recalcula', function () {
    [$deudor, $financiador, $normal] = unificadoInversores(3);
    $inv = unificadoInversion('INV_1', $this->empresa1, [$deudor, $financiador, $normal], [
        0 => ['deuda' => 500], 1 => ['es_financiador' => true],
    ]);
    unificadoApertura($this->empresa1, $this->admin, [$inv->id => 600]);
    unificadoApertura($this->empresa2, $this->admin);

    $cierre = $this->action->execute(1000, $this->admin);

    $this->actingAs($this->admin)
        ->patch("/cierres-sueldo/{$cierre->id}/socios/{$deudor->id}", ['abona' => false])
        ->assertRedirect();

    $pagoDeudor = CierreSueldoPago::where('cierre_sueldo_id', $cierre->id)->where('user_id', $deudor->id)->first();
    expect((float) $pagoDeudor->monto)->toBe(0.0)
        ->and(unificadoDeuda($inv, $deudor))->toBe(500.0);
});

it('el detalle del cierre muestra el recaudado de AMBAS empresas aunque haya una empresa activa en sesión', function () {
    $invs = unificadoInversores(2);
    $inv1 = unificadoInversion('INV_1', $this->empresa1, [$invs[0]]);
    $inv2 = unificadoInversion('INV_9', $this->empresa2, [$invs[1]]);

    unificadoApertura($this->empresa1, $this->admin, [$inv1->id => 600]);
    unificadoApertura($this->empresa2, $this->admin, [$inv2->id => 400]);

    $cierre = $this->action->execute(1000, $this->admin);

    $this->actingAs($this->admin)
        ->withSession(['active_company_id' => $this->empresa1->id])
        ->get('/cierres-sueldo/'.$cierre->id)
        ->assertOk()
        ->assertInertia(fn ($p) => $p
            ->component('CierresSueldo/Show')
            ->where('empresas.0.recaudado', 600)
            ->where('empresas.1.recaudado', 400)
            ->where('totales.recaudado', 1000)
        );
});

it('las vistas de cierres de sueldo requieren rol administrador', function () {
    $administrativo = User::factory()->create(['role' => UserRole::ADMINISTRATIVO, 'dni' => '10000002']);

    $this->actingAs($administrativo)->get('/cierres-sueldo')->assertForbidden();
    $this->actingAs($this->admin)->get('/cierres-sueldo')->assertOk();
});
