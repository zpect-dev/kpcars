<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessCierreCajaAction;
use App\Models\CierreCaja;
use App\Models\Cobro;
use App\Models\Inversion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CobroController extends Controller
{
    /**
     * Display the cobros dashboard.
     */
    public function index(Request $request): Response
    {
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isChofer(), 403);
        abort_if($request->user()->isAdmin() && ! $request->user()->isAdminAbsoluto(), 403);

        $empresaId = $request->user()->restrictedEmpresaId();

        // Get totals per inversion+empresa for the current period
        $resumen = Cobro::query()
            ->pendientes()
            ->forEmpresa($empresaId)
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
                COUNT(cobros.id) as transacciones_count
            ')
            ->groupBy('cobros.inversion_id', 'cobros.empresa_id', 'inversiones.nombre', 'empresas.nombre')
            ->get()
            ->sortBy('inversion_nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->sortBy('empresa_nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $totalGeneral = $resumen->sum('total');

        // Get the last cierre info
        $ultimoCierre = CierreCaja::with('user:id,name')
            ->latest()
            ->first();

        // Historical cierres with their details
        $historialCierres = CierreCaja::with([
            'user:id,name',
            'detalles.inversion:id,nombre,empresa_id',
            'detalles.empresa:id,nombre',
        ])
            ->when($empresaId, function ($q) use ($empresaId) {
                $q->whereHas('detalles', fn ($q2) => $q2->where('empresa_id', $empresaId));
            })
            ->latest()
            ->limit(20)
            ->get()
            ->map(function (CierreCaja $cierre) use ($empresaId) {
                $detalles = $cierre->detalles;

                // Filter detalles by empresa if inversor
                if ($empresaId) {
                    $detalles = $detalles->filter(fn ($d) => $d->empresa_id === $empresaId);
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

                return [
                    'id' => $cierre->id,
                    'user' => $cierre->user,
                    'total' => $detalles->sum('total'),
                    'detalles' => $detallesOrdenados,
                    'created_at' => $cierre->created_at,
                ];
            });

        return Inertia::render('Cobros/Index', [
            'resumen' => $resumen,
            'totalGeneral' => $totalGeneral,
            'ultimoCierre' => $ultimoCierre,
            'historialCierres' => $historialCierres,
        ]);
    }

    /**
     * Display the detail breakdown for a specific inversion.
     */
    public function show(Request $request, Inversion $inversion): Response
    {
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isChofer(), 403);
        abort_if($request->user()->isAdmin() && ! $request->user()->isAdminAbsoluto(), 403);

        $empresaId = $request->user()->restrictedEmpresaId() ?? $request->integer('empresa_id');

        // Inversor can only see inversions of their empresa
        if ($request->user()->isInversor() && $empresaId) {
            // Verify this inversion has cobros for the inversor's empresa
            $hasCobros = Cobro::query()
                ->where('inversion_id', $inversion->id)
                ->where('empresa_id', $empresaId)
                ->exists();
            abort_unless($hasCobros, 403);
        }

        // Build base query scoped to inversion + empresa
        $baseQuery = Cobro::query()
            ->pendientes()
            ->where('cobros.inversion_id', $inversion->id)
            ->when($empresaId, fn ($q) => $q->where('cobros.empresa_id', $empresaId));

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
            'inversion' => $inversion->only('id', 'nombre'),
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
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isChofer(), 403);
        abort_if($request->user()->isAdmin() && ! $request->user()->isAdminAbsoluto(), 403);

        $inversionId = $request->integer('inversion_id');
        $empresaId = $request->integer('empresa_id');

        abort_if($inversionId <= 0 || $empresaId <= 0, 422, 'Parámetros inválidos.');

        // Restringir al empresa accesible (inversor o admin restringido)
        $restricted = $request->user()->restrictedEmpresaId();
        if ($restricted !== null) {
            abort_unless($empresaId === $restricted, 403);
        }

        // Determine the date range: cobros created between previous cierre and this cierre
        $previousCierreDate = CierreCaja::where('created_at', '<', $cierre->created_at)
            ->latest()
            ->value('created_at');

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
     * Execute the cash register closing.
     */
    public function cierreCaja(Request $request, ProcessCierreCajaAction $action): RedirectResponse
    {
        abort_unless($request->user()->isAdminAbsoluto(), 403, 'Solo los administradores con acceso absoluto pueden ejecutar el cierre de caja.');

        // Check there are pending cobros
        $pendingCount = Cobro::query()->pendientes()->count();

        if ($pendingCount === 0) {
            return redirect()->back()->with('warning', 'No hay cobros pendientes para cerrar.');
        }

        $action->execute();

        return redirect()->back()->with('success', 'Cierre de caja ejecutado correctamente.');
    }
}
