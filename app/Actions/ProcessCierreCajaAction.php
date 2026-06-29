<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\AperturaCaja;
use App\Models\CierreCaja;
use App\Models\CierreDetalle;
use App\Models\CierreGasto;
use App\Models\Cobro;
use App\Models\Gasto;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProcessCierreCajaAction
{
    /**
     * Ejecuta el cierre unificado del período de caja dentro de una transacción.
     *
     * Un único cierre congela, a la vez:
     *  1. Los cobros de inventario pendientes → snapshot por inversión en CierreDetalle.
     *  2. Los gastos pendientes → se archivan vinculándolos a un CierreGasto hijo
     *     de este cierre (cierre_caja_id), reutilizando su desglose por tipo/patente.
     *  3. Cierra la apertura abierta (apertura.cierre_id).
     *
     * @throws RuntimeException Si no hay un período abierto, o si no hay nada que cerrar.
     */
    public function execute(User $user): CierreCaja
    {
        return DB::transaction(function () use ($user): CierreCaja {
            // Debe existir un período abierto en la empresa activa.
            $apertura = AperturaCaja::abierta()->latest()->lockForUpdate()->first();

            if ($apertura === null) {
                throw new RuntimeException('No hay un período de caja abierto para cerrar.');
            }

            // Totales de cobros por inversión+empresa. lockForUpdate evita que dos
            // cierres concurrentes tomen los mismos cobros.
            $totalesCobros = Cobro::query()
                ->pendientes()
                ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
                ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
                ->selectRaw('cobros.inversion_id, cobros.empresa_id, SUM(articulos.precio * transacciones.cantidad) as total')
                ->groupBy('cobros.inversion_id', 'cobros.empresa_id')
                ->lockForUpdate()
                ->get();

            // Gastos pendientes del período (acotados a la empresa activa por el
            // GastoTenantScope: sus gastos de vehículo + los globales).
            $gastosPendientes = Gasto::query()
                ->pendientes()
                ->lockForUpdate()
                ->get();

            if ($totalesCobros->isEmpty() && $gastosPendientes->isEmpty()) {
                throw new RuntimeException('No hay cobros ni gastos pendientes para cerrar.');
            }

            $cierre = CierreCaja::create([
                'empresa_id' => session('active_company_id'),
                'user_id' => $user->id,
            ]);

            // Snapshot de cobros por inversión+empresa.
            foreach ($totalesCobros as $row) {
                CierreDetalle::create([
                    'cierre_id' => $cierre->id,
                    'inversion_id' => $row->inversion_id,
                    'empresa_id' => $row->empresa_id,
                    'total' => $row->total,
                ]);
            }

            // Archivar gastos como un CierreGasto hijo de este cierre de caja.
            if ($gastosPendientes->isNotEmpty()) {
                $cierreGasto = CierreGasto::create([
                    'empresa_id' => session('active_company_id'),
                    'cierre_caja_id' => $cierre->id,
                    'user_id' => $user->id,
                    'periodo_inicio' => $apertura->created_at,
                    'periodo_fin' => now(),
                    'total_general' => $gastosPendientes->sum(fn (Gasto $g) => (float) $g->monto),
                ]);

                Gasto::query()
                    ->whereIn('id', $gastosPendientes->pluck('id'))
                    ->update(['cierre_gasto_id' => $cierreGasto->id]);
            }

            // Cerrar la apertura: el período queda congelado hasta una nueva apertura.
            $apertura->update(['cierre_id' => $cierre->id]);

            return $cierre;
        });
    }
}
