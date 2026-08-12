<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CajaChicaMovimiento;
use App\Models\CierreGasto;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CierreGastoController extends Controller
{
    /**
     * Detalle de un cierre con el desglose por tipo y por patente.
     *
     * El cierre de gastos ya no se ejecuta de forma autónoma: forma parte del
     * cierre unificado de caja (ver {@see \App\Actions\ProcessCierreCajaAction}).
     * Esta acción sobrevive sólo para ver el desglose de un cierre concreto,
     * tanto de los nuevos (hijos de un cierre de caja) como de los legacy.
     */
    public function show(Request $request, CierreGasto $cierreGasto): Response
    {
        $this->authorize('view', $cierreGasto);

        $cierreGasto->load('user:id,name');

        ['porTipo' => $porTipo, 'porVehiculo' => $porVehiculo] = $cierreGasto->desglose();

        $porVehiculo = $porVehiculo->map(fn (object $d) => (object) [
            'patente' => $d->patente ?? '—',
            'total' => $d->total,
        ]);

        return Inertia::render('CierresGasto/Show', [
            'cierre' => [
                'id' => $cierreGasto->id,
                'periodo_inicio' => $cierreGasto->periodo_inicio?->toIso8601String(),
                'periodo_fin' => $cierreGasto->periodo_fin?->toIso8601String(),
                'total_general' => (float) $cierreGasto->total_general,
                'ejecutado_por' => $cierreGasto->user?->name,
                'created_at' => $cierreGasto->created_at?->toIso8601String(),
            ],
            'porTipo' => $porTipo,
            'porVehiculo' => $porVehiculo,
            'cajaChica' => $this->cajaChica($cierreGasto),
        ]);
    }

    /**
     * Caja chica del período congelado por este cierre. Null cuando el cierre no
     * es el que cerró la caja (ver {@see CierreGasto::cajaChica()}).
     *
     * @return array<string, mixed>|null
     */
    protected function cajaChica(CierreGasto $cierreGasto): ?array
    {
        $periodo = $cierreGasto->cajaChica();

        if ($periodo === null) {
            return null;
        }

        $movimientos = $periodo->movimientos()
            ->with('registradoPor:id,name')
            ->ordenExtracto()
            ->get();

        return [
            ...$periodo->totales(),
            'cerrado_at' => $periodo->cerrado_at?->toIso8601String(),
            'movimientos' => $movimientos->map(fn (CajaChicaMovimiento $m) => [
                'id' => $m->id,
                'tipo_label' => $m->tipo->label(),
                'monto' => (float) $m->monto,
                'fecha' => $m->fecha?->format('Y-m-d'),
                'nota' => $m->nota,
                'registrado_por' => $m->registradoPor?->name,
            ])->values(),
        ];
    }
}
