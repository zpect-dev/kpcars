<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\AperturaCaja;
use App\Models\CierreCaja;
use App\Models\CierreDetalle;
use App\Models\CierreGasto;
use App\Models\Cobro;
use App\Models\Gasto;
use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProcessCierreCajaAction
{
    /**
     * Cierre manual desde el panel de Cobros: cierra la caja (cobros + gastos)
     * de la empresa ACTIVA de la sesión. Lanza si no hay período abierto o si no
     * hay nada que cerrar.
     *
     * @throws RuntimeException
     */
    public function execute(User $user): CierreCaja
    {
        $empresaId = session('active_company_id');

        if ($empresaId === null) {
            throw new RuntimeException('No hay una empresa activa para cerrar la caja.');
        }

        return DB::transaction(function () use ($empresaId, $user): CierreCaja {
            /** @var CierreCaja $cierre Con $tolerante=false nunca devuelve null. */
            $cierre = $this->cerrarEmpresa((int) $empresaId, $user, tolerante: false);

            return $cierre;
        });
    }

    /**
     * Cierra la caja (cobros + gastos) de una empresa puntual, congelando:
     *  1. Los cobros de inventario del período → snapshot por inversión en CierreDetalle.
     *  2. Los gastos del período → un CierreGasto hijo de este cierre de caja.
     *  3. La apertura abierta de esa empresa (apertura.cierre_id).
     *
     * No usa la sesión: scopea todo por `$empresaId` explícito (sirve para el
     * cierre unificado cross-empresa). DEBE llamarse dentro de una transacción.
     *
     * @param  bool  $tolerante  Si es true y no hay período abierto, devuelve null
     *                           en vez de lanzar; y cierra el período aunque esté
     *                           vacío (para alinear la caja con la recaudación).
     *
     * @throws RuntimeException Sólo cuando $tolerante es false.
     */
    public function cerrarEmpresa(int $empresaId, User $user, bool $tolerante = false): ?CierreCaja
    {
        // Período de caja abierto de la empresa (sin TenantScope: cross-empresa).
        $apertura = AperturaCaja::withoutGlobalScope(TenantScope::class)
            ->where('empresa_id', $empresaId)
            ->whereNull('cierre_id')
            ->latest()
            ->lockForUpdate()
            ->first();

        if ($apertura === null) {
            if ($tolerante) {
                return null;
            }

            throw new RuntimeException('No hay un período de caja abierto para cerrar.');
        }

        // Último cierre de caja de la empresa: acota los cobros pendientes por fecha.
        $ultimoCierreFecha = CierreCaja::withoutGlobalScope(TenantScope::class)
            ->where('empresa_id', $empresaId)
            ->latest()
            ->value('created_at');

        // Totales de cobros por inversión del período, valuados a precio de venta.
        $totalesCobros = Cobro::query()
            ->withoutGlobalScope(TenantScope::class)
            ->where('cobros.empresa_id', $empresaId)
            ->when($ultimoCierreFecha, fn ($q) => $q->where('cobros.created_at', '>', $ultimoCierreFecha))
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->selectRaw('cobros.inversion_id, cobros.empresa_id, SUM(articulos.precio * transacciones.cantidad) as total')
            ->groupBy('cobros.inversion_id', 'cobros.empresa_id')
            ->lockForUpdate()
            ->get();

        // Gastos pendientes de la empresa: sus gastos de vehículo + los globales
        // (vehiculo_id null). Replica GastoTenantScope para $empresaId concreto.
        // Los globales los toma la PRIMERA empresa que cierra; las siguientes ya
        // no los ven (dejan de estar pendientes), así no se cierran dos veces.
        $gastosPendientes = Gasto::query()
            ->withoutGlobalScope(GastoTenantScope::class)
            ->pendientes()
            ->where(fn ($q) => $q
                ->whereNull('vehiculo_id')
                ->orWhereHas('vehiculo', fn ($q2) => $q2
                    ->withoutGlobalScope(TenantScope::class)
                    ->where('empresa_id', $empresaId)))
            ->lockForUpdate()
            ->get();

        if ($totalesCobros->isEmpty() && $gastosPendientes->isEmpty() && ! $tolerante) {
            throw new RuntimeException('No hay cobros ni gastos pendientes para cerrar.');
        }

        $cierre = CierreCaja::create([
            'empresa_id' => $empresaId,
            'user_id' => $user->id,
        ]);

        // Snapshot de cobros por inversión + empresa.
        foreach ($totalesCobros as $row) {
            CierreDetalle::create([
                'cierre_id' => $cierre->id,
                'inversion_id' => $row->inversion_id,
                'empresa_id' => $row->empresa_id,
                'total' => $row->total,
            ]);
        }

        // Archivar los gastos como un CierreGasto hijo de este cierre de caja.
        if ($gastosPendientes->isNotEmpty()) {
            $cierreGasto = CierreGasto::create([
                'empresa_id' => $empresaId,
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
    }
}
