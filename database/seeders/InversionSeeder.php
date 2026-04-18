<?php

namespace Database\Seeders;

use App\Models\Inversion;
use Illuminate\Database\Seeder;

class InversionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Inversion::create(['nombre' => 'INV_1']);
        Inversion::create(['nombre' => 'INV_2']);
        Inversion::create(['nombre' => 'INV_3']);
        Inversion::create(['nombre' => 'INV_4']);
        Inversion::create(['nombre' => 'INV_5']);
        Inversion::create(['nombre' => 'INV_6']);
        Inversion::create(['nombre' => 'INV_7']);
        Inversion::create(['nombre' => 'INV_8']);
        Inversion::create(['nombre' => 'INV_9']);
        Inversion::create(['nombre' => 'INV_10']);
    }
}
