<?php

declare(strict_types=1);

use App\Actions\SincronizarMultasAction;
use App\Enums\UserRole;
use App\Models\Acta;
use App\Models\MultaSyncRun;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'must_change_password' => false,
    ]);
});

// ── Helpers del feed (propios: este archivo se corre también aislado) ──────

function feedSnapshot(string $fecha, array $busquedas): array
{
    return ['fecha' => $fecha, 'busquedas' => $busquedas];
}

function feedPatente(string $patente, array $detalle): array
{
    return [
        'busqueda' => $patente,
        'resultados' => [['municipio' => 'BSAS - 48%', 'detalle' => $detalle]],
    ];
}

/** Infracción de BSAS de $341.650. */
function feedItem(string $acta): array
{
    return [
        'acta' => $acta,
        'motivo' => 'Exceso de velocidad',
        'monto' => '341650',
        'fechaInfraccion' => '21/02/2024',
        'fechaEmision' => '12/05/2025',
        'fechaVencimiento' => '24/06/2025',
    ];
}

/** Acta vigente con importe, ligada a la corrida que la dio de alta. */
function actaDeCorrida(MultaSyncRun $run, array $overrides = []): Acta
{
    return Acta::create(array_merge([
        'patente' => 'AA123BB',
        'jurisdiccion' => 'BSAS',
        'clave' => 'BSAS:'.uniqid(),
        'motivo' => 'Exceso de velocidad',
        'monto' => 20000,
        'estado' => 'vigente',
        'sync_run_id' => $run->id,
    ], $overrides));
}

// ── La corrida guarda su reporte ───────────────────────────────────────────

it('guarda en la corrida cuánta plata sumaron las altas y cómo quedó la deuda', function () {
    $run = MultaSyncRun::create(['origen' => 'manual', 'ok' => false]);

    $snap = feedSnapshot('03/08/2026', [
        feedPatente('AA123BB', [feedItem('A1'), feedItem('A2')]),
    ]);

    $r = (new SincronizarMultasAction)->execute([$snap], $run->id);

    // bsasItem() trae 341650 cada una.
    expect($r['nuevas'])->toBe(2)
        ->and($r['monto_nuevas'])->toBe(683300.0)
        ->and($r['monto_resueltas'])->toBe(0.0)
        ->and($r['deuda_vigente'])->toBe(683300.0)
        // Las altas quedan selladas con la corrida que las trajo.
        ->and(Acta::where('sync_run_id', $run->id)->count())->toBe(2);
});

it('imputa a la corrida las multas que se pagaron en el organismo, con su monto', function () {
    $action = new SincronizarMultasAction;
    $primera = MultaSyncRun::create(['origen' => 'manual', 'ok' => false]);

    $action->execute([feedSnapshot('01/08/2026', [
        feedPatente('AA123BB', [feedItem('A1'), feedItem('A2')]),
    ])], $primera->id);

    // A2 desaparece del feed: se resuelve en la segunda corrida.
    $segunda = MultaSyncRun::create(['origen' => 'schedule', 'ok' => false]);

    $r = $action->execute([feedSnapshot('03/08/2026', [
        feedPatente('AA123BB', [feedItem('A1')]),
    ])], $segunda->id);

    expect($r['resueltas'])->toBe(1)
        ->and($r['monto_resueltas'])->toBe(341650.0)
        ->and($r['nuevas'])->toBe(0)
        // La deuda vigente baja: queda solo A1.
        ->and($r['deuda_vigente'])->toBe(341650.0)
        ->and(Acta::where('acta', 'A2')->first()->resuelta_run_id)->toBe($segunda->id)
        // El alta sigue apuntando a la corrida original.
        ->and(Acta::where('acta', 'A2')->first()->sync_run_id)->toBe($primera->id);
});

it('al reabrirse un acta la desliga de la corrida que la dio por pagada', function () {
    $action = new SincronizarMultasAction;

    $primera = MultaSyncRun::create(['origen' => 'manual', 'ok' => false]);
    $action->execute([feedSnapshot('01/08/2026', [
        feedPatente('AA123BB', [feedItem('A1')]),
    ])], $primera->id);

    $segunda = MultaSyncRun::create(['origen' => 'manual', 'ok' => false]);
    $action->execute([feedSnapshot('02/08/2026', [
        feedPatente('AA123BB', []),
    ])], $segunda->id);

    expect(Acta::first()->resuelta_run_id)->toBe($segunda->id);

    $tercera = MultaSyncRun::create(['origen' => 'manual', 'ok' => false]);
    $r = $action->execute([feedSnapshot('03/08/2026', [
        feedPatente('AA123BB', [feedItem('A1')]),
    ])], $tercera->id);

    expect($r['reabiertas'])->toBe(1)
        ->and(Acta::first()->resuelta_run_id)->toBeNull()
        ->and(Acta::first()->sync_run_id)->toBe($primera->id);
});

// ── El panel de reportes ───────────────────────────────────────────────────

