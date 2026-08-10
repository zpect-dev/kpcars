<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\RevertirMovimientoDepositoAction;
use App\Enums\DepositoMovimientoTipo;
use App\Models\UserDepositoMovimiento;
use Illuminate\Console\Command;

/**
 * Revierte TODOS los descuentos de depósito por multa (DESCUENTO_MULTA) que
 * todavía no fueron contraasentados, devolviéndole el saldo a cada chofer.
 *
 * Se eliminó el "pago con depósito": los cobros que lo usaron descontaron mal la
 * garantía del chofer. Este comando deshace esos descuentos (append-only: cada
 * uno se corrige con un contraasiento, el original nunca se borra).
 *
 * Por defecto corre en SECO (no escribe). Con --apply aplica. Es idempotente:
 * los ya revertidos se saltan, así que se puede correr de nuevo sin duplicar.
 */
class RevertirDepositosMultas extends Command
{
    protected $signature = 'multas:revertir-depositos {--apply : Aplica la reversa (sin este flag corre en seco)}';

    protected $description = 'Revierte los descuentos de depósito por multa y devuelve el saldo al chofer.';

    public function handle(RevertirMovimientoDepositoAction $revertir): int
    {
        $apply = (bool) $this->option('apply');

        // Originales (no contraasientos) de tipo DESCUENTO_MULTA que aún no se revirtieron.
        $movimientos = UserDepositoMovimiento::query()
            ->where('tipo', DepositoMovimientoTipo::DESCUENTO_MULTA->value)
            ->whereNull('revierte_id')
            ->whereDoesntHave('reversion')
            ->get();

        $total = round((float) $movimientos->sum(fn (UserDepositoMovimiento $m) => (float) $m->monto), 2);

        $this->info(sprintf(
            '%d movimiento(s) DESCUENTO_MULTA a revertir. Saldo a devolver: $%s (afecta a %d chofer/es).',
            $movimientos->count(),
            number_format(abs($total), 2, ',', '.'),
            $movimientos->pluck('user_id')->unique()->count(),
        ));

        if ($movimientos->isEmpty()) {
            $this->info('Nada para revertir.');

            return self::SUCCESS;
        }

        if (! $apply) {
            $this->warn('Modo SECO: no se escribió nada. Volvé a correr con --apply para aplicar.');

            return self::SUCCESS;
        }

        $ok = 0;
        foreach ($movimientos as $movimiento) {
            try {
                $revertir->execute(
                    $movimiento,
                    'Reversa masiva: se eliminó el pago con depósito. Saldo devuelto al chofer.',
                    null,
                );
                $ok++;
            } catch (\Throwable $e) {
                $this->error("Movimiento #{$movimiento->id}: {$e->getMessage()}");
            }
        }

        $this->info("Listo. {$ok} movimiento(s) revertido(s).");

        return self::SUCCESS;
    }
}
