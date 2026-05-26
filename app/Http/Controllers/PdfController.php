<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Articulo;
use App\Models\CierreCaja;
use App\Models\Cobro;
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
        abort_if($request->user()->isInversor(), 403);

        $articulos = Articulo::orderBy('descripcion')->get();

        $pdf = Pdf::loadView('pdf.stock', compact('articulos'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('stock-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Generate PDF with the top-selling articles ranked by total output.
     * Price is shown with a 15% discount applied.
     */
    public function topSalidas(Request $request): Response
    {
        abort_if($request->user()->isInversor(), 403);
        abort_if($request->user()->isMechanic(), 403);

        $articulos = Articulo::query()
            ->select([
                'articulos.id',
                'articulos.descripcion',
                'articulos.codigo',
                'articulos.precio',
                'articulos.stock',
                'articulos.imagen',
            ])
            ->selectRaw('COALESCE(SUM(transacciones.cantidad), 0) as total_salida')
            ->where('articulos.repuestos', true)
            ->join('transacciones', function ($join) {
                $join->on('transacciones.articulo_id', '=', 'articulos.id')
                    ->where('transacciones.tipo', '=', 'OUT')
                    ->where('transacciones.inactiva', '=', false);
            })
            ->groupBy(
                'articulos.id',
                'articulos.descripcion',
                'articulos.codigo',
                'articulos.precio',
                'articulos.stock',
                'articulos.imagen',
            )
            ->havingRaw('SUM(transacciones.cantidad) > 0')
            ->orderByDesc('total_salida')
            ->get();

        // Embed images as base64 to avoid DomPDF chroot/path issues in production.
        $articulos->each(function ($a) {
            $a->imagen_data = null;
            if ($a->imagen) {
                $path = storage_path('app/public/'.$a->imagen);
                if (file_exists($path)) {
                    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                    $mime = match ($ext) {
                        'jpg', 'jpeg' => 'image/jpeg',
                        'png' => 'image/png',
                        'webp' => 'image/webp',
                        default => 'image/png',
                    };
                    $a->imagen_data = 'data:'.$mime.';base64,'.base64_encode(file_get_contents($path));
                }
            }
        });

        $ventasTotales = $articulos->sum(
            fn ($a) => (float) $a->total_salida * round((float) $a->precio * 0.85, 2),
        );
        $stockTotal = (int) Articulo::sum('stock');

        $pdf = Pdf::loadView('pdf.top-salidas', compact('articulos', 'ventasTotales', 'stockTotal'))
            ->setPaper('a4', 'landscape');

        return $pdf->download('top-salidas-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Generate PDF with transaction history, respecting current filters.
     */
    public function transactions(Request $request): Response
    {
        abort_if($request->user()->isMechanic(), 403);

        $filters = $request->only(['article', 'plate', 'applicant', 'from', 'to']);
        $articleId = $filters['article'] ?? null;

        $empresaRestringida = $request->user()->restrictedEmpresaId();

        $transactions = Transaccion::with(['articulo', 'vehiculo', 'user'])
            ->filterByItem($articleId ? (int) $articleId : null)
            ->searchByPlate($filters['plate'] ?? null)
            ->searchByApplicant($filters['applicant'] ?? null)
            ->filterByDate($filters['from'] ?? null, $filters['to'] ?? null)
            ->when($empresaRestringida, fn ($q) => $q->whereHas('vehiculo', fn ($q2) => $q2->where('empresa_id', $empresaRestringida)))
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
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isChofer(), 403);
        abort_if($request->user()->isAdmin() && ! $request->user()->isAdminAbsoluto(), 403);

        $empresaId = $request->user()->restrictedEmpresaId();

        // Fetch all pending cobros with relations
        $cobros = \App\Models\Cobro::query()
            ->pendientes()
            ->forEmpresa($empresaId)
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
     * Generate a plain spreadsheet-like PDF with the vehicles list, respecting filters.
     */
    public function vehiculos(Request $request): Response
    {
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isInversor(), 403);

        $filters = $request->only(['empresa_id', 'inversion_id', 'search', 'asignacion']);
        $search = trim((string) ($filters['search'] ?? ''));
        $asignacion = $filters['asignacion'] ?? null; // 'con' | 'sin' | null

        $vehiculos = Vehiculo::with(['user:id,name', 'inversion:id,nombre', 'empresa:id,nombre'])
            ->visibleTo($request->user())
            ->where('patente', '!=', 'EXTERNO')
            ->when(! empty($filters['empresa_id']), fn ($q) => $q->where('empresa_id', $filters['empresa_id']))
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
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isChofer(), 403);
        abort_if($request->user()->isAdmin() && ! $request->user()->isAdminAbsoluto(), 403);

        $empresaId = $request->user()->restrictedEmpresaId();

        $previousCierreDate = CierreCaja::where('created_at', '<', $cierre->created_at)
            ->latest()
            ->value('created_at');

        $cobros = Cobro::query()
            ->where('cobros.created_at', '<=', $cierre->created_at)
            ->when($previousCierreDate, fn ($q) => $q->where('cobros.created_at', '>', $previousCierreDate))
            ->when($empresaId, fn ($q) => $q->where('cobros.empresa_id', $empresaId))
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
