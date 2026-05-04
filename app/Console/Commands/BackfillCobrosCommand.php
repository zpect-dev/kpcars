<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Cobro;
use App\Models\Transaccion;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillCobrosCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'cobros:backfill';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generar cobros retroactivos para todas las transacciones históricas de egreso (OUT).';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $this->info('Iniciando la generación de cobros retroactivos...');

        // Obtenemos los IDs de transacciones que ya tienen un cobro generado
        $existingTransaccionIds = DB::table('cobros')->pluck('transaccion_id')->toArray();

        // Buscamos transacciones OUT que no tengan cobro, que tengan vehículo 
        // y que la patente no sea EXTERNO
        $transacciones = Transaccion::with('vehiculo')
            ->where('tipo', 'OUT')
            ->whereNotNull('vehiculo_id')
            ->whereHas('vehiculo', function ($query) {
                $query->where('patente', '!=', 'EXTERNO')
                      ->whereNotNull('inversion_id')
                      ->whereNotNull('empresa_id');
            })
            ->when(!empty($existingTransaccionIds), function ($query) use ($existingTransaccionIds) {
                $query->whereNotIn('id', $existingTransaccionIds);
            })
            // Procesamos por chunks para no desbordar la memoria si hay miles de registros
            ->chunk(500, function ($chunk) {
                DB::transaction(function () use ($chunk) {
                    $insertData = [];
                    $now = now();

                    foreach ($chunk as $transaccion) {
                        // Verificamos de nuevo por seguridad
                        if ($transaccion->vehiculo && $transaccion->vehiculo->inversion_id && $transaccion->vehiculo->empresa_id) {
                            $insertData[] = [
                                'inversion_id' => $transaccion->vehiculo->inversion_id,
                                'transaccion_id' => $transaccion->id,
                                'empresa_id' => $transaccion->vehiculo->empresa_id,
                                // Importante: usamos la fecha actual para que caigan como "pendientes" en el próximo cierre
                                'created_at' => $now,
                                'updated_at' => $now,
                            ];
                        }
                    }

                    if (!empty($insertData)) {
                        Cobro::insert($insertData);
                        $this->info('Procesados ' . count($insertData) . ' cobros...');
                    }
                });
            });

        $this->info("Generación finalizada exitosamente.");
        $this->info("Ahora todos los consumos históricos aparecen en la vista de Cobros.");
        $this->info("Puedes ir a la plataforma y ejecutar el 'Cierre de Caja' para consolidarlos.");
    }
}
