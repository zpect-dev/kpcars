<?php

declare(strict_types=1);

use App\Actions\StoreRevisionAction;
use App\Http\Controllers\RevisionController;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Revision;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->inversion = Inversion::create(['nombre' => 'Test Inversión']);
    $this->empresa = Empresa::create(['nombre' => 'Test Empresa']);

    $this->vehiculo = Vehiculo::create([
        'patente' => 'ABC123',
        'marca' => 'Toyota',
        'modelo' => 'Corolla',
        'anio' => '2024',
        'propietario' => 'Test Owner',
        'inversion_id' => $this->inversion->id,
        'empresa_id' => $this->empresa->id,
    ]);

    $this->admin = User::factory()->create(['role' => 'administrador']);
});

// --- Action Tests ---

it('crea una revisión con datos válidos', function () {
    $action = new StoreRevisionAction;

    $revision = $action->execute($this->vehiculo, [
        'fecha_vencimiento_vtv' => '2026-12-01',
        'fecha_vencimiento_gnc' => '2026-11-01',
        'limpieza' => 'buena',
        'nivel_nafta' => 'optimo',
        'kilometraje' => 45000,
        'rueda_auxiliar' => true,
        'kit_seguridad' => true,
        'observaciones' => 'Todo en orden',
    ]);

    expect($revision)->toBeInstanceOf(Revision::class)
        ->and($revision->vehiculo_id)->toBe($this->vehiculo->id)
        ->and($revision->limpieza)->toBe('buena')
        ->and($revision->nivel_nafta)->toBe('optimo')
        ->and($revision->kilometraje)->toBe(45000)
        ->and($revision->rueda_auxiliar)->toBeTrue()
        ->and($revision->kit_seguridad)->toBeTrue()
        ->and($revision->observaciones)->toBe('Todo en orden');
});

it('sincroniza las fechas de VTV y GNC con el vehículo', function () {
    $action = new StoreRevisionAction;

    $action->execute($this->vehiculo, [
        'fecha_vencimiento_vtv' => '2027-06-01',
        'fecha_vencimiento_gnc' => '2027-03-01',
        'limpieza' => 'buena',
        'nivel_nafta' => 'optimo',
        'kilometraje' => 50000,
        'rueda_auxiliar' => false,
        'kit_seguridad' => false,
        'observaciones' => null,
    ]);

    $this->vehiculo->refresh();

    expect($this->vehiculo->fecha_vencimiento_vtv->toDateString())->toBe('2027-06-01')
        ->and($this->vehiculo->fecha_vencimiento_gnc->toDateString())->toBe('2027-03-01');
});

it('permite observaciones nulas', function () {
    $action = new StoreRevisionAction;

    $revision = $action->execute($this->vehiculo, [
        'limpieza' => 'mala',
        'nivel_nafta' => 'bajo',
        'kilometraje' => 10000,
        'rueda_auxiliar' => false,
        'kit_seguridad' => false,
        'observaciones' => null,
    ]);

    expect($revision->observaciones)->toBeNull();
});

// --- Week Calculation Tests ---

it('calcula el inicio de semana como miércoles', function () {
    // A Wednesday should return itself
    Carbon::setTestNow(Carbon::parse('2026-04-29')); // Wednesday
    $start = RevisionController::currentWeekStart();
    expect($start->toDateString())->toBe('2026-04-29');

    // A Thursday should return the previous Wednesday
    Carbon::setTestNow(Carbon::parse('2026-04-30')); // Thursday
    $start = RevisionController::currentWeekStart();
    expect($start->toDateString())->toBe('2026-04-29');

    // A Tuesday should return the previous week's Wednesday
    Carbon::setTestNow(Carbon::parse('2026-04-28')); // Tuesday
    $start = RevisionController::currentWeekStart();
    expect($start->toDateString())->toBe('2026-04-22');

    // A Monday should return the previous week's Wednesday
    Carbon::setTestNow(Carbon::parse('2026-04-27')); // Monday
    $start = RevisionController::currentWeekStart();
    expect($start->toDateString())->toBe('2026-04-22');

    Carbon::setTestNow(); // Reset
});

// --- HTTP Integration Tests ---

it('puede acceder al listado de revisiones como administrador', function () {
    $response = $this->actingAs($this->admin)->get('/revisiones');

    $response->assertSuccessful();
});

it('un inversor no puede acceder a revisiones', function () {
    $inversor = User::factory()->create(['role' => 'inversor']);

    $response = $this->actingAs($inversor)->get('/revisiones');

    $response->assertForbidden();
});

it('puede enviar una revisión completa vía HTTP', function () {
    $response = $this->actingAs($this->admin)->post("/revisiones/{$this->vehiculo->id}", [
        'fecha_vencimiento_vtv' => '2026-12',
        'fecha_vencimiento_gnc' => '2026-11',
        'limpieza' => 'buena',
        'nivel_nafta' => 'optimo',
        'kilometraje' => 55000,
        'rueda_auxiliar' => true,
        'kit_seguridad' => true,
        'observaciones' => 'Sin novedades',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success');

    $revision = Revision::where('vehiculo_id', $this->vehiculo->id)->first();
    expect($revision)->not->toBeNull()
        ->and($revision->limpieza)->toBe('buena')
        ->and($revision->nivel_nafta)->toBe('optimo')
        ->and($revision->kilometraje)->toBe(55000)
        ->and($revision->rueda_auxiliar)->toBeTrue()
        ->and($revision->kit_seguridad)->toBeTrue()
        ->and($revision->observaciones)->toBe('Sin novedades');

    // VTV/GNC should also be updated on the vehicle
    $this->vehiculo->refresh();
    expect($this->vehiculo->fecha_vencimiento_vtv->toDateString())->toBe('2026-12-01')
        ->and($this->vehiculo->fecha_vencimiento_gnc->toDateString())->toBe('2026-11-01');
});

it('rechaza una revisión con datos inválidos', function () {
    $response = $this->actingAs($this->admin)->post("/revisiones/{$this->vehiculo->id}", [
        'limpieza' => 'excelente', // invalid
        'nivel_nafta' => '',       // required
        'kilometraje' => -5,       // must be >= 0
    ]);

    $response->assertSessionHasErrors(['limpieza', 'nivel_nafta', 'kilometraje']);
});
