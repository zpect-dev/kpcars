<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Articulo;
use App\Support\GeneradorCodigoArticulo;
use Illuminate\Console\Command;

/**
 * Dry-run: muestra qué código generaría cada artículo (familia + iniciales),
 * resolviendo colisiones con sufijo. No escribe nada.
 */
class PreviewCodigosArticulo extends Command
{
    protected $signature = 'articulos:preview-codigos {--limit=0 : Máximo de filas (0 = todas)}';

    protected $description = 'Muestra el código que se autogeneraría para cada artículo (sin escribir).';

    public function handle(): int
    {
        $limit = (int) $this->option('limit');

        $articulos = Articulo::orderBy('descripcion')
            ->when($limit > 0, fn ($q) => $q->limit($limit))
            ->get(['id', 'descripcion', 'repuestos']);

        if ($articulos->isEmpty()) {
            $this->warn('No hay artículos en la base.');

            return self::SUCCESS;
        }

        // Se calculan los dos esquemas en paralelo para poder compararlos.
        $usadosLargo = [];
        $usadosCorto = [];
        $largoMax = 0;

        $filas = $articulos->map(function (Articulo $a) use (&$usadosLargo, &$usadosCorto, &$largoMax) {
            $mnemonico = GeneradorCodigoArticulo::unico(
                $a->descripcion,
                fn (string $c) => isset($usadosLargo[$c]),
            );
            $usadosLargo[$mnemonico] = true;

            $corto = GeneradorCodigoArticulo::corto(
                $a->descripcion,
                fn (string $c) => isset($usadosCorto[$c]),
            );
            $usadosCorto[$corto] = true;

            $largoMax = max($largoMax, strlen($corto));

            return [
                $corto,
                $mnemonico,
                $a->repuestos ? 'Repuesto' : 'Galpón',
                mb_strimwidth($a->descripcion, 0, 46, '…'),
            ];
        })->all();

        $this->table(['Corto', 'Mnemónico', 'Zona', 'Descripción'], $filas);
        $this->info(sprintf(
            '%d artículos · %d cortos únicos (máx %d chars) · %d mnemónicos únicos.',
            count($filas),
            count($usadosCorto),
            $largoMax,
            count($usadosLargo),
        ));

        return self::SUCCESS;
    }
}
