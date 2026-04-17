<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\ServiceType;
use Illuminate\Database\Seeder;

class ServiceTypeSeeder extends Seeder
{
    public function run(): void
    {
        $services = [
            [
                'name' => 'Básico',
                'description' => 'Servicios rápidos: cambio de aceite, revisión de luces.',
                'required_slots' => 1,
            ],
            [
                'name' => 'Medio',
                'description' => 'Mantenimiento intermedio: frenos, suspensión.',
                'required_slots' => 3,
            ],
            [
                'name' => 'Complejo',
                'description' => 'Reparaciones mayores: ajuste de motor, caja.',
                'required_slots' => 5,
            ],
        ];

        foreach ($services as $service) {
            ServiceType::updateOrCreate(
                ['name' => $service['name']],
                $service,
            );
        }
    }
}
