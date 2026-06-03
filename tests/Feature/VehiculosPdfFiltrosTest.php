<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->empresa = Empresa::create(['nombre' => 'Empresa Test']);
    $this->inversion = Inversion::create(['nombre' => 'Inv Test', 'empresa_id' => $this->empresa->id]);

    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '50000001',
    ]);

    $this->actingAs($this->admin);
    session(['active_company_id' => $this->empresa->id]);

    $chofer = User::factory()->create(['name' => 'Carlos Tester', 'dni' => '50000002']);

    Vehiculo::factory()->create([
        'patente' => 'AAA111',
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
        'user_id' => $chofer->id,
        'propietario' => 'Juan Dueño',
        'estado_patente' => 'buen_estado',
        'fecha_vencimiento_vtv' => now()->subMonths(2)->format('Y-m-01'),  // vencida
        'fecha_vencimiento_gnc' => now()->addMonths(6)->format('Y-m-01'),  // al día
    ]);

    Vehiculo::factory()->create([
        'patente' => 'BBB222',
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
        'user_id' => null,
        'propietario' => 'Otra Persona',
        'estado_patente' => null,
        'fecha_vencimiento_vtv' => null,
        'fecha_vencimiento_gnc' => null,
    ]);
});

it('exporta el PDF de vehículos sin filtros', function () {
    $this->get('/pdf/vehiculos')
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});

it('exporta el PDF respetando cada filtro sin errores', function (array $query) {
    $this->get('/pdf/vehiculos?'.http_build_query($query))
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
})->with([
    'búsqueda por patente' => [['search' => 'AAA']],
    'búsqueda por chofer' => [['search' => 'Carlos']],
    'con conductor' => [['asignacion' => 'con']],
    'sin conductor' => [['asignacion' => 'sin']],
    'estado sin estado' => [['estado_patente' => '__none__']],
    'estado buen_estado' => [['estado_patente' => 'buen_estado']],
    'titular' => [['titular' => 'Juan']],
    'vtv vencida' => [['vtv' => 'expired']],
    'vtv sin fecha' => [['vtv' => 'none']],
    'gnc al día' => [['gnc' => 'ok']],
    'gnc sin fecha' => [['gnc' => 'none']],
    'inversion' => [['inversion_id' => 1]],
    'combinado' => [['estado_patente' => 'buen_estado', 'vtv' => 'expired', 'asignacion' => 'con', 'titular' => 'Juan']],
]);
