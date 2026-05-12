<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Asignacion;
use App\Models\User;
use App\Models\Vehiculo;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Spatie\SimpleExcel\SimpleExcelReader;

class ImportAsignacionesAction
{
    public function execute(string $filePath, string $extension = '', ?int $asignadoPorId = null): void
    {
        $rows = SimpleExcelReader::create($filePath, $extension)->getRows();
        $asignadoPorId = $asignadoPorId ?? auth()->id();

        DB::transaction(function () use ($rows, $asignadoPorId) {
            $rows->each(function (array $rawRow) use ($asignadoPorId) {
                // Ensure keys are lowercase and trimmed to handle case-insensitivity and accidental spaces
                $row = collect($rawRow)->mapWithKeys(function ($value, $key) {
                    return [trim(strtolower((string) $key)) => $value];
                })->toArray();

                $patente = $row['patente'] ?? null;
                $chofer = $row['chofer'] ?? null;
                $fechaInicioStr = $row['fecha_inicio'] ?? null;
                $fechaFinStr = $row['fecha_fin'] ?? null;

                if (! $patente || ! $chofer) {
                    \Illuminate\Support\Facades\Log::warning('Skipping row due to missing patente or chofer', ['row' => $row]);
                    return; // Skip if no patente or chofer
                }

                $patente = strtoupper(trim((string) $patente));
                $chofer = trim((string) $chofer);

                $vehiculo = Vehiculo::where('patente', $patente)->first();

                // Prefer exact name match; fallback to LIKE only if no exact match found
                $conductor = User::where('name', $chofer)->first()
                    ?? User::where('name', 'LIKE', '%'.$chofer.'%')->first();

                if (! $vehiculo) {
                    \Illuminate\Support\Facades\Log::warning("Vehículo not found for patente: {$patente}");
                }
                
                if (! $conductor) {
                    \Illuminate\Support\Facades\Log::warning("Conductor not found for chofer: {$chofer}");
                }

                if ($vehiculo && $conductor) {
                    $fechaInicio = $this->parseDate($fechaInicioStr);
                    $fechaFin = $this->parseDate($fechaFinStr);

                    Asignacion::create([
                        'vehiculo_id' => $vehiculo->id,
                        'conductor_id' => $conductor->id,
                        'asignado_por' => $asignadoPorId,
                        'fecha_inicio' => $fechaInicio,
                        'fecha_fin' => $fechaFin,
                    ]);
                    
                    \Illuminate\Support\Facades\Log::info("Asignacion created for patente {$patente} and chofer {$chofer}");
                }
            });
        });
    }

    private function parseDate(mixed $date): ?Carbon
    {
        if (empty($date)) {
            return null;
        }

        if ($date instanceof \DateTimeInterface) {
            return Carbon::instance($date);
        }

        try {
            // Excel dates might be standard strings if not formatted as Date in the spreadsheet
            return Carbon::parse((string) $date);
        } catch (\Exception $e) {
            return null;
        }
    }
}
