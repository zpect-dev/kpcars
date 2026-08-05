<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\SincronizarMultasAction;
use Illuminate\Console\Command;

/**
 * Baja el feed externo de multas y actualiza la tabla `actas`. Corre a diario
 * (ver routes/console.php) y también puede dispararse a mano o desde la vista.
 */
class SincronizarMultas extends Command
{
    protected $signature = 'multas:sincronizar {--url= : Sobrescribe la URL del feed}';

    protected $description = 'Sincroniza las multas desde el feed externo (resolvetusmultas)';

    public function handle(SincronizarMultasAction $action): int
    {
        $this->info('Sincronizando multas desde el feed…');

        try {
            $r = $action->fetch($this->option('url') ?: null);
        } catch (\Throwable $e) {
            $this->error('Falló la sincronización: '.$e->getMessage());

            return self::FAILURE;
        }

        if ($r['snapshot'] === null) {
            $this->warn('El feed no trajo snapshots válidos.');

            return self::SUCCESS;
        }

        $this->info(sprintf(
            'Snapshot %s → %d procesadas · %d nuevas · %d resueltas · %d reabiertas',
            $r['snapshot'], $r['procesadas'], $r['nuevas'], $r['resueltas'], $r['reabiertas'],
        ));

        return self::SUCCESS;
    }
}
