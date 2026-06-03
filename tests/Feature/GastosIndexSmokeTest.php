<?php

declare(strict_types=1);

use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Inversion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('renderiza la vista global de gastos con cards, ultimos 10 y desglose', function () {
    $emp1 = Empresa::create(['nombre' => 'EMP_1']);
    $emp2 = Empresa::create(['nombre' => 'EMP_2']);

    $admin = User::factory()->create(['role' => 'administrador']);

    $inv = Inversion::create(['nombre' => 'Inv A', 'empresa_id' => $emp1->id]);

    $veh1 = Vehiculo::factory()->create(['empresa_id' => $emp1->id, 'inversion_id' => $inv->id, 'patente' => 'AAA111']);
    $veh2 = Vehiculo::factory()->create(['empresa_id' => $emp2->id, 'inversion_id' => $inv->id, 'patente' => 'BBB222']);

    // Gastos de vehículo en cada empresa.
    Gasto::create(['fecha' => now(), 'monto' => 100, 'user_id' => $admin->id, 'recibio' => 'x', 'metodo_pago' => 'efectivo', 'tipo' => 'vehiculo', 'vehiculo_id' => $veh1->id]);
    Gasto::create(['fecha' => now(), 'monto' => 50, 'user_id' => $admin->id, 'recibio' => 'x', 'metodo_pago' => 'efectivo', 'tipo' => 'vehiculo', 'vehiculo_id' => $veh2->id]);
    // Globales.
    Gasto::create(['fecha' => now(), 'monto' => 30, 'user_id' => $admin->id, 'recibio' => 'x', 'metodo_pago' => 'efectivo', 'tipo' => 'kevin', 'vehiculo_id' => null]);
    Gasto::create(['fecha' => now(), 'monto' => 20, 'user_id' => $admin->id, 'recibio' => 'x', 'metodo_pago' => 'efectivo', 'tipo' => 'stock', 'vehiculo_id' => null]);
    Gasto::create(['fecha' => now(), 'monto' => 10, 'user_id' => $admin->id, 'recibio' => 'x', 'metodo_pago' => 'efectivo', 'tipo' => 'galpon', 'vehiculo_id' => null]);

    session(['active_company_id' => $emp1->id]);

    $response = $this->actingAs($admin)->get('/gastos');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('Gastos/Index')
        ->has('cards', 5)
        ->where('cards.0.total', 100)   // EMP_1: solo su vehículo
        ->where('cards.1.total', 50)    // EMP_2: solo su vehículo
        ->where('cards.2.total', 50)    // Kevin: kevin(30)+stock(20)
        ->where('cards.3.total', 10)    // Galpón: galpon(10)
        ->where('cards.4.total', 210)   // General: todo
        ->has('ultimosGlobales', 5)
        ->has('gastos', 5)
        ->has('patentes', 2)              // ambas empresas
    );
});
