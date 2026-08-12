<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\RegistrarMovimientoCajaChicaAction;
use App\Actions\RevertirMovimientoCajaChicaAction;
use App\Enums\CajaChicaMovimientoTipo;
use App\Models\CajaChicaMovimiento;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Caja chica: fondo único y global del que salen los gastos.
 *
 * Funciona como una cuenta bancaria: sólo se agregan movimientos con su fecha,
 * nunca se reemplaza el saldo. Los errores se corrigen con contraasientos y los
 * descuentos automáticos se deshacen borrando el gasto que los generó.
 */
class CajaChicaController extends Controller
{
    /** Alta de un movimiento manual: ingreso, retiro o ajuste. */
    public function store(Request $request, RegistrarMovimientoCajaChicaAction $registrar): RedirectResponse
    {
        $this->authorize('create', CajaChicaMovimiento::class);

        $tiposManuales = collect(CajaChicaMovimientoTipo::cases())
            ->filter(fn (CajaChicaMovimientoTipo $t) => $t->esManual())
            ->map(fn (CajaChicaMovimientoTipo $t) => $t->value)
            ->all();

        $validated = $request->validate([
            'tipo' => ['required', Rule::in($tiposManuales)],
            // El ajuste admite monto negativo (corrección hacia abajo); el resto
            // de los tipos define el signo por su tipo.
            'monto' => ['required', 'numeric', 'between:-99999999999.99,99999999999.99'],
            'fecha' => ['required', 'date'],
            'nota' => ['nullable', 'string', 'max:255'],
        ]);

        $tipo = CajaChicaMovimientoTipo::from($validated['tipo']);

        if ($tipo === CajaChicaMovimientoTipo::AJUSTE && trim((string) ($validated['nota'] ?? '')) === '') {
            throw ValidationException::withMessages([
                'nota' => 'Indicá el motivo del ajuste.',
            ]);
        }

        try {
            $registrar->execute(
                tipo: $tipo,
                monto: (float) $validated['monto'],
                fecha: Carbon::parse($validated['fecha'])->toDateString(),
                nota: $validated['nota'] ?? null,
            );
        } catch (Throwable $e) {
            throw ValidationException::withMessages(['monto' => $e->getMessage()]);
        }

        return back()->with('success', 'Movimiento registrado en la caja chica.');
    }

    /** Contraasiento de un movimiento ya registrado (no se borra el original). */
    public function revertir(Request $request, CajaChicaMovimiento $movimiento, RevertirMovimientoCajaChicaAction $revertir): RedirectResponse
    {
        $this->authorize('revertir', $movimiento);

        $validated = $request->validate([
            'nota' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $revertir->execute($movimiento, $validated['nota'] ?? null);
        } catch (Throwable $e) {
            throw ValidationException::withMessages(['nota' => $e->getMessage()]);
        }

        return back()->with('success', 'Movimiento revertido con un contraasiento.');
    }
}
