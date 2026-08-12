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
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Collection;
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

    /** Cuántas corridas de sincronización se listan como reportes en la vista. */
    private const REPORTES_LIMITE = 20;

    public function index(Request $request): Response
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
                    'es_transferencia' => $p->es_transferencia,
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

            // Reportes: una fila por corrida de sincronización, con lo que movió.
            'reportes' => fn () => $this->reportes(),

            // Detalle de un reporte puntual. Es un prop parcial: el frontend lo
            // pide (`only: ['reporteDetalle']`) recién al desplegar una fila, así
            // no viaja el detalle de las 20 corridas en cada carga.
            // Con un id que ya no existe (link viejo) simplemente no hay detalle:
            // la vista muestra la lista sin desplegar nada.
            'reporteDetalle' => function () use ($request): ?array {
                $run = $request->filled('reporte')
                    ? MultaSyncRun::find((int) $request->query('reporte'))
                    : null;

                return $run !== null ? $this->detalleReporte($run) : null;
            },
        ]);
    }

    /**
     * PDF del reporte de una corrida: altas, pagadas al organismo, cobros del
     * período y desglose por chofer y por vehículo.
     */
    public function reportePdf(MultaSyncRun $run): HttpResponse
    {
        Gate::authorize('view-multas');

        $reporte = $this->detalleReporte($run);

        $pdf = Pdf::loadView('pdf.actas-reporte', ['r' => $reporte]);
        $pdf->setPaper('a4', 'landscape');

        $fecha = $run->created_at?->format('Ymd-Hi') ?? 'sin-fecha';

        return $pdf->download("reporte-multas-{$fecha}.pdf");
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
            'Sincronizado (%s): %d nuevas por $%s, %d pagadas al organismo. Deuda vigente $%s.',
            $r['snapshot'],
            $r['nuevas'],
            number_format($r['monto_nuevas'], 2, ',', '.'),
            $r['resueltas'],
            number_format($r['deuda_vigente'], 2, ',', '.'),
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
            'es_transferencia' => ['boolean'],
        ]);

        $acta->pagos()->create([
            'monto' => $validated['monto'],
            'fecha' => $validated['fecha_cobro'],
            'comprobante_path' => $request->hasFile('comprobante')
                ? $request->file('comprobante')->store('comprobantes-actas', 'public')
                : null,
            'es_transferencia' => $validated['es_transferencia'] ?? false,
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

    /**
     * Reportes: una fila por corrida de sincronización, con lo que movió.
     *
     * A cada corrida se le imputan además los cobros a choferes registrados
     * DESDE esa corrida y hasta la siguiente, así los pagos del día caen en el
     * reporte más reciente en lugar de quedar fuera de todos.
     *
     * @return array<int,array<string,mixed>>
     */
    private function reportes(): array
    {
        $runs = MultaSyncRun::query()->latest('id')->limit(self::REPORTES_LIMITE)->get()->values();

        if ($runs->isEmpty()) {
            return [];
        }

        // Los cobros de todo el rango en una sola query; se reparten por ventana
        // en memoria (una query por corrida serían 20).
        $pagos = ActaPago::query()
            ->where('created_at', '>=', $runs->last()->created_at)
            ->get(['id', 'monto', 'created_at']);

        return $runs->map(function (MultaSyncRun $run, int $i) use ($runs, $pagos) {
            // La corrida siguiente (más nueva) cierra la ventana; la última
            // abierta llega hasta ahora.
            $cobros = $this->pagosDeLaVentana($pagos, $run->created_at, $runs->get($i - 1)?->created_at);

            return [
                'id' => $run->id,
                'cuando' => $run->created_at?->toIso8601String(),
                'origen' => $run->origen,
                'ok' => $run->ok,
                'error' => $run->error,
                'snapshot' => $run->snapshot_fecha?->toDateString(),
                'nuevas' => $run->nuevas,
                'monto_nuevas' => (float) $run->monto_nuevas,
                'resueltas' => $run->resueltas,
                'monto_resueltas' => (float) $run->monto_resueltas,
                'reabiertas' => $run->reabiertas,
                'deuda_vigente' => (float) $run->deuda_vigente,
                'pagos' => $cobros->count(),
                'cobrado' => round((float) $cobros->sum('monto'), 2),
                // Corrida que no movió nada: la vista la muestra apagada.
                'sin_movimiento' => $run->ok && ! $run->tieneReporte() && $cobros->isEmpty(),
            ];
        })->all();
    }

    /**
     * Detalle de un reporte: qué actas entraron, cuáles se pagaron en el
     * organismo, qué cobró la empresa en el período y el desglose por chofer y
     * por vehículo.
     *
     * @return array<string,mixed>
     */
    private function detalleReporte(MultaSyncRun $run): array
    {
        // Fin de la ventana de cobros: el arranque de la corrida siguiente.
        $hasta = MultaSyncRun::query()->where('id', '>', $run->id)->orderBy('id')->value('created_at');
        $desde = $run->created_at;

        $nuevas = Acta::query()
            ->with('conductor:id,name')
            ->where('sync_run_id', $run->id)
            ->orderBy('patente')
            ->get();

        $resueltas = Acta::query()
            ->with('conductor:id,name')
            ->where('resuelta_run_id', $run->id)
            ->orderBy('patente')
            ->get();

        $pagos = ActaPago::query()
            ->with(['acta:id,patente,conductor_id,monto,monto_cobrado,cobrado', 'acta.conductor:id,name'])
            ->when($desde !== null, fn ($q) => $q->where('created_at', '>=', $desde))
            ->when($hasta !== null, fn ($q) => $q->where('created_at', '<', $hasta))
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->get();

        // Deuda actual de cada unidad, para cerrar el desglose con el saldo.
        $vigentes = Acta::query()->vigente()->get(['id', 'conductor_id', 'patente', 'monto', 'monto_cobrado', 'cobrado']);

        $cobrado = round((float) $pagos->sum('monto'), 2);

        return [
            'run' => [
                'id' => $run->id,
                'cuando' => $run->created_at?->toIso8601String(),
                'origen' => $run->origen,
                'ok' => $run->ok,
                'error' => $run->error,
                'snapshot' => $run->snapshot_fecha?->toDateString(),
            ],
            'periodo' => [
                'desde' => $desde?->toIso8601String(),
                'hasta' => $hasta?->toIso8601String(),
            ],
            'totales' => [
                'nuevas' => $run->nuevas,
                'monto_nuevas' => (float) $run->monto_nuevas,
                'resueltas' => $run->resueltas,
                'monto_resueltas' => (float) $run->monto_resueltas,
                'reabiertas' => $run->reabiertas,
                'deuda_vigente' => (float) $run->deuda_vigente,
                'pagos' => $pagos->count(),
                'cobrado' => $cobrado,
            ],
            'nuevas' => $nuevas->map(fn (Acta $a) => $this->filaActa($a))->all(),
            'resueltas' => $resueltas->map(fn (Acta $a) => $this->filaActa($a))->all(),
            'cobros' => $pagos->map(fn (ActaPago $p) => [
                'id' => $p->id,
                'fecha' => $p->fecha?->toDateString(),
                'registrado_en' => $p->created_at?->toIso8601String(),
                'monto' => (float) $p->monto,
                'es_transferencia' => $p->es_transferencia,
                'patente' => $p->acta?->patente,
                'conductor' => $p->acta?->conductor?->name,
            ])->all(),
            'por_chofer' => $this->desglose($nuevas, $pagos, $vigentes, 'chofer'),
            'por_vehiculo' => $this->desglose($nuevas, $pagos, $vigentes, 'vehiculo'),
        ];
    }

    /**
     * Desglose del movimiento por chofer o por vehículo: altas de la corrida,
     * cobros del período y lo que la unidad todavía adeuda hoy.
     *
     * Solo aparecen las unidades con movimiento en el reporte; el saldo se
     * agrega a esas filas (si no, la tabla sería la flota entera).
     *
     * @param  EloquentCollection<int,Acta>  $nuevas
     * @param  EloquentCollection<int,ActaPago>  $pagos
     * @param  EloquentCollection<int,Acta>  $vigentes
     * @return array<int,array<string,mixed>>
     */
    private function desglose(
        EloquentCollection $nuevas,
        EloquentCollection $pagos,
        EloquentCollection $vigentes,
        string $dimension,
    ): array {
        $filas = [];

        $tocar = function (string $label) use (&$filas): string {
            $filas[$label] ??= [
                'label' => $label,
                'nuevas' => 0,
                'monto_nuevas' => 0.0,
                'pagos' => 0,
                'cobrado' => 0.0,
                'adeuda' => 0.0,
            ];

            return $label;
        };

        foreach ($nuevas as $acta) {
            $k = $tocar($this->etiqueta($acta, $dimension));
            $filas[$k]['nuevas']++;
            $filas[$k]['monto_nuevas'] += (float) ($acta->monto ?? 0);
        }

        foreach ($pagos as $pago) {
            $acta = $pago->acta;

            if ($acta === null) {
                continue;
            }

            $k = $tocar($this->etiqueta($acta, $dimension));
            $filas[$k]['pagos']++;
            $filas[$k]['cobrado'] += (float) $pago->monto;
        }

        foreach ($vigentes as $acta) {
            $label = $this->etiqueta($acta, $dimension);

            if (isset($filas[$label])) {
                $filas[$label]['adeuda'] += $acta->montoAdeudado();
            }
        }

        $filas = array_map(fn (array $f) => [
            ...$f,
            'monto_nuevas' => round($f['monto_nuevas'], 2),
            'cobrado' => round($f['cobrado'], 2),
            'adeuda' => round($f['adeuda'], 2),
        ], $filas);

        usort($filas, fn (array $a, array $b) => [$b['monto_nuevas'], $b['cobrado']] <=> [$a['monto_nuevas'], $a['cobrado']]);

        return array_values($filas);
    }

    /** Nombre de la unidad del desglose para un acta. */
    private function etiqueta(Acta $acta, string $dimension): string
    {
        return $dimension === 'chofer'
            ? ($acta->conductor?->name ?? 'Sin chofer')
            : $acta->patente;
    }

    /**
     * Pagos registrados entre dos corridas: desde `$desde` (inclusive) hasta
     * `$hasta` (exclusivo); sin `$hasta`, la ventana sigue abierta.
     *
     * @param  Collection<int,ActaPago>  $pagos
     * @return Collection<int,ActaPago>
     */
    private function pagosDeLaVentana(Collection $pagos, ?CarbonInterface $desde, ?CarbonInterface $hasta): Collection
    {
        return $pagos->filter(fn (ActaPago $p) => $p->created_at !== null
            && ($desde === null || $p->created_at->greaterThanOrEqualTo($desde))
            && ($hasta === null || $p->created_at->lessThan($hasta)));
    }

    /**
     * Fila de un acta en el detalle del reporte.
     *
     * @return array<string,mixed>
     */
    private function filaActa(Acta $acta): array
    {
        return [
            'id' => $acta->id,
            'patente' => $acta->patente,
            'conductor' => $acta->conductor?->name,
            'jurisdiccion' => $acta->jurisdiccion,
            'acta' => $acta->acta,
            'motivo' => $acta->motivo,
            'monto' => $acta->monto !== null ? (float) $acta->monto : null,
            'fecha_infraccion' => $acta->fecha_infraccion?->toDateString(),
            'fecha_vencimiento' => $acta->fecha_vencimiento?->toDateString(),
            'adeudado' => $acta->montoAdeudado(),
        ];
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