it('lista un reporte por corrida con lo que sumó y lo que se cobró desde entonces', function () {
    $run = MultaSyncRun::create([
        'origen' => 'schedule',
        'ok' => true,
        'snapshot_fecha' => '2026-08-03',
        'nuevas' => 2,
        'monto_nuevas' => 40000,
        'resueltas' => 1,
        'monto_resueltas' => 15000,
        'deuda_vigente' => 40000,
    ]);

    $acta = actaDeCorrida($run);

    // Cobro registrado después de la corrida: entra en su ventana.
    $this->actingAs($this->admin)->patch("/actas/{$acta->id}/cobrado", [
        'monto' => 5000,
        'fecha_cobro' => '2026-08-04',
    ]);

    $this->actingAs($this->admin)
        ->get('/actas')
        ->assertInertia(fn (Assert $p) => $p
            ->has('reportes', 1)
            ->where('reportes.0.nuevas', 2)
            ->where('reportes.0.monto_nuevas', 40000.0)
            ->where('reportes.0.resueltas', 1)
            ->where('reportes.0.monto_resueltas', 15000.0)
            ->where('reportes.0.deuda_vigente', 40000.0)
            ->where('reportes.0.pagos', 1)
            ->where('reportes.0.cobrado', 5000.0)
            // El detalle no viaja hasta que se despliega la fila.
            ->where('reporteDetalle', null)
        );
});

it('no imputa a una corrida los cobros registrados antes de ella', function () {
    $vieja = MultaSyncRun::create(['origen' => 'manual', 'ok' => true, 'nuevas' => 1, 'monto_nuevas' => 20000]);
    $acta = actaDeCorrida($vieja);

    $this->actingAs($this->admin)->patch("/actas/{$acta->id}/cobrado", [
        'monto' => 5000,
        'fecha_cobro' => '2026-08-04',
    ]);

    // Corrida posterior al cobro: su ventana arranca después.
    $nueva = MultaSyncRun::create(['origen' => 'manual', 'ok' => true]);

    $this->actingAs($this->admin)
        ->get('/actas')
        ->assertInertia(fn (Assert $p) => $p
            ->has('reportes', 2)
            // La más nueva primero, sin cobros.
            ->where('reportes.0.id', $nueva->id)
            ->where('reportes.0.cobrado', 0.0)
            // El cobro queda en la ventana de la corrida anterior.
            ->where('reportes.1.id', $vieja->id)
            ->where('reportes.1.cobrado', 5000.0)
        );
});

it('trae el detalle del reporte con el desglose por chofer y por vehículo', function () {
    $chofer = User::factory()->create(['name' => 'Juan Pérez']);

    $run = MultaSyncRun::create([
        'origen' => 'manual', 'ok' => true, 'snapshot_fecha' => '2026-08-03',
        'nuevas' => 2, 'monto_nuevas' => 40000, 'deuda_vigente' => 40000,
    ]);

    $conChofer = actaDeCorrida($run, ['conductor_id' => $chofer->id]);
    actaDeCorrida($run, ['patente' => 'CC999DD']);

    $this->actingAs($this->admin)->patch("/actas/{$conChofer->id}/cobrado", [
        'monto' => 8000,
        'fecha_cobro' => '2026-08-04',
    ]);

    $this->actingAs($this->admin)
        ->get("/actas?reporte={$run->id}")
        ->assertInertia(fn (Assert $p) => $p
            ->where('reporteDetalle.run.id', $run->id)
            ->has('reporteDetalle.nuevas', 2)
            ->has('reporteDetalle.cobros', 1)
            ->where('reporteDetalle.totales.cobrado', 8000.0)

            // Las dos altas valen lo mismo, así que desempata lo cobrado: el
            // chofer con el pago encabeza el desglose.
            ->has('reporteDetalle.por_chofer', 2)
            ->where('reporteDetalle.por_chofer.0.label', 'Juan Pérez')
            ->where('reporteDetalle.por_chofer.0.nuevas', 1)
            ->where('reporteDetalle.por_chofer.0.cobrado', 8000.0)
            // Adeuda lo que quedó del acta cobrada parcialmente.
            ->where('reporteDetalle.por_chofer.0.adeuda', 12000.0)
            ->where('reporteDetalle.por_chofer.1.label', 'Sin chofer')
            ->where('reporteDetalle.por_chofer.1.cobrado', 0.0)
            ->where('reporteDetalle.por_chofer.1.adeuda', 20000.0)

            ->has('reporteDetalle.por_vehiculo', 2)
            ->where('reporteDetalle.por_vehiculo.0.label', 'AA123BB')
            ->where('reporteDetalle.por_vehiculo.0.nuevas', 1)
            ->where('reporteDetalle.por_vehiculo.0.cobrado', 8000.0)
            ->where('reporteDetalle.por_vehiculo.1.label', 'CC999DD')
        );
});

it('descarga el PDF del reporte de una corrida', function () {
    $run = MultaSyncRun::create([
        'origen' => 'manual', 'ok' => true, 'snapshot_fecha' => '2026-08-03',
        'nuevas' => 1, 'monto_nuevas' => 20000, 'deuda_vigente' => 20000,
    ]);
    actaDeCorrida($run);

    $this->actingAs($this->admin)
        ->get("/actas/reportes/{$run->id}/pdf")
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});

it('no deja ver los reportes a quien no puede ver multas', function () {
    $run = MultaSyncRun::create(['origen' => 'manual', 'ok' => true]);
    $chofer = User::factory()->create([
        'role' => UserRole::CHOFER,
        'must_change_password' => false,
    ]);

    $this->actingAs($chofer)->get("/actas/reportes/{$run->id}/pdf")->assertForbidden();
});
