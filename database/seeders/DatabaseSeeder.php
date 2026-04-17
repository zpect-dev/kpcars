<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::factory()->create([
            'name' => 'Test User',
            'dni' => '12345678',
            'password' => bcrypt('password'),
        ]);

        $this->call([
            EmpresaSeeder::class,
            VehiculoSeeder::class,
            ServiceTypeSeeder::class,
        ]);
    }
}
