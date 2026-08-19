<?php

declare(strict_types=1);

use App\Actions\BuildServiceListadoAction;
use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\KilometrajeLectura;
use App\Models\Service;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '50000001',
    ]);

    $this->empresa = Empresa::create(['nombre' => 'Empresa Export']);
    $this->inversion = Inversion::create(['nombre' => 'Inv Export', 'empresa_id' => $this->empresa->id]);
});

/** Vehículo con una lectura de km y, opcionalmente, un service. */
function vehiculoConKm(string $patente, int $kmActual, ?int $kmService = null): Vehiculo
{
    $vehiculo = Vehiculo::factory()->create([
        'patente' => $patente,
        'inversion_id' => test()->inversion->id,
        'empresa_id' => test()->empresa->id,
    ]);

    KilometrajeLectura::create([
        'vehiculo_id' => $vehiculo->id,
        'registrado_por' => test()->admin->id,
        'kilometraje' => $kmActual,
        'fecha' => now()->toDateString(),
    ]);

    if ($kmService !== null) {
        Service::create([
            'vehiculo_id' => $vehiculo->id,
            'realizado_por' => test()->admin->id,
            'kilometraje' => $kmService,
            'fecha' => now()->subMonth()->toDateString(),
        ]);
    }

    return $vehiculo;
}

it('exporta el PDF de service con las patentes y su kilometraje', function () {
    vehiculoConKm('EXP001', 55000, 50000);
    vehiculoConKm('EXP002', 90000);

    $response = $this->actingAs($this->admin)->get('/pdf/services');

    $response->assertOk()
        ->assertHeader('content-type', 'application/pdf');

    expect($response->headers->get('content-disposition'))
        ->toContain('service-'.now()->format('Y-m-d').'.pdf');
});

it('arma cada fila con el km actual y el último service', function () {
    vehiculoConKm('DATOS01', 55000, 50000);

    $fila = app(BuildServiceListadoAction::class)->execute()->firstWhere('patente', 'DATOS01');

    expect($fila['km_actual'])->toBe(55000)
        ->and($fila['ultimo_service']['kilometraje'])->toBe(50000)
        ->and($fila['km_recorridos'])->toBe(5000)
        ->and($fila['km_restantes'])->toBe(Service::INTERVALO_KM - 5000)
        ->and($fila['estado'])->toBe('al_dia');
});

it('marca sin_service al vehículo que tiene km pero nunca pasó por service', function () {
    vehiculoConKm('SINSRV1', 90000);

    $fila = app(BuildServiceListadoAction::class)->execute()->firstWhere('patente', 'SINSRV1');

    expect($fila['estado'])->toBe('sin_service')
        ->and($fila['ultimo_service'])->toBeNull()
        ->and($fila['km_actual'])->toBe(90000);
});

it('filtra por estado, igual que la pantalla', function () {
    vehiculoConKm('VENCIDO1', 65000, 50000);  // 15.000 km recorridos: vencido
    vehiculoConKm('ALDIA1', 52000, 50000);    // 2.000 km recorridos: al día

    $patentes = app(BuildServiceListadoAction::class)
        ->execute(['estado' => 'vencido'])
        ->pluck('patente');

    expect($patentes)->toContain('VENCIDO1')
        ->and($patentes)->not->toContain('ALDIA1');
});

it('filtra por búsqueda de patente, marca, modelo o conductor', function () {
    vehiculoConKm('BUSCAR1', 55000, 50000);
    vehiculoConKm('OTRA222', 55000, 50000);

    $patentes = app(BuildServiceListadoAction::class)
        ->execute(['q' => 'buscar'])
        ->pluck('patente');

    expect($patentes)->toContain('BUSCAR1')
        ->and($patentes)->not->toContain('OTRA222');
});

it('ordena los vencidos primero, por mayor excedido', function () {
    vehiculoConKm('ALDIA1', 52000, 50000);
    vehiculoConKm('VENCIDO_MENOS', 61000, 50000);
    vehiculoConKm('VENCIDO_MAS', 75000, 50000);

    $patentes = app(BuildServiceListadoAction::class)->execute()->pluck('patente')->all();

    expect(array_slice($patentes, 0, 3))
        ->toBe(['VENCIDO_MAS', 'VENCIDO_MENOS', 'ALDIA1']);
});

it('un chofer no puede exportar el listado de service', function () {
    $chofer = User::factory()->create([
        'role' => UserRole::CHOFER,
        'dni' => '50000002',
    ]);

    $this->actingAs($chofer)->get('/pdf/services')->assertForbidden();
    $this->actingAs($chofer)->get('/excel/services')->assertForbidden();
});
