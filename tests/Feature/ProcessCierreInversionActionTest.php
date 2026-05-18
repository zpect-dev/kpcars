<?php

declare(strict_types=1);

use App\Actions\ProcessCierreInversionAction;
use App\Enums\UserRole;
use App\Models\CierreInversion;
use App\Models\CierreInversionPago;
use App\Models\Inversion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '10000001',
    ]);
    $this->action = new ProcessCierreInversionAction;
});

/**
 * Helper: crea N inversores con role=INVERSOR.
 *
 * @return array<int, User>
 */
function makeInversores(int $count, string $prefix = '2'): array
{
    $users = [];
    for ($i = 0; $i < $count; $i++) {
        $users[] = User::factory()->create([
            'role' => UserRole::INVERSOR,
            'dni' => $prefix.str_pad((string) $i, 7, '0', STR_PAD_LEFT),
        ]);
    }

    return $users;
}

/**
 * Helper: crea una inversión con 6 inversores y flags.
 *
 * @param  array<int, array{tiene_deuda?: bool, es_financiador?: bool}>  $flags  por índice de inversor
 */
function makeInversionWith6(string $nombre, array $inversores, array $flags = []): Inversion
{
    $inv = Inversion::create(['nombre' => $nombre]);
    foreach ($inversores as $idx => $u) {
        $inv->inversores()->attach($u->id, [
            'tiene_deuda' => $flags[$idx]['tiene_deuda'] ?? false,
            'es_financiador' => $flags[$idx]['es_financiador'] ?? false,
        ]);
    }

    return $inv;
}

// ─── Pre-condiciones ───────────────────────────────────────────────────────

it('rechaza el cierre si una inversion tiene menos de 6 inversores', function () {
    $invs = makeInversores(5);
    $inv = Inversion::create(['nombre' => 'Test']);
    foreach ($invs as $u) {
        $inv->inversores()->attach($u->id, ['tiene_deuda' => false, 'es_financiador' => false]);
    }

    expect(fn () => $this->action->execute([$inv->id => 600], $this->admin))
        ->toThrow(RuntimeException::class, 'inversores');
});

it('rechaza el cierre si una inversion tiene deudores pero no financiadores', function () {
    $invs = makeInversores(6);
    $inv = makeInversionWith6('Test', $invs, [
        0 => ['tiene_deuda' => true],
    ]);

    expect(fn () => $this->action->execute([$inv->id => 600], $this->admin))
        ->toThrow(RuntimeException::class, 'deudores pero no financiadores');
});

it('rechaza el cierre si faltan recaudaciones de inversiones existentes', function () {
    $invs = makeInversores(6);
    $inv1 = makeInversionWith6('A', $invs);
    $inv2 = makeInversionWith6('B', $invs);

    // Solo cargamos uno
    expect(fn () => $this->action->execute([$inv1->id => 600], $this->admin))
        ->toThrow(RuntimeException::class, 'Falta cargar recaudación');
});

// ─── Caso base: sin deudores ───────────────────────────────────────────────

it('reparte la parte completa cuando no hay deudores', function () {
    $invs = makeInversores(6);
    $inv = makeInversionWith6('Alfa', $invs);

    $cierre = $this->action->execute([$inv->id => 600], $this->admin);

    expect((float) $cierre->total_recaudado)->toBe(600.0);
    expect((float) $cierre->total_distribuido)->toBe(600.0);

    // Cada inversor recibe 100
    foreach ($invs as $u) {
        $totalUser = (float) CierreInversionPago::where('cierre_id', $cierre->id)
            ->where('user_id', $u->id)
            ->sum('monto');
        expect($totalUser)->toBe(100.0);
    }
});

// ─── Ejemplo del enunciado ─────────────────────────────────────────────────

