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

        $empresaId = $request->user()->isInversor() ? $request->user()->empresa_id : null;

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
            ->orderBy('empresas.nombre')
            ->orderBy('inversiones.nombre')
            ->get();

        $totalGeneral = $resumen->sum('total');

        // Get the last cierre info
        $ultimoCierre = CierreCaja::with('user:id,name')
            ->latest()
            ->first();

        // Historical cierres with their details
        $historialCierres = CierreCaja::with(['user:id,name', 'detalles.inversion:id,nombre,empresa_id'])
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

                return [
                    'id' => $cierre->id,
                    'user' => $cierre->user,
                    'total' => $detalles->sum('total'),
                    'detalles' => $detalles->map(fn ($d) => [
                        'inversion_nombre' => $d->inversion?->nombre ?? 'N/A',
                        'total' => $d->total,
                    ])->values(),
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

        $empresaId = $request->user()->isInversor() ? $request->user()->empresa_id : $request->integer('empresa_id');

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
     * Execute the cash register closing.
     */
    public function cierreCaja(Request $request, ProcessCierreCajaAction $action): RedirectResponse
    {
        abort_unless($request->user()->isAdmin(), 403, 'Solo los administradores pueden ejecutar el cierre de caja.');

        // Check there are pending cobros
        $pendingCount = Cobro::query()->pendientes()->count();

        if ($pendingCount === 0) {
            return redirect()->back()->with('warning', 'No hay cobros pendientes para cerrar.');
        }

        $action->execute();

        return redirect()->back()->with('success', 'Cierre de caja ejecutado correctamente.');
    }
}
