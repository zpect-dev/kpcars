<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\AbrirCajaAction;
use App\Actions\BuildResumenIntegradoAction;
use App\Actions\ProcessCierreCajaAction;
use App\Models\AperturaCaja;
use App\Models\CierreCaja;
use App\Models\CierreGasto;
use App\Models\Cobro;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Inversion;
use App\Models\Scopes\TenantScope;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class CobroController extends Controller
{
    /**
     * Display the cobros dashboard.
     */
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Cobro::class);

        // Cobro auto-scopea por empresa activa vía TenantScope.
        $resumen = Cobro::query()
            ->pendientes()
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('inversiones', 'cobros.inversion_id', '=', 'inversiones.id')
            ->join('empresas', 'cobros.empresa_id', '=', 'empresas.id')
            ->selectRaw('
                cobros.inversion_id,
                cobros.empresa_id,
                inversiones.nombre as inversion_nombre,
                empresas.nombre as empresa_nombre,
                SUM(articulos.precio * transacciones.cantidad) as total,
                SUM((articulos.precio - COALESCE(articulos.costo, articulos.precio / 1.45)) * transacciones.cantidad) as ganancia,
                COUNT(cobros.id) as transacciones_count
            ')
            ->groupBy('cobros.inversion_id', 'cobros.empresa_id', 'inversiones.nombre', 'empresas.nombre')
            ->get()
            ->sortBy('inversion_nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->sortBy('empresa_nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $totalGeneral = $resumen->sum('total');
        $totalGanancia = $resumen->sum('ganancia');

        // Get the last cierre info
        $ultimoCierre = CierreCaja::with('user:id,name')
            ->latest()
            ->first();

        // Estado del período: apertura abierta de la empresa activa (TenantScope).
        $apertura = AperturaCaja::abierta()->with('user:id,name')->latest()->first();

        $empresaActiva = session('active_company_id');

        // Historical cierres con sus detalles, filtrados por la empresa activa.
        // cierreGasto: cierre de gastos hijo dentro del modelo unificado.
        $historialCierres = CierreCaja::with([
            'user:id,name',
            'detalles.inversion:id,nombre,empresa_id',
            'detalles.empresa:id,nombre',
            'cierreGasto:id,cierre_caja_id,total_general',
        ])
            ->when($empresaActiva, function ($q) use ($empresaActiva) {
                $q->whereHas('detalles', fn ($q2) => $q2->where('empresa_id', $empresaActiva));
            })
            ->latest()
            ->limit(20)
            ->get()
            ->map(function (CierreCaja $cierre) use ($empresaActiva) {
                $detalles = $cierre->detalles;

                if ($empresaActiva) {
                    $detalles = $detalles->filter(fn ($d) => $d->empresa_id === (int) $empresaActiva);
                }

                $detallesOrdenados = $detalles
                    ->map(fn ($d) => [
                        'inversion_id' => $d->inversion_id,
                        'empresa_id' => $d->empresa_id,
                        'inversion_nombre' => $d->inversion?->nombre ?? 'N/A',
                        'empresa_nombre' => $d->empresa?->nombre ?? 'N/A',
                        'total' => $d->total,
                    ])
                    ->sortBy('inversion_nombre', SORT_NATURAL | SORT_FLAG_CASE)
                    ->sortBy('empresa_nombre', SORT_NATURAL | SORT_FLAG_CASE)
                    ->values();

                $totalCobros = (float) $detalles->sum('total');
                $totalGastos = (float) ($cierre->cierreGasto?->total_general ?? 0);

                return [
                    'id' => $cierre->id,
                    'user' => $cierre->user,
                    'total_cobros' => $totalCobros,
                    'total_gastos' => $totalGastos,
                    'total' => $totalCobros + $totalGastos,
                    'gasto_cierre_id' => $cierre->cierreGasto?->id,
                    'detalles' => $detallesOrdenados,
                    'created_at' => $cierre->created_at,
                ];
            });

        // Cierres de gastos legacy: los que se cerraban por separado antes del
        // refactor (sin cierre_caja_id). Se conservan visibles en el historial.
        $historialGastosLegacy = CierreGasto::with('user:id,name')
            ->whereNull('cierre_caja_id')
            ->latest('periodo_fin')
            ->limit(20)
            ->get()
            ->map(fn (CierreGasto $c) => [
                'id' => $c->id,
                'user' => $c->user,
                'total' => (float) $c->total_general,
                'periodo_fin' => $c->periodo_fin?->toIso8601String(),
                'created_at' => $c->created_at,
            ]);

        $resumenIntegrado = app(BuildResumenIntegradoAction::class)->execute();

        return Inertia::render('Cobros/Index', [
            'abierta' => $apertura !== null,
            'apertura' => $apertura
                ? ['id' => $apertura->id, 'user' => $apertura->user, 'created_at' => $apertura->created_at]
                : null,
            'resumen' => $resumen,
            'totalGeneral' => $totalGeneral,
            'totalGanancia' => $totalGanancia,
            // Total de TODOS los gastos pendientes (flota + no-flota) para el cierre.
            'totalGastos' => (float) Gasto::query()->pendientes()->sum('monto'),
            'gastosResumen' => $this->buildGastosResumen(),
            'ultimoCierre' => $ultimoCierre,
            'historialCierres' => $historialCierres,
            'historialGastosLegacy' => $historialGastosLegacy,
            'resumenIntegrado' => $resumenIntegrado,
            'totalIntegrado' => $resumenIntegrado->sum('total'),
        ]);
    }

    /**
     * Resumen de los gastos pendientes NO-flota del período (galpón, taller,
     * oficina, kevin, stock). Los gastos de flota (tipo 'vehiculo') no van acá:
     * se muestran anclados a cada vehículo en la pestaña de inventario, vía el
     * resumen integrado. Estructurado igual que la página /gastos (cards +
     * últimos + lista por categoría), pero de solo lectura.
     */
    private function buildGastosResumen(?string $desde = null, ?string $hasta = null): array
    {
        $historico = $hasta !== null;

        $gastos = Gasto::query()
            ->when(! $historico, fn ($q) => $q->pendientes())
            ->when($historico && $desde, fn ($q) => $q->where('gastos.created_at', '>', $desde))
            ->when($historico, fn ($q) => $q->where('gastos.created_at', '<=', $hasta))
            ->where('tipo', '!=', 'vehiculo')
            ->with('user:id,name')
            ->latest('fecha')
            ->latest('id')
            ->get();

        // Reparto de los gastos globales (galpón/taller/oficina) entre empresas,
        // según distribucion_empresas. Igual criterio que la página /gastos, pero
        // acotado a los gastos no-flota del panel de Cobros.
        $globales = $gastos->whereIn('tipo', Gasto::TIPOS_GLOBALES);

        $empresaCards = Empresa::orderBy('id')
            ->get(['id', 'nombre'])
            ->map(fn (Empresa $emp) => [
                'key' => 'empresa_'.$emp->id,
                'label' => $emp->nombre,
                'total' => (float) $globales->sum(
                    fn (Gasto $g) => (float) (($g->distribucion_empresas ?? [])[$emp->id] ?? 0),
                ),
            ])
            ->values()
            ->all();

        $cards = array_merge($empresaCards, [
            [
                'key' => 'kevin',
                'label' => 'Kevin',
                'total' => (float) $gastos->whereIn('tipo', ['kevin', 'stock'])->sum(fn (Gasto $g) => (float) $g->monto),
            ],
            [
                'key' => 'galpon',
                'label' => 'Galpón',
                'total' => (float) $gastos->whereIn('tipo', ['galpon', 'taller', 'oficina'])->sum(fn (Gasto $g) => (float) $g->monto),
            ],
        ]);

        $lista = $gastos->map(fn (Gasto $g) => [
            'id' => $g->id,
            'fecha' => $g->fecha?->format('Y-m-d'),
            'monto' => (float) $g->monto,
            'recibio' => $g->recibio,
            'metodo_pago' => $g->metodo_pago,
            'descripcion' => $g->descripcion,
            'tipo' => $g->tipo,
            'registrado_por' => $g->user?->name,
        ])->values();

        return [
            'cards' => $cards,
            'total' => (float) $gastos->sum(fn (Gasto $g) => (float) $g->monto),
            'gastos' => $lista,
            'ultimos' => $lista->take(10)->values(),
            'count' => $gastos->count(),
        ];
    }

    /**
     * Display the detail breakdown for a specific inversion.
     */
    public function show(Request $request, int $inversion): Response
    {
        $this->authorize('viewAny', Cobro::class);

        // Se resuelve la inversión sin TenantScope porque una inversión de
        // empresa A puede tener cobros en empresa B. La seguridad la garantiza
        // el TenantScope de Cobro: sólo se muestran cobros de la empresa activa.
        $inversionModel = Inversion::withoutGlobalScope(TenantScope::class)
            ->findOrFail($inversion);

        $baseQuery = Cobro::query()
            ->pendientes()
            ->where('cobros.inversion_id', $inversionModel->id);

        // Get breakdown by vehicle for this inversion
        $desglose = (clone $baseQuery)
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->selectRaw('
                vehiculos.id as vehiculo_id,
                vehiculos.patente,
                vehiculos.marca,
                vehiculos.modelo,
                SUM(articulos.precio * transacciones.cantidad) as subtotal
            ')
            ->groupBy('vehiculos.id', 'vehiculos.patente', 'vehiculos.marca', 'vehiculos.modelo')
            ->orderBy('vehiculos.patente')
            ->get();

        // Get individual transactions for this inversion in current period
        $transacciones = (clone $baseQuery)
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->select([
                'transacciones.id',
                'vehiculos.patente',
                'articulos.descripcion as articulo',
                'transacciones.cantidad',
                'articulos.precio as precio_unitario',
            ])
            ->selectRaw('articulos.precio * transacciones.cantidad as subtotal')
            ->orderByDesc('transacciones.created_at')
            ->get();

        $totalInversion = $desglose->sum('subtotal');

        return Inertia::render('Cobros/Show', [
            'inversion' => $inversionModel->only('id', 'nombre'),
            'desglose' => $desglose,
            'transacciones' => $transacciones,
            'totalInversion' => $totalInversion,
        ]);
    }

    /**
     * Return the vehicle breakdown for a specific inversion within a historical cierre.
     */
    public function cierreDesglose(Request $request, CierreCaja $cierre)
    {
        $this->authorize('viewAny', Cobro::class);

        $inversionId = $request->integer('inversion_id');
        $empresaId = $request->integer('empresa_id');

        abort_if($inversionId <= 0 || $empresaId <= 0, 422, 'Parámetros inválidos.');

        // El payload incluye empresa_id porque el endpoint es invocado desde el
        // historial (que muestra empresas mezcladas). Validamos contra la empresa
        // activa de la sesión.
        $empresaActiva = session('active_company_id');
        if ($empresaActiva !== null) {
            abort_unless($empresaId === (int) $empresaActiva, 403);
        }

        $previousCierreDate = CierreCaja::where('created_at', '<', $cierre->created_at)
            ->latest()
            ->value('created_at');

        // Cobro auto-scopea por empresa activa; el where adicional es por seguridad explícita.
        $baseQuery = Cobro::query()
            ->where('cobros.inversion_id', $inversionId)
            ->where('cobros.empresa_id', $empresaId)
            ->where('cobros.created_at', '<=', $cierre->created_at)
            ->when($previousCierreDate, fn ($q) => $q->where('cobros.created_at', '>', $previousCierreDate));

        $desglose = (clone $baseQuery)
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->selectRaw('
                vehiculos.id as vehiculo_id,
                vehiculos.patente,
                vehiculos.marca,
                vehiculos.modelo,
                SUM(articulos.precio * transacciones.cantidad) as subtotal
            ')
            ->groupBy('vehiculos.id', 'vehiculos.patente', 'vehiculos.marca', 'vehiculos.modelo')
            ->orderBy('vehiculos.patente')
            ->get();

        $transacciones = (clone $baseQuery)
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->select([
                'transacciones.id',
                'vehiculos.patente',
                'articulos.descripcion as articulo',
                'transacciones.cantidad',
                'articulos.precio as precio_unitario',
            ])
            ->selectRaw('articulos.precio * transacciones.cantidad as subtotal')
            ->orderByDesc('transacciones.created_at')
            ->get();

        return response()->json([
            'desglose' => $desglose,
            'transacciones' => $transacciones,
        ]);
    }

    /**
     * Historial: lista de cierres de caja de la empresa activa, con sus totales.
     * Cada uno enlaza a la réplica de solo lectura (historialShow).
     */
    public function historial(Request $request): Response
    {
        $this->authorize('viewAny', Cobro::class);

        $empresaActiva = session('active_company_id');

        $cierres = CierreCaja::with([
            'user:id,name',
            'detalles:id,cierre_id,empresa_id,total',
            'cierreGasto:id,cierre_caja_id,total_general',
        ])
            ->when($empresaActiva, function ($q) use ($empresaActiva) {
                $q->whereHas('detalles', fn ($q2) => $q2->where('empresa_id', $empresaActiva));
            })
            ->latest()
            ->get()
            ->map(function (CierreCaja $cierre) use ($empresaActiva) {
                $detalles = $empresaActiva
                    ? $cierre->detalles->where('empresa_id', (int) $empresaActiva)
                    : $cierre->detalles;

                $totalCobros = (float) $detalles->sum('total');
                $totalGastos = (float) ($cierre->cierreGasto?->total_general ?? 0);

                return [
                    'id' => $cierre->id,
                    'user' => $cierre->user,
                    'total_cobros' => $totalCobros,
                    'total_gastos' => $totalGastos,
                    'total' => $totalCobros + $totalGastos,
                    'created_at' => $cierre->created_at?->toIso8601String(),
                ];
            })
            ->values();

        return Inertia::render('Cobros/Historial', [
            'cierres' => $cierres,
        ]);
    }

    /**
     * Réplica de solo lectura de la vista de Cobros para un cierre puntual.
     * Reconstruye los mismos datos que index() pero acotados al período del
     * cierre (rango de fecha: cierre anterior exclusivo → este cierre inclusivo),
     * y renderiza el mismo componente Cobros/Index con la meta `historico`.
     */
    public function historialShow(Request $request, CierreCaja $cierre): Response
    {
        $this->authorize('viewAny', Cobro::class);

        // El cierre debe pertenecer a la empresa activa (tener detalles en ella).
        $empresaActiva = session('active_company_id');
        if ($empresaActiva !== null) {
            abort_unless(
                $cierre->detalles()->where('empresa_id', (int) $empresaActiva)->exists(),
                403,
            );
        }

        $hasta = $cierre->created_at->toDateTimeString();
        $desde = CierreCaja::where('created_at', '<', $cierre->created_at)
            ->latest()
            ->value('created_at')?->toDateTimeString();

        // Resumen de cobros por inversión/empresa del período (misma forma que index).
        $resumen = Cobro::query()
            ->when($desde, fn ($q) => $q->where('cobros.created_at', '>', $desde))
            ->where('cobros.created_at', '<=', $hasta)
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('inversiones', 'cobros.inversion_id', '=', 'inversiones.id')
            ->join('empresas', 'cobros.empresa_id', '=', 'empresas.id')
            ->selectRaw('
                cobros.inversion_id,
                cobros.empresa_id,
                inversiones.nombre as inversion_nombre,
                empresas.nombre as empresa_nombre,
                SUM(articulos.precio * transacciones.cantidad) as total,
                SUM((articulos.precio - COALESCE(articulos.costo, articulos.precio / 1.45)) * transacciones.cantidad) as ganancia,
                COUNT(cobros.id) as transacciones_count
            ')
            ->groupBy('cobros.inversion_id', 'cobros.empresa_id', 'inversiones.nombre', 'empresas.nombre')
            ->get()
            ->sortBy('inversion_nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->sortBy('empresa_nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $gastosResumen = $this->buildGastosResumen($desde, $hasta);
        $resumenIntegrado = app(BuildResumenIntegradoAction::class)->execute($desde, $hasta);

        return Inertia::render('Cobros/Index', [
            'abierta' => false,
            'apertura' => null,
            'resumen' => $resumen,
            'totalGeneral' => (float) $resumen->sum('total'),
            'totalGanancia' => (float) $resumen->sum('ganancia'),
            'totalGastos' => (float) $gastosResumen['total'],
            'gastosResumen' => $gastosResumen,
            'ultimoCierre' => null,
            'historialCierres' => [],
            'historialGastosLegacy' => [],
            'resumenIntegrado' => $resumenIntegrado,
            'totalIntegrado' => (float) $resumenIntegrado->sum('total'),
            'historico' => [
                'id' => $cierre->id,
                'fecha' => $cierre->created_at?->toIso8601String(),
                'user' => $cierre->user()->first(['id', 'name']),
            ],
        ]);
    }

    /**
     * Abre un nuevo período unificado de caja (cobros + gastos).
     */
    public function abrir(Request $request, AbrirCajaAction $action): RedirectResponse
    {
        $this->authorize('abrirCaja', Cobro::class);

        try {
            $action->execute($request->user());
        } catch (RuntimeException $e) {
            return redirect()->back()->with('warning', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Período de caja abierto.');
    }

    /**
     * Ejecuta el cierre unificado: congela cobros de inventario y gastos juntos.
     */
    public function cierreCaja(Request $request, ProcessCierreCajaAction $action): RedirectResponse
    {
        $this->authorize('cierreCaja', Cobro::class);

        try {
            $action->execute($request->user());
        } catch (RuntimeException $e) {
            return redirect()->back()->with('warning', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Cierre de caja ejecutado correctamente.');
    }
}