it('aplica correctamente el ejemplo: deudor con deuda en 3 inversiones', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);

    // A debe en α, β, γ. E y F son financiadores. δ A no debe.
    $alfa = makeInversionWith6('α', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
        5 => ['es_financiador' => true],
    ]);
    $beta = makeInversionWith6('β', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
        5 => ['es_financiador' => true],
    ]);
    $gamma = makeInversionWith6('γ', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
        5 => ['es_financiador' => true],
    ]);
    $delta = makeInversionWith6('δ', [$A, $B, $C, $D, $E, $F], [
        4 => ['es_financiador' => true],
        5 => ['es_financiador' => true],
    ]);

    $cierre = $this->action->execute([
        $alfa->id => 600,
        $beta->id => 600,
        $gamma->id => 600,
        $delta->id => 600,
    ], $this->admin);

    // Sueldo esperado del ejemplo:
    // A = 50 + 50 + 0 + 100 = 200
    // B, C, D = 400 (100x4 cada uno)
    // E, F = 100x4 + 25 + 25 + 50 = 500 cada uno
    $totalA = (float) CierreInversionPago::where('cierre_id', $cierre->id)->where('user_id', $A->id)->sum('monto');
    $totalB = (float) CierreInversionPago::where('cierre_id', $cierre->id)->where('user_id', $B->id)->sum('monto');
    $totalE = (float) CierreInversionPago::where('cierre_id', $cierre->id)->where('user_id', $E->id)->sum('monto');
    $totalF = (float) CierreInversionPago::where('cierre_id', $cierre->id)->where('user_id', $F->id)->sum('monto');

    expect($totalA)->toBe(200.0);
    expect($totalB)->toBe(400.0);
    expect($totalE)->toBe(500.0);
    expect($totalF)->toBe(500.0);

    // Total recaudado = 2400, total distribuido = 2400 (conservación)
    expect((float) $cierre->total_recaudado)->toBe(2400.0);
    expect((float) $cierre->total_distribuido)->toBe(2400.0);
});

// ─── Casos del ranking ─────────────────────────────────────────────────────

it('deudor en 1 inversion recibe mitad solo en esa', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);

    // A debe en alfa, E financiador
    $alfa = makeInversionWith6('alfa', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
    ]);
    $beta = makeInversionWith6('beta', [$A, $B, $C, $D, $E, $F], [
        4 => ['es_financiador' => true],
    ]);

    $cierre = $this->action->execute([
        $alfa->id => 600,
        $beta->id => 600,
    ], $this->admin);

    // Parte = 100. A en alfa cobra 50 (1ra). En beta no debe → cobra 100.
    // Total A = 150
    $totalA = (float) CierreInversionPago::where('cierre_id', $cierre->id)->where('user_id', $A->id)->sum('monto');
    expect($totalA)->toBe(150.0);

    // E es financiador en ambas. En alfa: cedido = 50 (mitad de A). Solo E es financiador
    // entonces E recibe los 50. En beta: cedido = 0. E total = 100 (alfa) + 100 (beta) + 50 (redistrib alfa) = 250
    $totalE = (float) CierreInversionPago::where('cierre_id', $cierre->id)->where('user_id', $E->id)->sum('monto');
    expect($totalE)->toBe(250.0);
});

it('deudor en 2 inversiones recibe mitad en ambas', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);

    $alfa = makeInversionWith6('alfa', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
    ]);
    $beta = makeInversionWith6('beta', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
    ]);

    $cierre = $this->action->execute([
        $alfa->id => 600,
        $beta->id => 600,
    ], $this->admin);

    // A cobra 50 + 50 = 100
    $totalA = (float) CierreInversionPago::where('cierre_id', $cierre->id)->where('user_id', $A->id)->sum('monto');
    expect($totalA)->toBe(100.0);

    // E: 100 (alfa parte) + 50 (alfa redist) + 100 (beta parte) + 50 (beta redist) = 300
    $totalE = (float) CierreInversionPago::where('cierre_id', $cierre->id)->where('user_id', $E->id)->sum('monto');
    expect($totalE)->toBe(300.0);
});

