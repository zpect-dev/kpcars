<?php

namespace Database\Seeders;

use App\Models\Empresa;
use Illuminate\Database\Seeder;

class EmpresaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Empresa::create(['nombre' => 'EMP_1']);
        Empresa::create(['nombre' => 'EMP_2']);
    }
}
