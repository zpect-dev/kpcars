<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\CierreGasto;
use App\Models\Gasto;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProcessCierreGastoAction
{
    /**
     * Cierra el período actual de gastos de la empresa activa.
     *
     * 1. Toma los gastos pendientes (sin cierre asociado).
     * 2. Crea el CierreGasto (snapshot del período).
     * 3. Estampa el `cierre_gasto_id` en esos gastos: quedan archivados y dejan
     *    de ser pendientes. El desglose por tipo/patente se deriva luego de los
     *    gastos vinculados, sin tablas auxiliares.
     *
     * @throws RuntimeException Si no hay gastos pendientes para cerrar.
     */
    public function execute(User $user): CierreGasto
    {
        return DB::transaction(function () use ($user): CierreGasto {
            // Snapshot bajo lock: los pendientes son los que aún no tienen cierre.
            // El TenantScope acota a la empresa activa (sus vehículos + globales).
            $pendientes = Gasto::query()
                ->pendientes()
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

            // Archiva el lote: vincula los pendientes a este cierre.
            Gasto::query()
                ->whereIn('id', $pendientes->pluck('id'))
                ->update(['cierre_gasto_id' => $cierre->id]);

            return $cierre;
        });
    }
}