it('deudor en 4 inversiones: cobra mitad en 1ra y 2da, cero en 3ra y 4ta', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);

    // A debe en TODAS, E es financiador en TODAS
    $invs = [];
    foreach (['1', '2', '3', '4'] as $n) {
        $invs[] = makeInversionWith6($n, [$A, $B, $C, $D, $E, $F], [
            0 => ['tiene_deuda' => true],
            4 => ['es_financiador' => true],
        ]);
    }

    $recaud = [];
    foreach ($invs as $inv) {
        $recaud[$inv->id] = 600;
    }

    $cierre = $this->action->execute($recaud, $this->admin);

    // A: 50 (1) + 50 (2) + 0 (3) + 0 (4) = 100
    $totalA = (float) CierreInversionPago::where('cierre_id', $cierre->id)->where('user_id', $A->id)->sum('monto');
    expect($totalA)->toBe(100.0);

    // Verificar conceptos
    $conceptos = CierreInversionPago::where('cierre_id', $cierre->id)
        ->where('user_id', $A->id)
        ->orderBy('inversion_id')
        ->pluck('concepto')
        ->all();
    expect($conceptos)->toBe([
        CierreInversionPago::CONCEPTO_MEDIA_PARTE_DEUDOR,
        CierreInversionPago::CONCEPTO_MEDIA_PARTE_DEUDOR,
        CierreInversionPago::CONCEPTO_CERO_DEUDOR,
        CierreInversionPago::CONCEPTO_CERO_DEUDOR,
    ]);
});

it('redistribuye equitativamente entre multiples financiadores', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);

    // A debe en alfa, B, E y F son financiadores
    $alfa = makeInversionWith6('alfa', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        1 => ['es_financiador' => true],
        4 => ['es_financiador' => true],
        5 => ['es_financiador' => true],
    ]);

    $cierre = $this->action->execute([$alfa->id => 600], $this->admin);

    // Parte = 100. A cobra 50. Cedido = 50. Repartido entre 3 financiadores = 16.67 c/u
    // Actualmente round(16.6666...) = 16.67
    $redistB = (float) CierreInversionPago::where('cierre_id', $cierre->id)
        ->where('user_id', $B->id)
        ->where('concepto', CierreInversionPago::CONCEPTO_REDISTRIBUCION)
        ->value('monto');
    expect($redistB)->toBe(16.67);
});

it('nombres numericos usan orden natural, no lexicografico (7 < 10)', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);

    // Crear inversiones con nombres numéricos que rompen el orden lexicográfico
    $invs = [];
    foreach (['7', '8', '9', '10'] as $n) {
        $invs[$n] = makeInversionWith6($n, [$A, $B, $C, $D, $E, $F], [
            0 => ['tiene_deuda' => true],
            4 => ['es_financiador' => true],
        ]);
    }

    $recaud = [];
    foreach ($invs as $inv) {
        $recaud[$inv->id] = 600;
    }

    $cierre = $this->action->execute($recaud, $this->admin);

    // Orden natural: 7 (1ra), 8 (2da), 9 (3ra), 10 (4ta)
    // A cobra mitad en 7 y 8, cero en 9 y 10
    $a7 = (float) CierreInversionPago::where('cierre_id', $cierre->id)
        ->where('user_id', $A->id)
        ->where('inversion_id', $invs['7']->id)
        ->value('monto');
    expect($a7)->toBe(50.0);

    $a8 = (float) CierreInversionPago::where('cierre_id', $cierre->id)
        ->where('user_id', $A->id)
        ->where('inversion_id', $invs['8']->id)
        ->value('monto');
    expect($a8)->toBe(50.0);

    $a9 = (float) CierreInversionPago::where('cierre_id', $cierre->id)
        ->where('user_id', $A->id)
        ->where('inversion_id', $invs['9']->id)
        ->value('monto');
    expect($a9)->toBe(0.0);

    $a10 = (float) CierreInversionPago::where('cierre_id', $cierre->id)
        ->where('user_id', $A->id)
        ->where('inversion_id', $invs['10']->id)
        ->value('monto');
    expect($a10)->toBe(0.0);
});

