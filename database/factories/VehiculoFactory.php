<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Vehiculo;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Vehiculo> */
class VehiculoFactory extends Factory
{
    protected $model = Vehiculo::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'patente' => strtoupper(fake()->unique()->bothify('???###')),
            'marca' => fake()->randomElement(['Toyota', 'Ford', 'Chevrolet', 'Volkswagen']),
            'modelo' => fake()->randomElement(['Corolla', 'Focus', 'Cruze', 'Gol']),
            'anio' => (string) fake()->numberBetween(2018, 2026),
            'propietario' => fake()->name(),
        ];
    }
}
