<?php

declare(strict_types=1);

use App\Actions\SincronizarMultasAction;
use App\Models\Acta;
use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\User;
use App\Models\Vehiculo;

/** Crea un vehículo con su empresa e inversión (ambas NOT NULL en la tabla). */
function mkVehiculo(string $patente): Vehiculo
{
    $empresa = Empresa::create(['nombre' => 'Emp '.uniqid()]);
    $inversion = Inversion::create(['nombre' => 'Inv '.uniqid(), 'empresa_id' => $empresa->id]);

    return Vehiculo::factory()->create([
        'patente' => $patente,
        'empresa_id' => $empresa->id,
        'inversion_id' => $inversion->id,
    ]);
}

// ── Helpers para armar snapshots del feed ──────────────────────────────────

function mkSnapshot(string $fecha, array $busquedas): array
{
    return [
        'fecha' => $fecha,
        'dia' => 'lunes',
        'totalPatentes' => count($busquedas),
        'busquedas' => $busquedas,
    ];
}

function mkBusqueda(string $patente, array $resultados): array
{
    return [
        'busqueda' => $patente,
        'deuda' => '0',
        'resuelve_por' => '0',
        'resultados' => $resultados,
    ];
}

function mkBsas(array $detalle): array
{
    return ['municipio' => 'BSAS - 48%', 'infracciones' => [], 'deuda' => 0, 'monto' => 0, 'detalle' => $detalle];
}

function mkCaba(array $detalle): array
{
    return ['municipio' => 'CABA - 50%', 'infracciones' => [], 'deuda' => 0, 'monto' => 0, 'detalle' => $detalle];
}

function bsasItem(string $acta, string $fechaInfraccion = '21/02/2024'): array
{
    return [
        'fechaVencimiento' => '24/06/2025',
        'fechaEmision' => '12/05/2025',
        'fechaInfraccion' => $fechaInfraccion,
        'motivo' => 'Exceso de velocidad',
        'monto' => '341650',
        'acta' => $acta,
    ];
}

/** CABA no trae `acta`: se identifica por clave sintética. */
function cabaItem(string $motivo, string $monto): array
{
    return [
        'fechaVencimiento' => ' 21/10/2026',
        'fechaInfraccion' => '03/07/2026',
        'motivo' => $motivo,
        'monto' => $monto,
    ];
}

// ── Tests ──────────────────────────────────────────────────────────────────

it('ingiere actas nuevas de BSAS y CABA y las liga al vehículo por patente', function () {
    $v = mkVehiculo('AA123BB');

    $snap = mkSnapshot('03/08/2026', [
        mkBusqueda('AA123BB', [
            mkBsas([bsasItem('02-105-0001')]),
            mkCaba([cabaItem('Peaje', '100')]),
        ]),
    ]);

    $r = (new SincronizarMultasAction)->execute([$snap]);

    expect($r['nuevas'])->toBe(2)
        ->and($r['resueltas'])->toBe(0)
        ->and(Acta::count())->toBe(2);

    $bsas = Acta::where('jurisdiccion', 'BSAS')->first();
    expect($bsas->vehiculo_id)->toBe($v->id)
        ->and($bsas->acta)->toBe('02-105-0001')
        ->and($bsas->clave)->toBe('BSAS:02-105-0001');

    $caba = Acta::where('jurisdiccion', 'CABA')->first();
    expect($caba->acta)->toBeNull()
        ->and($caba->clave)->toStartWith('CABA:')
        ->and($caba->vehiculo_id)->toBe($v->id);
});

it('toma el snapshot más reciente cuando llegan varios', function () {
    mkVehiculo('AA123BB');

    $viejo = mkSnapshot('31/07/2026', [mkBusqueda('AA123BB', [mkBsas([bsasItem('VIEJA')])])]);
    $nuevo = mkSnapshot('03/08/2026', [mkBusqueda('AA123BB', [mkBsas([bsasItem('NUEVA')])])]);

    // Se pasan desordenados a propósito.
    $r = (new SincronizarMultasAction)->execute([$viejo, $nuevo]);

    expect($r['snapshot'])->toBe('2026-08-03')
        ->and(Acta::count())->toBe(1)
        ->and(Acta::first()->acta)->toBe('NUEVA');
});

it('no duplica al reingerir el mismo snapshot, incluida una multa de CABA sin acta', function () {
    mkVehiculo('AA123BB');

    $snap = mkSnapshot('03/08/2026', [
        mkBusqueda('AA123BB', [mkCaba([cabaItem('Peaje', '100')])]),
    ]);

    $action = new SincronizarMultasAction;
    $action->execute([$snap]);
    $action->execute([$snap]);

    expect(Acta::count())->toBe(1)
        ->and(Acta::first()->estado->value)->toBe('vigente');
});

it('no duplica una multa de CABA cuando cambia el monto (intereses)', function () {
    mkVehiculo('AA123BB');
    $action = new SincronizarMultasAction;

    // Misma infracción de CABA, con el monto actualizado entre snapshots. Como
    // el monto salió del hash de la clave, debe seguir siendo la MISMA acta: ni
    // "nueva" ni "resuelta" falsa.
    $action->execute([mkSnapshot('01/08/2026', [
        mkBusqueda('AA123BB', [mkCaba([cabaItem('Peaje', '100')])]),
    ])]);

    $r = $action->execute([mkSnapshot('03/08/2026', [
        mkBusqueda('AA123BB', [mkCaba([cabaItem('Peaje', '150')])]),
    ])]);

    expect(Acta::count())->toBe(1)
        ->and($r['nuevas'])->toBe(0)
        ->and($r['resueltas'])->toBe(0)
        ->and(Acta::first()->estado->value)->toBe('vigente')
        ->and((float) Acta::first()->monto)->toBe(150.0);
});