it('orden natural determina el ranking, no el orden de creacion', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);

    // Crear primero "Zeta", luego "Alpha". Alpha es alfabéticamente primera.
    $zeta = makeInversionWith6('Zeta', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
    ]);
    $alpha = makeInversionWith6('Alpha', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
    ]);
    $beta = makeInversionWith6('Beta', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
    ]);

    // Ranking natural: Alpha (1ra), Beta (2da), Zeta (3ra)
    $cierre = $this->action->execute([
        $zeta->id => 600,
        $alpha->id => 600,
        $beta->id => 600,
    ], $this->admin);

    // En Zeta (3ra), A cobra 0
    $aZeta = (float) CierreInversionPago::where('cierre_id', $cierre->id)
        ->where('user_id', $A->id)
        ->where('inversion_id', $zeta->id)
        ->value('monto');
    expect($aZeta)->toBe(0.0);

    // En Alpha (1ra), A cobra 50
    $aAlpha = (float) CierreInversionPago::where('cierre_id', $cierre->id)
        ->where('user_id', $A->id)
        ->where('inversion_id', $alpha->id)
        ->value('monto');
    expect($aAlpha)->toBe(50.0);

    // En Beta (2da), A cobra 50
    $aBeta = (float) CierreInversionPago::where('cierre_id', $cierre->id)
        ->where('user_id', $A->id)
        ->where('inversion_id', $beta->id)
        ->value('monto');
    expect($aBeta)->toBe(50.0);
});

it('recaudacion en cero no genera pagos pero deja registro', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);

    $alfa = makeInversionWith6('alfa', [$A, $B, $C, $D, $E, $F], [
        4 => ['es_financiador' => true],
    ]);

    $cierre = $this->action->execute([$alfa->id => 0], $this->admin);

    expect((float) $cierre->total_recaudado)->toBe(0.0);
    expect((float) $cierre->total_distribuido)->toBe(0.0);
    expect($cierre->pagos()->count())->toBe(0);
    expect($cierre->recaudaciones()->count())->toBe(1);
});

it('el periodo_inicio es el periodo_fin del cierre anterior', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);
    $alfa = makeInversionWith6('alfa', [$A, $B, $C, $D, $E, $F]);

    $primero = $this->action->execute([$alfa->id => 600], $this->admin);
    expect($primero->periodo_inicio)->toBeNull();

    $segundo = $this->action->execute([$alfa->id => 600], $this->admin);
    expect($segundo->periodo_inicio?->toIso8601String())
        ->toBe($primero->periodo_fin?->toIso8601String());
});

// ─── Autorización del controller ───────────────────────────────────────────

it('admin puede ver el indice de cierres', function () {
    $this->actingAs($this->admin)
        ->get('/cierres-inversion')
        ->assertOk();
});

it('inversor no puede ver el indice de cierres', function () {
    $inv = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '88880001']);
    $this->actingAs($inv)
        ->get('/cierres-inversion')
        ->assertForbidden();
});

it('admin puede ver el formulario de nuevo cierre', function () {
    $this->actingAs($this->admin)
        ->get('/cierres-inversion/nuevo')
        ->assertOk();
});

it('inversor no puede ver el formulario de nuevo cierre', function () {
    $inv = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '88880002']);
    $this->actingAs($inv)
        ->get('/cierres-inversion/nuevo')
        ->assertForbidden();
});

it('inversor no puede ejecutar un cierre', function () {
    $inv = User::factory()->create(['role' => UserRole::INVERSOR, 'dni' => '88880003']);
    $this->actingAs($inv)
        ->post('/cierres-inversion', ['recaudaciones' => []])
        ->assertForbidden();
});

it('admin ejecuta cierre via HTTP y obtiene redirect a show', function () {
    $invs = makeInversores(6);
    $inv = makeInversionWith6('Test', $invs);

    $response = $this->actingAs($this->admin)
        ->post('/cierres-inversion', [
            'recaudaciones' => [(string) $inv->id => 600],
            'tasa' => 1000,
        ]);

    $cierre = CierreInversion::latest('id')->first();
    $response->assertRedirect('/cierres-inversion/'.$cierre->id);
    expect((float) $cierre->total_recaudado)->toBe(600.0);
    expect((float) $cierre->tasa)->toBe(1000.0);
});

it('rechaza cierre HTTP sin tasa', function () {
    $invs = makeInversores(6);
    $inv = makeInversionWith6('Test', $invs);

    $this->actingAs($this->admin)
        ->post('/cierres-inversion', [
            'recaudaciones' => [(string) $inv->id => 600],
        ])
        ->assertSessionHasErrors('tasa');
});

