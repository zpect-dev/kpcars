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
        User::create([
            'name' => 'Test User',
            'dni' => '12345678',
            'password' => bcrypt('password'),
            'role' => 'chofer',
        ]);

        $this->call([
            EmpresaSeeder::class,
            InversionSeeder::class,
            VehiculoSeeder::class,
        ]);
    }
}
