<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CierreInversion;
use App\Models\CierreInversionPago;
use App\Models\DeudaMovimiento;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MiCuentaController extends Controller
{
    /**
     * Vista del inversor: sus inversiones, saldo de deuda y movimientos.
     */
    public function index(Request $request): Response
    {
        abort_unless($request->user()->isInversor(), 403);

        $user = $request->user();

        abort_unless($user->inversiones()->exists(), 403);

        $inversiones = $user->inversiones()
            ->with('empresa:id,nombre')
            ->get()
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->map(function ($inv) use ($user) {
                $movimientos = DeudaMovimiento::with('registradoPor:id,name')
                    ->where('inversion_id', $inv->id)
                    ->where('user_id', $user->id)
                    ->orderByDesc('created_at')
                    ->orderByDesc('id')
                    ->get();

                $saldo = (float) $movimientos->reduce(
                    fn (float $carry, DeudaMovimiento $m) => $m->tipo === 'cargo'
                        ? $carry + (float) $m->monto
                        : $carry - (float) $m->monto,
                    0.0,
                );

                return [
                    'id' => $inv->id,
                    'nombre' => $inv->nombre,
                    'empresa' => $inv->empresa,
                    'tiene_deuda' => (bool) $inv->pivot->tiene_deuda,
                    'es_financiador' => (bool) $inv->pivot->es_financiador,
                    'saldo' => $saldo,
                    'movimientos' => $movimientos,
                ];
            });

        // Historial de cierres en los que cobró el inversor
        $pagosPorCierre = CierreInversionPago::with([
            'cierre:id,periodo_inicio,periodo_fin,tasa,created_at',
            'inversion:id,nombre',
        ])
            ->where('user_id', $user->id)
            ->orderByDesc('cierre_id')
            ->get()
            ->groupBy('cierre_id');

        $cierres = $pagosPorCierre->map(function ($pagos) {
            $cierre = $pagos->first()->cierre;

            return [
                'id' => $cierre?->id,
                'periodo_inicio' => $cierre?->periodo_inicio?->toIso8601String(),
                'periodo_fin' => $cierre?->periodo_fin?->toIso8601String(),
                'total' => (float) $pagos->sum(fn ($p) => (float) $p->monto),
                'tasa' => $cierre?->tasa ? (float) $cierre->tasa : null,
                'detalles' => $pagos->map(fn ($p) => [
                    'inversion' => $p->inversion?->nombre,
                    'concepto' => $p->concepto,
                    'monto' => (float) $p->monto,
                ])->values(),
            ];
        })->values();

        // Tasa actual = la del último cierre
        $tasaActual = CierreInversion::latest('periodo_fin')->value('tasa');

        return Inertia::render('MiCuenta/Index', [
            'inversiones' => $inversiones,
            'cierres' => $cierres,
            'tasaActual' => $tasaActual ? (float) $tasaActual : null,
        ]);
    }
}