it('valida que recaudaciones sean numericas y no negativas', function () {
    $invs = makeInversores(6);
    $inv = makeInversionWith6('Test', $invs);

    $this->actingAs($this->admin)
        ->post('/cierres-inversion', [
            'recaudaciones' => [(string) $inv->id => -100],
        ])
        ->assertSessionHasErrors();

    $this->actingAs($this->admin)
        ->post('/cierres-inversion', [
            'recaudaciones' => [(string) $inv->id => 'abc'],
        ])
        ->assertSessionHasErrors();
});

it('persiste la tasa de cambio del cierre', function () {
    $invs = makeInversores(6);
    $alfa = makeInversionWith6('alfa', $invs);

    $cierre = $this->action->execute(
        [$alfa->id => 600000],
        $this->admin,
        1200.50,
    );

    expect((float) $cierre->total_recaudado)->toBe(600000.0);
    expect((float) $cierre->tasa)->toBe(1200.50);
});

it('permite omitir la tasa (queda null)', function () {
    $invs = makeInversores(6);
    $alfa = makeInversionWith6('alfa', $invs);

    $cierre = $this->action->execute([$alfa->id => 600], $this->admin);

    expect($cierre->tasa)->toBeNull();
});

it('admin puede ver el detalle de un cierre', function () {
    $invs = makeInversores(6);
    $inv = makeInversionWith6('Test', $invs);
    $cierre = $this->action->execute([$inv->id => 600], $this->admin);

    $this->actingAs($this->admin)
        ->get("/cierres-inversion/{$cierre->id}")
        ->assertOk()
        ->assertInertia(fn ($p) => $p->component('CierresInversion/Show')
            ->has('cierre')
            ->has('recaudaciones', 1)
            ->has('porInversor', 6)
        );
});

it('inversor no puede ver el detalle de un cierre admin', function () {
    $invs = makeInversores(6);
    $inv = makeInversionWith6('Test', $invs);
    $cierre = $this->action->execute([$inv->id => 600], $this->admin);

    $this->actingAs($invs[0])
        ->get("/cierres-inversion/{$cierre->id}")
        ->assertForbidden();
});

// ─── Auto-desmarcado de tiene_deuda ────────────────────────────────────────

it('auto-desmarca tiene_deuda cuando saldo llega a cero por un pago', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);
    $inv = makeInversionWith6('Test', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
    ]);

    // Cargar deuda de 1000
    $this->actingAs($this->admin)
        ->post("/inversiones/{$inv->id}/inversores/{$A->id}/deuda", [
            'tipo' => 'cargo',
            'monto' => 1000,
        ]);

    // Verificar que sigue marcado
    expect((bool) $inv->inversores()->where('users.id', $A->id)->first()->pivot->tiene_deuda)->toBeTrue();

    // Pagar 1000 (saldo 0)
    $this->actingAs($this->admin)
        ->post("/inversiones/{$inv->id}/inversores/{$A->id}/deuda", [
            'tipo' => 'pago',
            'monto' => 1000,
        ]);

    // Ahora debe estar desmarcado
    expect((bool) $inv->inversores()->where('users.id', $A->id)->first()->pivot->tiene_deuda)->toBeFalse();
});

it('NO desmarca tiene_deuda si el saldo aun es positivo despues del pago', function () {
    [$A, $B, $C, $D, $E, $F] = makeInversores(6);
    $inv = makeInversionWith6('Test', [$A, $B, $C, $D, $E, $F], [
        0 => ['tiene_deuda' => true],
        4 => ['es_financiador' => true],
    ]);

    $this->actingAs($this->admin)
        ->post("/inversiones/{$inv->id}/inversores/{$A->id}/deuda", [
            'tipo' => 'cargo',
            'monto' => 1000,
        ]);

    $this->actingAs($this->admin)
        ->post("/inversiones/{$inv->id}/inversores/{$A->id}/deuda", [
            'tipo' => 'pago',
            'monto' => 400,
        ]);

    expect((bool) $inv->inversores()->where('users.id', $A->id)->first()->pivot->tiene_deuda)->toBeTrue();
});
