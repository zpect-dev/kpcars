<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Articulo;
use App\Models\CierreCaja;
use App\Models\CierreInversion;
use App\Models\CierreInversionPago;
use App\Models\Cobro;
use App\Models\DeudaMovimiento;
use App\Models\Transaccion;
use App\Models\Vehiculo;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PdfController extends Controller
{
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
            'vehiculo' => fn ($q) => $q->withoutGlobalScope(\App\Models\Scopes\TenantScope::class),
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
    public function cobros(Request $request): Response
    {
        // Acceso: middleware role:administrador.
        // Cobro auto-scopea por empresa activa (TenantScope); no requiere filtro manual.
        $cobros = \App\Models\Cobro::query()
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
     * Generate PDF for a cierre de inversión.
     */
    public function cierreInversion(Request $request, CierreInversion $cierreInversion): Response
    {
        // Acceso: middleware role:administrador.

        $cierreInversion->load([
            'ejecutadoPor:id,name',
            'recaudaciones.inversion:id,nombre',
            'pagos.user:id,name,dni',
            'pagos.inversion:id,nombre',
        ]);

        $recaudaciones = $cierreInversion->recaudaciones
            ->sortBy(fn ($r) => (string) $r->inversion?->nombre, SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $porInversor = $cierreInversion->pagos
            ->groupBy('user_id')
            ->map(fn ($pagos) => [
                'user' => $pagos->first()->user,
                'pagos' => $pagos,
            ])
            ->sortBy(fn ($row) => mb_strtolower((string) $row['user']->name))
            ->values();

        $cierre = $cierreInversion;

        $pdf = Pdf::loadView('pdf.cierre-inversion', compact('cierre', 'recaudaciones', 'porInversor'))
            ->setPaper('a4', 'landscape');

        return $pdf->download('cierre-inversion-'.$cierre->id.'-'.$cierre->periodo_fin->format('Y-m-d').'.pdf');
    }

    /**
     * Generate PDF for the current user's Mi Cuenta.
     */
    public function miCuenta(Request $request): Response
    {
        // Acceso: middleware role:inversor. El Gate valida que tenga inversiones.
        \Illuminate\Support\Facades\Gate::authorize('view-mi-cuenta');

        $user = $request->user();

        // Vista cross-empresa para el inversor (idem MiCuentaController).
        $inversiones = $user->inversiones()
            ->withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->get()
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->map(function ($inv) use ($user) {
                $movimientos = DeudaMovimiento::where('inversion_id', $inv->id)
                    ->where('user_id', $user->id)
                    ->get();

                $saldo = (float) $movimientos->reduce(
                    fn (float $carry, DeudaMovimiento $m) => $m->tipo === 'cargo'
                        ? $carry + (float) $m->monto
                        : $carry - (float) $m->monto,
                    0.0,
                );

                return [
                    'nombre' => $inv->nombre,
                    'tiene_deuda' => (bool) $inv->pivot->tiene_deuda,
                    'es_financiador' => (bool) $inv->pivot->es_financiador,
                    'saldo' => $saldo,
                ];
            });

        $pagosPorCierre = CierreInversionPago::with([
            'cierre' => fn ($q) => $q->withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                ->select('id', 'periodo_inicio', 'periodo_fin', 'tasa'),
        ])
            ->where('user_id', $user->id)
            ->orderByDesc('cierre_id')
            ->get()
            ->groupBy('cierre_id');

        $cierres = $pagosPorCierre->map(function ($pagos) {
            $cierre = $pagos->first()->cierre;

            return [
                'id' => $cierre?->id,
                'periodo_fin' => $cierre?->periodo_fin?->toIso8601String(),
                'tasa' => $cierre?->tasa ? (float) $cierre->tasa : null,
                'detalles' => $pagos->map(fn ($p) => [
                    'concepto' => $p->concepto,
                    'monto' => (float) $p->monto,
                ])->values(),
            ];
        })->values();

        $tasaActual = CierreInversion::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->latest('periodo_fin')
            ->value('tasa');
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
        $filters = $request->only(['inversion_id', 'search', 'asignacion']);
        $search = trim((string) ($filters['search'] ?? ''));
        $asignacion = $filters['asignacion'] ?? null;

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
            ->get()
            ->sortBy('patente', SORT_NATURAL | SORT_FLAG_CASE)
            ->sortBy(fn ($v) => $v->inversion?->nombre ?? '', SORT_NATURAL | SORT_FLAG_CASE)
            ->sortBy(fn ($v) => $v->empresa?->nombre ?? '', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $pdf = Pdf::loadView('pdf.vehiculos', compact('vehiculos'))
            ->setPaper('a4', 'landscape');

        return $pdf->download('vehiculos-'.now()->format('Y-m-d').'.pdf');
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
