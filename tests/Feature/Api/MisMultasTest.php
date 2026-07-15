<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Multa;
use App\Models\User;
use App\Models\Vehiculo;

beforeEach(function () {
    $this->chofer = User::factory()->create([
        'dni' => '33333333',
        'password' => bcrypt('password'),
        'role' => UserRole::CHOFER,
        'must_change_password' => false,
    ]);

    $this->token = $this->chofer->createToken('test')->plainTextToken;

    $empresa = Empresa::create(['nombre' => 'Empresa Test']);
    $inversion = Inversion::create(['nombre' => 'Inv Test', 'empresa_id' => $empresa->id]);
    $this->vehiculo = Vehiculo::factory()->create(['inversion_id' => $inversion->id]);
});

it('requiere autenticación para mis-multas', function () {
    $this->getJson('/api/mis-multas')->assertUnauthorized();
});

it('devuelve solo las multas imputadas al chofer autenticado', function () {
    $otroChofer = User::factory()->create(['role' => UserRole::CHOFER]);

    Multa::create([
        'vehiculo_id' => $this->vehiculo->id,
        'conductor_id' => $this->chofer->id,
        'fecha' => '2026-05-01',
        'fecha_vencimiento' => '2026-06-01',
        'monto' => 10000,
        'descripcion' => 'Exceso de velocidad',
        'jurisdiccion' => 'GBA',
        'pdf_path' => 'multas/ejemplo.pdf',
    ]);

    Multa::create([
        'vehiculo_id' => $this->vehiculo->id,
        'conductor_id' => $otroChofer->id,
        'fecha' => '2026-05-02',
        'monto' => 5000,
        'descripcion' => 'Mal estacionamiento',
        'jurisdiccion' => 'GBA',
    ]);

    $response = $this->withHeaders(['Authorization' => 'Bearer '.$this->token])
        ->getJson('/api/mis-multas');

    $response->assertSuccessful()
        ->assertJsonCount(1, 'multas')
        ->assertJsonPath('multas.0.monto', 10000)
        ->assertJsonPath('multas.0.descripcion', 'Exceso de velocidad');

    expect($response->json('multas.0.pdf_url'))->toContain('multas/ejemplo.pdf');
});

it('aplica el descuento del 50% de CABA al saldo adeudado si no venció', function () {
    Multa::create([
        'vehiculo_id' => $this->vehiculo->id,
        'conductor_id' => $this->chofer->id,
        'fecha' => today()->toDateString(),
        'fecha_vencimiento' => today()->addDays(10)->toDateString(),
        'monto' => 20000,
        'descripcion' => 'CABA con descuento',
        'jurisdiccion' => 'CABA',
    ]);

    $response = $this->withHeaders(['Authorization' => 'Bearer '.$this->token])
        ->getJson('/api/mis-multas');

    $response->assertSuccessful()
        ->assertJsonPath('multas.0.monto', 20000)
        ->assertJsonPath('multas.0.monto_adeudado', 10000)
        ->assertJsonPath('total_adeudado', 10000);
});

it('no adeuda nada si la multa ya fue cobrada', function () {
    Multa::create([
        'vehiculo_id' => $this->vehiculo->id,
        'conductor_id' => $this->chofer->id,
        'fecha' => '2026-05-01',
        'monto' => 8000,
        'descripcion' => 'Ya cobrada',
        'jurisdiccion' => 'GBA',
        'cobrado' => true,
    ]);

    $this->withHeaders(['Authorization' => 'Bearer '.$this->token])
        ->getJson('/api/mis-multas')
        ->assertSuccessful()
        ->assertJsonPath('multas.0.monto_adeudado', 0)
        ->assertJsonPath('total_adeudado', 0);
});
