<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\AperturaCaja;
use App\Models\CierreCaja;
use App\Models\CierreDetalle;
use App\Models\CierreGasto;
use App\Models\Cobro;
use App\Models\Gasto;
use App\Models\PeriodoCajaChica;
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

        // En modo manual el período debe estar abierto. En el cierre unificado
        // (tolerante) seguimos aunque no lo esté: igual barremos los cobros y
        // gastos que hayan quedado pendientes para esa empresa.
        if ($apertura === null && ! $tolerante) {
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
        // (vehiculo_id null). El filtro por empresa se hace con una subconsulta
        // CRUDA a `vehiculos` (sin TenantScope): un `whereHas` no logra quitar el
        // scope de Vehiculo y, con otra empresa activa en sesión, dejaba afuera la
        // flota de las demás empresas. Los globales los toma la PRIMERA empresa que
        // cierra; las siguientes ya no los ven (dejan de estar pendientes).
        $gastosPendientes = Gasto::query()
            ->withoutGlobalScope(GastoTenantScope::class)
            ->pendientes()
            ->where(fn ($q) => $q
                ->whereNull('vehiculo_id')
                ->orWhereIn('vehiculo_id', DB::table('vehiculos')
                    ->select('id')
                    ->where('empresa_id', $empresaId)))
            ->lockForUpdate()
            ->get();

        if ($totalesCobros->isEmpty() && $gastosPendientes->isEmpty()) {
            if (! $tolerante) {
                throw new RuntimeException('No hay cobros ni gastos pendientes para cerrar.');
            }

            // Tolerante: si hay un período abierto lo cerramos igual (aunque esté
            // vacío, para alinearlo con la recaudación); si ni siquiera hay
            // período abierto y nada pendiente, no hay nada que hacer.
            if ($apertura === null) {
                return null;
            }
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
                // Sin apertura (barrido tolerante) usamos el último cierre como
                // inicio del período, o ahora si tampoco hubo cierre previo.
                'periodo_inicio' => $apertura?->created_at ?? $ultimoCierreFecha ?? now(),
                'periodo_fin' => now(),
                'total_general' => $gastosPendientes->sum(fn (Gasto $g) => (float) $g->monto),
            ]);

            // Sin GastoTenantScope: si no, el update quedaría acotado a la empresa
            // activa de la sesión y no archivaría la flota de las demás empresas.
            Gasto::query()
                ->withoutGlobalScope(GastoTenantScope::class)
                ->whereIn('id', $gastosPendientes->pluck('id'))
                ->update(['cierre_gasto_id' => $cierreGasto->id]);
        }

        // Cerrar la apertura si la había: el período queda congelado.
        $apertura?->update(['cierre_id' => $cierre->id]);

        $this->cerrarCajaChicaSiCorresponde($cierre, $user);

        return $cierre;
    }

    /**
     * La caja chica es única para todas las empresas, así que vive mientras
     * quede alguna empresa con período de caja abierto. La cierra el cierre de
     * la última: en el cierre unificado, el de la última empresa de la vuelta.
     *
     * El período cerrado queda congelado y el siguiente arranca en cero: el
     * saldo no se arrastra.
     */
    protected function cerrarCajaChicaSiCorresponde(CierreCaja $cierre, User $user): void
    {
        $quedanAbiertas = AperturaCaja::withoutGlobalScope(TenantScope::class)
            ->whereNull('cierre_id')
            ->exists();

        if ($quedanAbiertas) {
            return;
        }

        PeriodoCajaChica::abierto()
            ->lockForUpdate()
            ->get()
            ->each(fn (PeriodoCajaChica $periodo) => $periodo->update([
                'cerrado_at' => now(),
                'cerrado_por' => $user->id,
                'cierre_caja_id' => $cierre->id,
            ]));
    }
}
