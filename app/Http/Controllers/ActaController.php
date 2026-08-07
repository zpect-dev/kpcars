<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\SincronizarMultasAction;
use App\Enums\ActaEstado;
use App\Models\Acta;
use App\Models\ActaPago;
use App\Models\Multa;
use App\Models\MultaSyncRun;
use App\Models\Scopes\TenantScope;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Módulo experimental de multas alimentado por el feed externo. Convive con el
 * MultaController (registro manual) mientras se valida la transición.
 */
class ActaController extends Controller
{
    /**
     * Cuántos días de actas resueltas se mandan a la vista. Las vigentes van
     * completas (son la deuda actual, acotada por la flota); las resueltas se
     * acumulan para siempre, así que solo se muestran las recientes para no
     * inflar el payload sin techo.
     */
    private const DIAS_RESUELTAS = 90;

    public function index(): Response
    {
        Gate::authorize('view-multas');

        // Set de multas manuales (vehiculo|fecha|monto) para detectar la misma
        // infracción cargada a mano y por el feed durante la transición.
        $manualKeys = Multa::query()
            ->whereNotNull('vehiculo_id')
            ->get(['vehiculo_id', 'fecha', 'monto'])
            ->mapWithKeys(fn (Multa $m) => [
                $this->dupKey($m->vehiculo_id, $m->fecha?->toDateString(), (float) $m->monto) => true,
            ])
            ->all();

        $actas = Acta::query()
            ->with([
                'vehiculo' => fn ($q) => $q
                    ->withoutGlobalScope(TenantScope::class)
                    ->select('id', 'patente', 'marca', 'modelo'),
                'conductor:id,name',
                'pagos',
            ])
            // Vigentes completas + resueltas recientes (ver DIAS_RESUELTAS).
            ->where(fn ($q) => $q
                ->where('estado', ActaEstado::Vigente->value)
                ->orWhere(fn ($q2) => $q2
                    ->where('estado', ActaEstado::Resuelta->value)
                    ->whereDate('resuelta_en', '>=', today()->subDays(self::DIAS_RESUELTAS))))
            ->orderBy('patente')
            ->orderByRaw('fecha_infraccion IS NULL, fecha_infraccion DESC')
            ->get()
            ->map(fn (Acta $a) => [
                'id' => $a->id,
                'patente' => $a->patente,
                'jurisdiccion' => $a->jurisdiccion,
                'acta' => $a->acta,
                'motivo' => $a->motivo,
                'monto' => $a->monto !== null ? (float) $a->monto : null,
                'fecha_infraccion' => $a->fecha_infraccion?->toDateString(),
                'fecha_vencimiento' => $a->fecha_vencimiento?->toDateString(),
                'estado' => $a->estado->value,
                'resuelta_en' => $a->resuelta_en?->toDateString(),
                'vista_primera_en' => $a->vista_primera_en?->toDateString(),
                'vehiculo' => $a->vehiculo
                    ? trim("{$a->vehiculo->marca} {$a->vehiculo->modelo}")
                    : null,
                'conductor_id' => $a->conductor_id,
                'conductor' => $a->conductor?->name,
                // Posible duplicado de una multa cargada a mano (misma unidad,
                // fecha y monto). No se fusiona: solo se avisa en la vista.
                'posible_duplicado' => $a->vehiculo_id !== null
                    && $a->monto !== null
                    && isset($manualKeys[$this->dupKey($a->vehiculo_id, $a->fecha_infraccion?->toDateString(), (float) $a->monto)]),
                // Clasificación por vencimiento/monto.
                'pago_voluntario' => $a->esPagoVoluntario(),
                'punto_rojo' => $a->esPuntoRojo(),
                // Cobro al chofer (independiente del estado en el organismo).
                'sin_importe' => $a->sinImporte(),
                'monto_efectivo' => $a->sinImporte() ? 0.0 : $a->montoACobrar(),
                'cobrado' => $a->cobrado,
                'cobrada_en' => $a->cobrada_en?->toDateString(),
                'monto_cobrado' => (float) $a->monto_cobrado,
                'adeudado' => $a->montoAdeudado(),
                'pagos' => $a->pagos->map(fn (ActaPago $p) => [
                    'id' => $p->id,
                    'fecha' => $p->fecha?->toDateString(),
                    'monto' => (float) $p->monto,
                    'comprobante_url' => $p->comprobante_path ? Storage::disk('public')->url($p->comprobante_path) : null,
                    'con_deposito' => $p->con_deposito,
                ])->values(),
            ]);

        $stats = [
            'vigentes' => Acta::vigente()->count(),
            'resueltas' => Acta::resuelta()->count(),
            'monto_vigente' => (float) Acta::vigente()->sum('monto'),
            'bsas' => Acta::vigente()->where('jurisdiccion', 'BSAS')->count(),
            'caba' => Acta::vigente()->where('jurisdiccion', 'CABA')->count(),
        ];

        return Inertia::render('Actas/Index', [
            'actas' => $actas,
            'stats' => $stats,
            'ultimoSnapshot' => Acta::max('snapshot_fecha'),
            'diasResueltas' => self::DIAS_RESUELTAS,
            'ultimaSync' => $this->ultimaSync(),
        ]);
    }

