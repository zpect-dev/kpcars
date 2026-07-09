<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\BuildResumenIntegradoAction;
use App\Models\AperturaRecaudacion;
use App\Models\Appointment;
use App\Models\Articulo;
use App\Models\CierreCaja;
use App\Models\CierreGasto;
use App\Models\CierreRecaudacion;
use App\Models\CierreSueldo;
use App\Models\CierreSueldoPago;
use App\Models\Cobro;
use App\Models\Empresa;
use App\Models\Gasto;
use App\Models\Recaudacion;
use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use App\Models\Transaccion;
use App\Models\Vehiculo;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class PdfController extends Controller
{
    /**
     * PDF con todos los gastos pendientes (todas las empresas), con el mismo
     * formato que la tabla "Últimos 10 gastos": fecha, descripción, categoría,
     * patente y monto.
     */
    public function gastos(Request $request): Response
    {
        // Acceso: middleware role:administrador. Vista GLOBAL, igual que
        // GastoController@index: ignora la empresa activa y muestra los gastos
        // aún sin cierre de todas las empresas.
        $gastos = Gasto::query()
            ->withoutGlobalScope(GastoTenantScope::class)
            ->pendientes()
            ->with([
                'vehiculo' => fn ($q) => $q
                    ->withoutGlobalScope(TenantScope::class)
                    ->select('id', 'patente'),
            ])
            ->latest('fecha')
            ->latest('id')
            ->get();

        $tipoLabels = [
            'galpon' => 'Galpón',
            'taller' => 'Taller',
            'oficina' => 'Oficina',
            'kevin' => 'Kevin',
            'stock' => 'Stock',
            'vehiculo' => 'Vehículo',
        ];

        $filas = $gastos->map(fn (Gasto $g) => [
            'fecha' => $g->fecha?->format('d/m/Y'),
            'descripcion' => trim((string) $g->descripcion) !== '' ? $g->descripcion : 'Sin descripción',
            'categoria' => $tipoLabels[$g->tipo] ?? ucfirst((string) $g->tipo),
            'patente' => $g->vehiculo?->patente ?? '—',
            'monto' => (float) $g->monto,
        ]);

        $total = (float) $gastos->sum(fn (Gasto $g) => (float) $g->monto);

        $pdf = Pdf::loadView('pdf.gastos', compact('filas', 'total'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('gastos-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * PDF de los gastos (sin flota) del panel de Cobros. Respeta la empresa
     * activa. Si se pasa un cierre, exporta los gastos de ese período histórico
     * (rango de fecha); si no, los del período actual (pendientes).
     */
    public function cobrosGastos(Request $request, ?CierreCaja $cierre = null): Response
    {
        $historico = $cierre !== null;

        if ($historico) {
            // El cierre debe pertenecer a la empresa activa.
            $empresaActiva = session('active_company_id');
            if ($empresaActiva !== null) {
                abort_unless(
                    $cierre->detalles()->where('empresa_id', (int) $empresaActiva)->exists(),
                    403,
                );
            }
        }

        $hasta = $historico ? $cierre->created_at->toDateTimeString() : null;
        $desde = $historico
            ? CierreCaja::where('created_at', '<', $cierre->created_at)->latest()->value('created_at')?->toDateTimeString()
            : null;

        // Scopeado por empresa activa vía GastoTenantScope (igual que el panel).
        $gastos = Gasto::query()
            ->when(! $historico, fn ($q) => $q->pendientes())
            ->when($historico && $desde, fn ($q) => $q->where('gastos.created_at', '>', $desde))
            ->when($historico, fn ($q) => $q->where('gastos.created_at', '<=', $hasta))
            ->where('gastos.tipo', '!=', 'vehiculo')
            ->latest('fecha')
            ->latest('id')
            ->get();

        $tipoLabels = [
            'galpon' => 'Galpón',
            'taller' => 'Taller',
            'oficina' => 'Oficina',
            'kevin' => 'Kevin',
            'stock' => 'Stock',
        ];

        $filas = $gastos->map(fn (Gasto $g) => [
            'fecha' => $g->fecha?->format('d/m/Y'),
            'descripcion' => trim((string) $g->descripcion) !== '' ? $g->descripcion : 'Sin descripción',
            'categoria' => $tipoLabels[$g->tipo] ?? ucfirst((string) $g->tipo),
            'patente' => '—',
            'monto' => (float) $g->monto,
        ]);

        $total = (float) $gastos->sum(fn (Gasto $g) => (float) $g->monto);

        $nombre = $historico
            ? 'gastos-cierre-'.$cierre->id
            : 'gastos-'.now()->format('Y-m-d');

        $pdf = Pdf::loadView('pdf.gastos', compact('filas', 'total'))
            ->setPaper('a4', 'portrait');

        return $pdf->download($nombre.'.pdf');
    }

    /**
     * PDF de un cierre de gastos con desglose por tipo y por patente.
     */
    public function cierreGasto(Request $request, CierreGasto $cierreGasto): Response
    {
        // Acceso: middleware role:administrador.
        $cierreGasto->load('user:id,name');

        ['porTipo' => $porTipo, 'porVehiculo' => $porVehiculo] = $cierreGasto->desglose();

        $cierre = $cierreGasto;

        $pdf = Pdf::loadView('pdf.cierre-gasto', compact('cierre', 'porTipo', 'porVehiculo'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('cierre-gastos-'.$cierre->id.'-'.$cierre->periodo_fin->format('Y-m-d').'.pdf');
    }

    /**
     * PDF del período actual de recaudaciones, agrupado por inversión.
     */
    public function recaudacionesActuales(Request $request): Response
    {
        $apertura = AperturaRecaudacion::abierta()
            ->with([
                'recaudaciones.vehiculo:id,patente,inversion_id',
                'recaudaciones.vehiculo.inversion:id,nombre',
                'recaudaciones.chofer:id,name',
            ])
            ->latest()
            ->first();

        $filas = ($apertura?->recaudaciones ?? collect())
            ->map(fn (Recaudacion $r) => [
                'inversion' => $r->vehiculo?->inversion?->nombre ?? 'Sin inversión',
                'patente'   => $r->vehiculo?->patente ?? 'N/A',
                'chofer'    => $r->chofer?->name ?? 'N/A',
                'efectivo'  => (float) $r->efectivo,
                'transf'    => (float) $r->transferencia,
                'total'     => (float) $r->total,
                'estado'    => $r->total >= max((float) $r->precio - (float) $r->descuento, 0) ? 'Pagado' : 'Deuda',
            ])
            ->sortBy([['inversion', SORT_NATURAL], ['patente', SORT_NATURAL]])
            ->values();

        $porInversion = $filas->groupBy('inversion')->sortKeys(SORT_NATURAL | SORT_FLAG_CASE);
        $totalEfectivo = $filas->sum('efectivo');
        $totalTransferencia = $filas->sum('transf');
        $totalGeneral = $filas->sum('total');

        $pdf = Pdf::loadView('pdf.recaudaciones-periodo-actual', compact('porInversion', 'totalEfectivo', 'totalTransferencia', 'totalGeneral'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('recaudaciones-periodo-actual-'.now()->format('Y-m-d').'.pdf');
    }

    public function recaudacionesDescuentos(): Response
    {
        $apertura = AperturaRecaudacion::abierta()
            ->with([
                'recaudaciones.vehiculo:id,patente,inversion_id',
                'recaudaciones.vehiculo.inversion:id,nombre',
                'recaudaciones.chofer:id,name',
            ])
            ->latest()
            ->first();

        $filas = ($apertura?->recaudaciones ?? collect())
            ->filter(fn (Recaudacion $r) => (float) $r->descuento > 0)
            ->map(fn (Recaudacion $r) => [
                'inversion'   => $r->vehiculo?->inversion?->nombre ?? 'Sin inversión',
                'patente'     => $r->vehiculo?->patente ?? 'N/A',
                'chofer'      => $r->chofer?->name ?? 'N/A',
                'descuento'   => (float) $r->descuento,
                'descripcion' => $r->descripcion ?? '',
                'estado'      => $r->total >= max((float) $r->precio - (float) $r->descuento, 0) ? 'Pagado' : 'Deuda',
            ])
            ->sortBy([['inversion', SORT_NATURAL], ['patente', SORT_NATURAL]])
            ->groupBy('inversion');

        $totalDescuentos = $filas->flatten(1)->sum('descuento');

        $pdf = Pdf::loadView('pdf.recaudaciones-descuentos', compact('filas', 'totalDescuentos'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('recaudaciones-descuentos-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Generate PDF with current stock of all articles.
     */
    public function stock(Request $request): Response
    {
        // Acceso: middleware role:administrador,administrativo,mecanico.
        $articulos = Articulo::orderBy('descripcion')->get();

        $pdf = Pdf::loadView('pdf.stock', compact('articulos'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('stock-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Generate PDF with transaction history, respecting current filters.
     */
    public function transactions(Request $request): Response
    {
        // Acceso: middleware role:administrador,administrativo.
        // Inventario es global: el historial abarca todas las empresas.
        $filters = $request->only(['article', 'plate', 'applicant', 'from', 'to']);
        $articleId = $filters['article'] ?? null;

        $transactions = Transaccion::with([
            'articulo',
            'vehiculo' => fn ($q) => $q->withoutGlobalScope(TenantScope::class),
            'user',
        ])
            ->filterByItem($articleId ? (int) $articleId : null)
            ->searchByPlate($filters['plate'] ?? null)
            ->searchByApplicant($filters['applicant'] ?? null)
            ->filterByDate($filters['from'] ?? null, $filters['to'] ?? null)
            ->latest()
            ->get();

        $viewData = compact('transactions', 'filters');

        if ($articleId) {
            $articulo = Articulo::find((int) $articleId);
            if ($articulo) {
                $viewData['articleName'] = $articulo->descripcion;
                $viewData['articleStock'] = $articulo->stock;
            }
        }

        $pdf = Pdf::loadView('pdf.transactions', $viewData)
            ->setPaper('a4', 'landscape');

        return $pdf->download('transacciones-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Generate PDF with appointments, respecting current filters.
     */
    public function appointments(Request $request): Response
    {
        $filters = $request->only(['from', 'to', 'status', 'plate']);

        if (! $request->has('from') && ! $request->has('to')) {
            $filters['from'] = now()->toDateString();
            $filters['to'] = now()->toDateString();
        }

        $from = ! empty($filters['from']) ? Carbon::parse($filters['from'])->toDateString() : null;
        $to = ! empty($filters['to']) ? Carbon::parse($filters['to'])->toDateString() : null;

        $appointments = Appointment::with(['completedBy:id,name', 'conductor:id,name'])
            ->when($from, fn ($q) => $q->whereDate('scheduled_date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('scheduled_date', '<=', $to))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['plate']), fn ($q) => $q->where('license_plate', 'like', '%'.addcslashes($filters['plate'], '%_\\').'%'))
            ->orderBy('scheduled_date')
            ->orderBy('id')
            ->get();

        $pdf = Pdf::loadView('pdf.appointments', compact('appointments', 'filters'))
            ->setPaper('a4', 'landscape');

        return $pdf->download('turnos-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Generate PDF with pending cobros details grouped by inversion.
     */
    /**
     * PDF del resumen integrado: cobros + gastos de cada vehículo por inversión.
     */
    public function cobrosIntegrado(Request $request, BuildResumenIntegradoAction $action): Response
    {
        // Acceso: middleware role:administrador.
        $resumen = $action->execute();
        $total = $resumen->sum('total');

        $pdf = Pdf::loadView('pdf.cobros-integrado', compact('resumen', 'total'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('resumen-cobros-gastos-'.now()->format('Y-m-d').'.pdf');
    }

    public function cobros(Request $request): Response
    {
        // Acceso: middleware role:administrador.
        // Cobro auto-scopea por empresa activa (TenantScope); no requiere filtro manual.
        $cobros = Cobro::query()
            ->pendientes()
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->join('inversiones', 'cobros.inversion_id', '=', 'inversiones.id')
            ->select([
                'inversiones.nombre as inversion_nombre',
                'articulos.descripcion as articulo_descripcion',
                'vehiculos.patente',
                'transacciones.cantidad',
                'articulos.precio',
            ])
            ->selectRaw('articulos.precio * transacciones.cantidad as subtotal')
            ->orderBy('inversiones.nombre')
            ->get();

        // Group by inversion
        $inversiones = $cobros->groupBy('inversion_nombre');

        $pdf = Pdf::loadView('pdf.cobros', compact('inversiones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('cobros-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * PDF del cierre de sueldos: desglose por empresa → inversión → socio.
     */
    public function cierreSueldo(Request $request, CierreSueldo $cierreSueldo): Response
    {
        // Acceso: middleware role:administrador.

        $cierreSueldo->load([
            'ejecutadoPor:id,name',
            'cierresRecaudacion:id,empresa_id,cierre_sueldo_id',
            'pagos.user:id,name,dni',
            'pagos.inversion' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)
                ->select('id', 'nombre'),
            'abonos.user:id,name',
            'abonos.inversion' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)
                ->select('id', 'nombre'),
        ]);

        // Recaudado por inversión del período congelado por este cierre.
        $cierreRecIds = $cierreSueldo->cierresRecaudacion->pluck('id')->all();
        $recaudadoPorInversion = empty($cierreRecIds) ? collect() : \Illuminate\Support\Facades\DB::table('recaudaciones')
            ->whereIn('recaudaciones.cierre_id', $cierreRecIds)
            ->join('vehiculos', 'recaudaciones.vehiculo_id', '=', 'vehiculos.id')
            ->join('inversiones', 'vehiculos.inversion_id', '=', 'inversiones.id')
            ->groupBy('vehiculos.inversion_id', 'inversiones.nombre', 'inversiones.empresa_id')
            ->selectRaw('inversiones.nombre as nombre, inversiones.empresa_id as empresa_id, SUM(recaudaciones.total) as total')
            ->get();

        $empresas = Empresa::orderBy('id')->get()->map(function (Empresa $empresa) use ($cierreSueldo, $recaudadoPorInversion) {
            $pagosEmpresa = $cierreSueldo->pagos->where('empresa_id', $empresa->id);

            $porInversor = $pagosEmpresa
                ->groupBy('user_id')
                ->map(fn ($pagos) => [
                    'user' => $pagos->first()->user,
                    'total' => (float) $pagos->sum(fn (CierreSueldoPago $p) => (float) $p->monto),
                    'pagos' => $pagos
                        ->sortBy(fn (CierreSueldoPago $p) => (string) $p->inversion?->nombre, SORT_NATURAL | SORT_FLAG_CASE)
                        ->values(),
                ])
                ->sortBy(fn ($row) => mb_strtolower((string) $row['user']->name))
                ->values();

            $recaudaciones = $recaudadoPorInversion
                ->where('empresa_id', $empresa->id)
                ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
                ->values();

            return [
                'nombre' => $empresa->nombre,
                'recaudado' => (float) $recaudaciones->sum('total'),
                'distribuido' => (float) $porInversor->sum('total'),
                'recaudaciones' => $recaudaciones,
                'porInversor' => $porInversor,
            ];
        })->values();

        $cierre = $cierreSueldo;
        $abonos = $cierreSueldo->abonos
            ->sortBy(fn ($a) => mb_strtolower((string) $a->user?->name))
            ->values();

        $pdf = Pdf::loadView('pdf.cierre-sueldo', compact('cierre', 'empresas', 'abonos'))
            ->setPaper('a4', 'landscape');

        return $pdf->download('cierre-sueldo-'.$cierre->id.'-'.$cierre->created_at->format('Y-m-d').'.pdf');
    }

    /**
     * Generate PDF for the current user's Mi Cuenta.
     */
    public function miCuenta(Request $request): Response
    {
        // Acceso: middleware role:inversor. El Gate valida que tenga inversiones.
        Gate::authorize('view-mi-cuenta');

        $user = $request->user();

        // Vista cross-empresa para el inversor (idem MiCuentaController).
        $inversiones = $user->inversiones()
            ->withoutGlobalScope(TenantScope::class)
            ->get()
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->map(fn ($inv) => [
                'nombre' => $inv->nombre,
                'es_financiador' => (bool) $inv->pivot->es_financiador,
                'deuda' => (float) $inv->pivot->deuda,
            ]);

        $pagosPorCierre = CierreSueldoPago::with([
            'cierre:id,tasa,created_at',
            'inversion' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)
                ->select('id', 'nombre'),
        ])
            ->where('user_id', $user->id)
            ->orderByDesc('cierre_sueldo_id')
            ->get()
            ->groupBy('cierre_sueldo_id');

        $cierres = $pagosPorCierre->map(function ($pagos) {
            $cierre = $pagos->first()->cierre;

            return [
                'id' => $cierre?->id,
                'fecha' => $cierre?->created_at?->toIso8601String(),
                'tasa' => $cierre?->tasa ? (float) $cierre->tasa : null,
                'detalles' => $pagos->map(fn ($p) => [
                    'inversion' => $p->inversion?->nombre,
                    'concepto' => $p->concepto,
                    'monto' => (float) $p->monto,
                ])->values(),
            ];
        })->values();

        $tasaActual = CierreSueldo::latest('created_at')->value('tasa');
        $tasaActual = $tasaActual ? (float) $tasaActual : null;

        $pdf = Pdf::loadView('pdf.mi-cuenta', compact('user', 'inversiones', 'cierres', 'tasaActual'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('mi-cuenta-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Generate a plain spreadsheet-like PDF with the vehicles list, respecting filters.
     */
    public function vehiculos(Request $request): Response
    {
        // Acceso: middleware role:administrador,administrativo.
        // Refleja TODOS los filtros del dashboard de vehículos, incluidos los
        // avanzados (estado de patente, titular, VTV y GNC).
        $filters = $request->only(['inversion_id', 'search', 'asignacion', 'estado_patente', 'titular', 'vtv', 'gnc', 'seguro']);
        $search = trim((string) ($filters['search'] ?? ''));
        $asignacion = $filters['asignacion'] ?? null;
        $estadoPatente = $filters['estado_patente'] ?? null;
        $titular = trim((string) ($filters['titular'] ?? ''));
        $vtv = $filters['vtv'] ?? null;
        $gnc = $filters['gnc'] ?? null;
        $seguro = $filters['seguro'] ?? null;

        $vehiculos = Vehiculo::with(['user:id,name', 'inversion:id,nombre', 'empresa:id,nombre'])
            ->where('patente', '!=', 'EXTERNO')
            ->when(! empty($filters['inversion_id']), fn ($q) => $q->where('inversion_id', $filters['inversion_id']))
            ->when($search !== '', function ($q) use ($search) {
                $escaped = addcslashes($search, '%_\\');
                $q->where(function ($q2) use ($escaped) {
                    $q2->where('patente', 'like', "%{$escaped}%")
                        ->orWhereHas('user', fn ($q3) => $q3->where('name', 'like', "%{$escaped}%"));
                });
            })
            ->when($asignacion === 'con', fn ($q) => $q->whereNotNull('user_id'))
            ->when($asignacion === 'sin', fn ($q) => $q->whereNull('user_id'))
            ->when($estadoPatente === '__none__', fn ($q) => $q->whereNull('estado_patente'))
            ->when($estadoPatente && $estadoPatente !== '__none__', fn ($q) => $q->where('estado_patente', $estadoPatente))
            ->when($titular !== '', function ($q) use ($titular) {
                $escaped = addcslashes($titular, '%_\\');
                $q->where('propietario', 'like', "%{$escaped}%");
            })
            ->when($vtv === 'none', fn ($q) => $q->whereNull('fecha_vencimiento_vtv'))
            ->when($gnc === 'none', fn ($q) => $q->whereNull('fecha_vencimiento_gnc'))
            ->when($seguro === 'none', fn ($q) => $q->whereNull('seguro_vencimiento'))
            ->get();

        // VTV/GNC por estado (ok/warning/expired) se calcula sobre fin de mes,
        // igual que en el dashboard; se filtra en PHP para garantizar paridad.
        if ($vtv && $vtv !== 'none') {
            $vehiculos = $vehiculos->filter(
                fn (Vehiculo $v) => $this->vencimientoStatus($v->fecha_vencimiento_vtv) === $vtv
            );
        }
        if ($gnc && $gnc !== 'none') {
            $vehiculos = $vehiculos->filter(
                fn (Vehiculo $v) => $this->vencimientoStatus($v->fecha_vencimiento_gnc) === $gnc
            );
        }
        // El seguro vence en una fecha exacta (no fin de mes), igual que el dashboard.
        if ($seguro && $seguro !== 'none') {
            $vehiculos = $vehiculos->filter(
                fn (Vehiculo $v) => $this->seguroVencimientoStatus($v->seguro_vencimiento) === $seguro
            );
        }

        $vehiculos = $vehiculos
            ->sortBy('patente', SORT_NATURAL | SORT_FLAG_CASE)
            ->sortBy(fn ($v) => $v->inversion?->nombre ?? '', SORT_NATURAL | SORT_FLAG_CASE)
            ->sortBy(fn ($v) => $v->empresa?->nombre ?? '', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $pdf = Pdf::loadView('pdf.vehiculos', compact('vehiculos'))
            ->setPaper('a4', 'landscape');

        return $pdf->download('vehiculos-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Estado de un vencimiento (VTV/GNC) según el fin del mes almacenado.
     *
     * Replica la lógica de `vtvStatus` del dashboard:
     *  - expired: el vencimiento ya pasó (fin de mes < hoy).
     *  - warning: vence dentro del próximo mes.
     *  - ok: vence más allá.
     * Devuelve null si no hay fecha.
     */
    private function vencimientoStatus($fecha): ?string
    {
        if (! $fecha) {
            return null;
        }

        $vence = Carbon::parse($fecha)->endOfMonth()->startOfDay();
        $hoy = Carbon::now()->startOfDay();

        if ($vence->lt($hoy)) {
            return 'expired';
        }

        if ($vence->lte($hoy->copy()->addMonth())) {
            return 'warning';
        }

        return 'ok';
    }

    /**
     * Estado del seguro según su fecha de vencimiento exacta (no fin de mes).
     * Replica `seguroStatus` del dashboard.
     */
    private function seguroVencimientoStatus($fecha): ?string
    {
        if (! $fecha) {
            return null;
        }

        $vence = Carbon::parse($fecha)->startOfDay();
        $hoy = Carbon::now()->startOfDay();

        if ($vence->lt($hoy)) {
            return 'expired';
        }

        if ($vence->lte($hoy->copy()->addMonth())) {
            return 'warning';
        }

        return 'ok';
    }

    /**
     * Generate PDF with the current debtors of recaudaciones, grouped by inversion.
     */
    public function recaudacionesDeudores(Request $request): Response
    {
        // Acceso: middleware role:administrador. TenantScope scopea por empresa activa.
        // Lee de la apertura abierta (filas congeladas), no de los vehículos en vivo.
        $apertura = AperturaRecaudacion::abierta()
            ->with([
                'recaudaciones.vehiculo:id,patente,inversion_id',
                'recaudaciones.vehiculo.inversion:id,nombre',
                'recaudaciones.chofer:id,name',
            ])
            ->latest()
            ->first();

        $deudores = ($apertura?->recaudaciones ?? collect())
            ->map(function (Recaudacion $r) {
                $total = (float) $r->total;
                $precioEfectivo = max((float) $r->precio - (float) $r->descuento, 0);

                return [
                    'inversion_nombre' => $r->vehiculo?->inversion?->nombre ?? 'Sin inversión',
                    'patente' => $r->vehiculo?->patente ?? 'N/A',
                    'chofer' => $r->chofer?->name ?? 'N/A',
                    'recaudado' => $total,
                    'deuda' => max($precioEfectivo - $total, 0),
                ];
            })
            ->filter(fn ($d) => $d['deuda'] > 0)
            ->sortBy('patente', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $inversiones = $deudores
            ->groupBy('inversion_nombre')
            ->sortKeys(SORT_NATURAL | SORT_FLAG_CASE);

        $pdf = Pdf::loadView('pdf.recaudaciones-deudores', compact('inversiones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('recaudaciones-deudores-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Generate PDF with the debtors of a historical recaudacion closing.
     */
    public function recaudacionesDeudoresCierre(Request $request, CierreRecaudacion $cierreRecaudacion): Response
    {
        // Acceso: middleware role:administrador. TenantScope scopea el cierre.
        $cierreRecaudacion->load([
            'recaudaciones.vehiculo:id,patente,inversion_id',
            'recaudaciones.vehiculo.inversion:id,nombre',
            'recaudaciones.chofer:id,name',
        ]);

        $deudores = $cierreRecaudacion->recaudaciones
            ->map(function (Recaudacion $r) {
                $precioEfectivo = max((float) $r->precio - (float) $r->descuento, 0);

                return [
                    'inversion_nombre' => $r->vehiculo?->inversion?->nombre ?? 'Sin inversión',
                    'patente' => $r->vehiculo?->patente ?? 'N/A',
                    'chofer' => $r->chofer?->name ?? 'N/A',
                    'recaudado' => (float) $r->total,
                    'deuda' => max($precioEfectivo - (float) $r->total, 0),
                ];
            })
            ->filter(fn ($d) => $d['deuda'] > 0)
            ->sortBy('patente', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $inversiones = $deudores
            ->groupBy('inversion_nombre')
            ->sortKeys(SORT_NATURAL | SORT_FLAG_CASE);

        $pdf = Pdf::loadView('pdf.recaudaciones-deudores', compact('inversiones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('recaudaciones-deudores-cierre-'.$cierreRecaudacion->id.'.pdf');
    }

    /**
     * Generate PDF with the detail of a historical cierre de caja.
     */
    public function cierreCaja(Request $request, CierreCaja $cierre): Response
    {
        // Acceso: middleware role:administrador.

        $previousCierreDate = CierreCaja::where('created_at', '<', $cierre->created_at)
            ->latest()
            ->value('created_at');

        // Cobro auto-scopea por empresa activa vía TenantScope.
        $cobros = Cobro::query()
            ->where('cobros.created_at', '<=', $cierre->created_at)
            ->when($previousCierreDate, fn ($q) => $q->where('cobros.created_at', '>', $previousCierreDate))
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->join('inversiones', 'cobros.inversion_id', '=', 'inversiones.id')
            ->join('empresas', 'cobros.empresa_id', '=', 'empresas.id')
            ->select([
                'empresas.nombre as empresa_nombre',
                'inversiones.nombre as inversion_nombre',
                'articulos.descripcion as articulo_descripcion',
                'vehiculos.patente',
                'transacciones.cantidad',
                'articulos.precio',
            ])
            ->selectRaw('articulos.precio * transacciones.cantidad as subtotal')
            ->get();

        // Group naturally: empresa -> inversion -> rows
        $empresas = $cobros
            ->groupBy('empresa_nombre')
            ->sortKeys(SORT_NATURAL | SORT_FLAG_CASE)
            ->map(function ($empresaCobros) {
                return $empresaCobros
                    ->groupBy('inversion_nombre')
                    ->sortKeys(SORT_NATURAL | SORT_FLAG_CASE);
            });

        $cierre->load('user:id,name');

        $pdf = Pdf::loadView('pdf.cierre-caja', compact('cierre', 'empresas'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('cierre-caja-'.$cierre->id.'-'.$cierre->created_at->format('Y-m-d').'.pdf');
    }
}