it('marca resuelta el acta que desaparece si la patente sigue presente', function () {
    mkVehiculo('AA123BB');
    $action = new SincronizarMultasAction;

    // Snapshot 1: dos actas.
    $action->execute([mkSnapshot('31/07/2026', [
        mkBusqueda('AA123BB', [mkBsas([bsasItem('A1'), bsasItem('A2')])]),
    ])]);
    expect(Acta::vigente()->count())->toBe(2);

    // Snapshot 2: A2 desaparece, la patente sigue presente.
    $r = $action->execute([mkSnapshot('03/08/2026', [
        mkBusqueda('AA123BB', [mkBsas([bsasItem('A1')])]),
    ])]);

    expect($r['resueltas'])->toBe(1)
        ->and(Acta::where('acta', 'A2')->first()->estado->value)->toBe('resuelta')
        ->and(Acta::where('acta', 'A2')->first()->resuelta_en?->toDateString())->toBe('2026-08-03')
        ->and(Acta::where('acta', 'A1')->first()->estado->value)->toBe('vigente');
});

it('NO resuelve actas si la patente entera desaparece del feed (búsqueda caída)', function () {
    mkVehiculo('AA123BB');
    mkVehiculo('CC999DD');
    $action = new SincronizarMultasAction;

    $action->execute([mkSnapshot('31/07/2026', [
        mkBusqueda('AA123BB', [mkBsas([bsasItem('A1')])]),
    ])]);

    // Snapshot donde AA123BB no viene (solo otra patente).
    $r = $action->execute([mkSnapshot('03/08/2026', [
        mkBusqueda('CC999DD', [mkBsas([bsasItem('B1')])]),
    ])]);

    expect($r['resueltas'])->toBe(0)
        ->and(Acta::where('acta', 'A1')->first()->estado->value)->toBe('vigente');
});

it('reabre un acta que había desaparecido y vuelve a aparecer', function () {
    mkVehiculo('AA123BB');
    $action = new SincronizarMultasAction;

    $action->execute([mkSnapshot('30/07/2026', [mkBusqueda('AA123BB', [mkBsas([bsasItem('A1')])])])]);

    // Desaparece (patente presente pero sin detalle) => resuelta.
    $action->execute([mkSnapshot('31/07/2026', [mkBusqueda('AA123BB', [mkBsas([])])])]);
    expect(Acta::where('acta', 'A1')->first()->estado->value)->toBe('resuelta');

    // Vuelve a aparecer => se reabre.
    $r = $action->execute([mkSnapshot('03/08/2026', [mkBusqueda('AA123BB', [mkBsas([bsasItem('A1')])])])]);

    expect($r['reabiertas'])->toBe(1)
        ->and(Acta::where('acta', 'A1')->first()->estado->value)->toBe('vigente')
        ->and(Acta::where('acta', 'A1')->first()->resuelta_en)->toBeNull();
});

it('imputa el chofer según la fecha de la infracción (como en Multas)', function () {
    $v = mkVehiculo('AA123BB');
    $choferA = User::factory()->create(['name' => 'Chofer A']);
    $choferB = User::factory()->create(['name' => 'Chofer B']);

    // Chofer A manejó ene–mar 2024; Chofer B desde abr 2024 (asignación abierta).
    Asignacion::create([
        'vehiculo_id' => $v->id, 'conductor_id' => $choferA->id,
        'fecha_inicio' => '2024-01-01', 'fecha_fin' => '2024-03-31',
    ]);
    Asignacion::create([
        'vehiculo_id' => $v->id, 'conductor_id' => $choferB->id,
        'fecha_inicio' => '2024-04-01', 'fecha_fin' => null,
    ]);

    $snap = mkSnapshot('03/08/2026', [
        mkBusqueda('AA123BB', [
            mkBsas([
                bsasItem('EN-A', '15/02/2024'),   // cae en el período de A
                bsasItem('EN-B', '10/05/2024'),   // cae en el período de B
                bsasItem('SIN', '10/12/2023'),    // sin asignación vigente
            ]),
        ]),
    ]);

    (new SincronizarMultasAction)->execute([$snap]);

    expect(Acta::where('acta', 'EN-A')->first()->conductor_id)->toBe($choferA->id)
        ->and(Acta::where('acta', 'EN-B')->first()->conductor_id)->toBe($choferB->id)
        ->and(Acta::where('acta', 'SIN')->first()->conductor_id)->toBeNull();
});

it('ignora municipios que no son BSAS ni CABA', function () {
    mkVehiculo('AA123BB');

    $snap = mkSnapshot('03/08/2026', [
        mkBusqueda('AA123BB', [
            ['municipio' => 'EZEIZA - 65%', 'infracciones' => ['5 infracciones'], 'deuda' => 100, 'monto' => 50],
            mkBsas([bsasItem('A1')]),
        ]),
    ]);

    (new SincronizarMultasAction)->execute([$snap]);

    expect(Acta::count())->toBe(1)
        ->and(Acta::first()->jurisdiccion)->toBe('BSAS');
});