    /**
     * Dispara la sincronización manual desde la vista ("Sincronizar ahora").
     */
    public function sincronizar(SincronizarMultasAction $action): RedirectResponse
    {
        Gate::authorize('view-multas');

        try {
            $r = $action->fetch(origen: 'manual');
        } catch (\Throwable $e) {
            return back()->with('error', 'No se pudo sincronizar con el feed: '.$e->getMessage());
        }

        if ($r['locked'] ?? false) {
            return back()->with('warning', 'Ya hay una sincronización en curso. Probá de nuevo en unos segundos.');
        }

        if ($r['snapshot'] === null) {
            return back()->with('error', 'El feed no devolvió datos válidos.');
        }

        return back()->with('success', sprintf(
            'Sincronizado (%s): %d nuevas, %d resueltas.',
            $r['snapshot'], $r['nuevas'], $r['resueltas'],
        ));
    }

    /**
     * Registra un pago del chofer para un acta (parcial o total), con su fecha y
     * comprobante opcional. El acta queda cobrada cuando la suma de pagos alcanza
     * el total a cobrar. Con ?reset se borran todos los pagos. Espeja el cobro de
     * las multas manuales.
     */
    public function registrarCobro(Request $request, Acta $acta): RedirectResponse
    {
        Gate::authorize('manage-multas');

        // Reiniciar el cobro (deshacer): borra todos los pagos y sus comprobantes.
        if ($request->boolean('reset')) {
            foreach ($acta->pagos as $pago) {
                if ($pago->comprobante_path) {
                    Storage::disk('public')->delete($pago->comprobante_path);
                }
            }
            $acta->pagos()->delete();
            $acta->update(['cobrado' => false, 'cobrada_en' => null, 'monto_cobrado' => 0]);

            return back()->with('success', 'Cobro reiniciado.');
        }

        // Sin importe (CABA sin monto informado): no hay nada que cobrar.
        if ($acta->sinImporte()) {
            return back()->with('error', 'Esta multa no tiene importe informado para cobrar.');
        }

        $validated = $request->validate([
            'monto' => ['required', 'numeric', 'min:0.01'],
            'fecha_cobro' => ['required', 'date'],
            'comprobante' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'con_deposito' => ['boolean'],
        ]);

        $acta->pagos()->create([
            'monto' => $validated['monto'],
            'fecha' => $validated['fecha_cobro'],
            'comprobante_path' => $request->hasFile('comprobante')
                ? $request->file('comprobante')->store('comprobantes-actas', 'public')
                : null,
            'con_deposito' => $validated['con_deposito'] ?? false,
            'registrado_por' => $request->user()->id,
        ]);

        $completo = $this->recomputarCobro($acta);

        if ($completo) {
            return back()->with('success', 'Multa cobrada por completo.');
        }

        $falta = max(round($acta->montoACobrar() - (float) $acta->monto_cobrado, 2), 0);

        return back()->with('success', 'Pago parcial registrado. Falta $'.number_format($falta, 2, ',', '.').'.');
    }

    /**
     * Elimina un pago puntual del chofer y recalcula el estado del cobro.
     */
    public function eliminarPago(Request $request, Acta $acta, ActaPago $pago): RedirectResponse
    {
        Gate::authorize('manage-multas');

        abort_unless($pago->acta_id === $acta->id, 404);

        if ($pago->comprobante_path) {
            Storage::disk('public')->delete($pago->comprobante_path);
        }
        $pago->delete();

        $this->recomputarCobro($acta);

        return back()->with('success', 'Pago eliminado.');
    }

    /**
     * Recalcula monto_cobrado / cobrado / cobrada_en a partir de los pagos.
     * Devuelve si el acta quedó cobrada por completo.
     */
    private function recomputarCobro(Acta $acta): bool
    {
        $suma = round((float) $acta->pagos()->sum('monto'), 2);
        $total = $acta->montoACobrar();
        $completo = $suma > 0 && $suma + 0.001 >= $total;

        $acta->update([
            'monto_cobrado' => $suma,
            'cobrado' => $completo,
            'cobrada_en' => $suma > 0 ? $acta->pagos()->max('fecha') : null,
        ]);

        return $completo;
    }

    /** Clave de deduplicación contra las multas manuales. */
    private function dupKey(?int $vehiculoId, ?string $fecha, float $monto): string
    {
        return $vehiculoId.'|'.$fecha.'|'.number_format($monto, 2, '.', '');
    }

    /**
     * Última corrida de sincronización para mostrar estado/errores en la vista.
     *
     * @return array<string,mixed>|null
     */
    private function ultimaSync(): ?array
    {
        $run = MultaSyncRun::query()->latest('id')->first();

        if ($run === null) {
            return null;
        }

        return [
            'ok' => $run->ok,
            'origen' => $run->origen,
            'error' => $run->error,
            'cuando' => $run->created_at?->toIso8601String(),
        ];
    }
}
