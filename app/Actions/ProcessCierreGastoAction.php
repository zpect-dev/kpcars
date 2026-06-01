<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\CierreGasto;
use App\Models\CierreGastoDetalle;
use App\Models\Gasto;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProcessCierreGastoAction
{
    /**
     * Cierra el período actual de gastos de la empresa activa.
     *
     * 1. Toma los gastos pendientes (posteriores al último cierre).
     * 2. Crea el CierreGasto (snapshot del período).
     * 3. Genera detalles: un subtotal por tipo normal y, para los gastos
     *    de tipo "vehiculo", un subtotal por patente.
     *
     * @throws RuntimeException Si no hay gastos pendientes para cerrar.
     */
    public function execute(User $user): CierreGasto
    {
        return DB::transaction(function () use ($user): CierreGasto {
            // Snapshot ANTES de crear el cierre (la condición de "pendiente"
            // depende del último cierre existente).
            $pendientes = Gasto::query()
                ->pendientes()
                ->with('vehiculo:id,patente')
                ->lockForUpdate()
                ->get();

            if ($pendientes->isEmpty()) {
                throw new RuntimeException('No hay gastos pendientes para cerrar.');
            }

            $periodoInicio = CierreGasto::latest()->value('created_at');

            $cierre = CierreGasto::create([
                'empresa_id' => session('active_company_id'),
                'user_id' => $user->id,
                'periodo_inicio' => $periodoInicio,
                'periodo_fin' => now(),
                'total_general' => $pendientes->sum(fn (Gasto $g) => (float) $g->monto),
            ]);

            // Subtotales por tipo (categorías que no son vehículo).
            $pendientes
                ->where('tipo', '!=', 'vehiculo')
                ->groupBy('tipo')
                ->each(function ($grupo, string $tipo) use ($cierre) {
                    CierreGastoDetalle::create([
                        'cierre_gasto_id' => $cierre->id,
                        'tipo' => $tipo,
                        'vehiculo_id' => null,
                        'patente' => null,
                        'total' => $grupo->sum(fn (Gasto $g) => (float) $g->monto),
                    ]);
                });

            // Subtotales de tipo "vehiculo" desglosados por patente.
            $pendientes
                ->where('tipo', 'vehiculo')
                ->groupBy('vehiculo_id')
                ->each(function ($grupo) use ($cierre) {
                    $vehiculo = $grupo->first()->vehiculo;

                    CierreGastoDetalle::create([
                        'cierre_gasto_id' => $cierre->id,
                        'tipo' => 'vehiculo',
                        'vehiculo_id' => $vehiculo?->id,
                        'patente' => $vehiculo?->patente,
                        'total' => $grupo->sum(fn (Gasto $g) => (float) $g->monto),
                    ]);
                });

            return $cierre;
        });
    }
}
