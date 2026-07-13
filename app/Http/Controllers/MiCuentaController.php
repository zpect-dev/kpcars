<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CierreSueldo;
use App\Models\CierreSueldoAbono;
use App\Models\CierreSueldoPago;
use App\Models\Scopes\TenantScope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class MiCuentaController extends Controller
{
    /**
     * Vista del inversor: sus inversiones, deuda vigente y sueldos cobrados.
     */
    public function index(Request $request): Response
    {
        // El middleware `role:inversor` ya filtró el rol. El Gate adicional valida
        // que el inversor tenga al menos una inversión asignada.
        Gate::authorize('view-mi-cuenta');

        $user = $request->user();

        // Mi Cuenta es vista cross-empresa: muestra TODAS sus inversiones,
        // no sólo las de la empresa activa. Bypasseamos TenantScope.
        $inversiones = $user->inversiones()
            ->withoutGlobalScope(TenantScope::class)
            ->with('empresa:id,nombre')
            ->get()
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->map(fn ($inv) => [
                'id' => $inv->id,
                'nombre' => $inv->nombre,
                'empresa' => $inv->empresa,
                'es_financiador' => (bool) $inv->pivot->es_financiador,
                'deuda' => (float) $inv->pivot->deuda,
            ]);

        // Historial de cierres en los que cobró (los cierres de sueldo son
        // globales, sin TenantScope; el bypass sólo hace falta en Inversion).
        $pagosPorCierre = CierreSueldoPago::with([
            'cierre:id,tasa,created_at',
            'inversion' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)
                ->select('id', 'nombre'),
        ])
            ->where('user_id', $user->id)
            ->orderByDesc('cierre_sueldo_id')
            ->get()
            ->groupBy('cierre_sueldo_id');

        // Abonos de deuda del inversor registrados en cada cierre.
        $abonosPorCierre = CierreSueldoAbono::where('user_id', $user->id)
            ->selectRaw('cierre_sueldo_id, SUM(monto) as total')
            ->groupBy('cierre_sueldo_id')
            ->pluck('total', 'cierre_sueldo_id');

        $cierres = $pagosPorCierre->map(function ($pagos) use ($abonosPorCierre) {
            $cierre = $pagos->first()->cierre;

            return [
                'id' => $cierre?->id,
                'fecha' => $cierre?->created_at?->toIso8601String(),
                'tasa' => $cierre?->tasa ? (float) $cierre->tasa : null,
                'total' => (float) $pagos->sum(fn (CierreSueldoPago $p) => (float) $p->monto),
                'abonado' => (float) ($abonosPorCierre[$cierre?->id] ?? 0),
                'detalles' => $pagos
                    ->map(fn (CierreSueldoPago $p) => [
                        'inversion' => $p->inversion?->nombre,
                        'concepto' => $p->concepto,
                        'monto' => (float) $p->monto,
                    ])
                    ->sortBy(fn ($d) => (string) $d['inversion'], SORT_NATURAL | SORT_FLAG_CASE)
                    ->values(),
            ];
        })->values();

        // Tasa de referencia = la del último cierre de sueldos.
        $tasaActual = CierreSueldo::latest('created_at')->value('tasa');

        return Inertia::render('MiCuenta/Index', [
            'inversiones' => $inversiones,
            'cierres' => $cierres,
            'tasaActual' => $tasaActual ? (float) $tasaActual : null,
        ]);
    }
}
