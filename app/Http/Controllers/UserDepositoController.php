<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\RegistrarMovimientoDepositoAction;
use App\Actions\RevertirMovimientoDepositoAction;
use App\Enums\DepositoMoneda;
use App\Enums\DepositoMovimientoTipo;
use App\Models\User;
use App\Models\UserDepositoMovimiento;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Cuenta de depósito (garantía) del chofer.
 *
 * Funciona como una cuenta bancaria: sólo se agregan movimientos con su fecha,
 * nunca se reemplaza el saldo. Los errores se corrigen con contraasientos.
 */
class UserDepositoController extends Controller
{
    /** Alta de un movimiento manual: ingreso, retiro o ajuste. */
    public function store(Request $request, User $user, RegistrarMovimientoDepositoAction $registrar): RedirectResponse
    {
        $this->authorize('update', $user);

        $tiposManuales = collect(DepositoMovimientoTipo::cases())
            ->filter(fn (DepositoMovimientoTipo $t) => $t->esManual())
            ->map(fn (DepositoMovimientoTipo $t) => $t->value)
            ->all();

        $validated = $request->validate([
            'tipo' => ['required', Rule::in($tiposManuales)],
            'moneda' => ['required', Rule::enum(DepositoMoneda::class)],
            // El ajuste admite monto negativo (corrección hacia abajo); el resto
            // de los tipos define el signo por su tipo.
            'monto' => ['required', 'numeric', 'between:-99999999999.99,99999999999.99'],
            'fecha' => ['required', 'date'],
            'nota' => ['nullable', 'string', 'max:255'],
        ]);

        $tipo = DepositoMovimientoTipo::from($validated['tipo']);

        if ($tipo === DepositoMovimientoTipo::AJUSTE && trim((string) ($validated['nota'] ?? '')) === '') {
            throw ValidationException::withMessages([
                'nota' => 'Indicá el motivo del ajuste.',
            ]);
        }

        try {
            $registrar->execute(
                user: $user,
                tipo: $tipo,
                moneda: DepositoMoneda::from($validated['moneda']),
                monto: (float) $validated['monto'],
                fecha: Carbon::parse($validated['fecha'])->toDateString(),
                nota: $validated['nota'] ?? null,
            );
        } catch (Throwable $e) {
            throw ValidationException::withMessages(['monto' => $e->getMessage()]);
        }

        return redirect()->back()->with('success', 'Movimiento registrado en la cuenta de depósito.');
    }

    /** Contraasiento de un movimiento ya registrado (no se borra el original). */
    public function revertir(Request $request, User $user, UserDepositoMovimiento $movimiento, RevertirMovimientoDepositoAction $revertir): RedirectResponse
    {
        $this->authorize('update', $user);

        abort_unless($movimiento->user_id === $user->id, 404);

        $validated = $request->validate([
            'nota' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $revertir->execute($movimiento, $validated['nota'] ?? null);
        } catch (Throwable $e) {
            throw ValidationException::withMessages(['nota' => $e->getMessage()]);
        }

        return redirect()->back()->with('success', 'Movimiento revertido con un contraasiento.');
    }
}
