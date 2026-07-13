<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\CierreCaja;
use App\Models\Cobro;
use App\Models\Gasto;
use Illuminate\Support\Collection;

class BuildResumenIntegradoAction
{
    /**
     * Resumen que integra, por inversión y con desglose por vehículo, los
     * cobros pendientes (movimientos de stock) más los gastos tipo "vehículo"
     * registrados desde el último cierre de caja. Incluye el detalle línea a
     * línea de cobros y gastos por vehículo. Es de solo lectura.
     *
     * Respeta la empresa activa: Cobro vía TenantScope y Gasto vía
     * GastoTenantScope.
     */
    /**
     * @param  string|null  $desde  Límite inferior exclusivo (created_at > desde). Solo aplica en modo histórico.
     * @param  string|null  $hasta  Límite superior inclusivo (created_at <= hasta). Si es null, se resume el período actual (pendientes).
     */
    public function execute(?string $desde = null, ?string $hasta = null): Collection
    {
        // Modo histórico: se acota por rango de fecha del cierre. Modo actual
        // (hasta === null): mismo período que los cobros pendientes, posterior
        // al último cierre de caja de la empresa activa.
        $historico = $hasta !== null;
        $ultimoCierreCajaAt = $historico ? null : CierreCaja::latest()->value('created_at');

        // Cobros del período, una línea por transacción.
        $cobros = Cobro::query()
            ->when(! $historico, fn ($q) => $q->pendientes())
            ->when($historico && $desde, fn ($q) => $q->where('cobros.created_at', '>', $desde))
            ->when($historico, fn ($q) => $q->where('cobros.created_at', '<=', $hasta))
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->join('inversiones', 'cobros.inversion_id', '=', 'inversiones.id')
            ->join('empresas', 'cobros.empresa_id', '=', 'empresas.id')
            ->select([
                'cobros.inversion_id',
                'inversiones.nombre as inversion_nombre',
                'empresas.nombre as empresa_nombre',
                'vehiculos.id as vehiculo_id',
                'vehiculos.patente',
                'vehiculos.marca',
                'vehiculos.modelo',
                'articulos.descripcion as articulo',
                'transacciones.cantidad',
                'articulos.precio as precio_unitario',
            ])
            ->selectRaw('articulos.precio * transacciones.cantidad as subtotal')
            ->orderBy('vehiculos.patente')
            ->orderBy('articulos.descripcion')
            ->get();

        // Gastos tipo "vehículo" del mismo período, uno por uno.
        $gastos = Gasto::query()
            ->where('gastos.tipo', 'vehiculo')
            ->whereNotNull('gastos.vehiculo_id')
            ->when(! $historico && $ultimoCierreCajaAt, fn ($q) => $q->where('gastos.created_at', '>', $ultimoCierreCajaAt))
            ->when($historico && $desde, fn ($q) => $q->where('gastos.created_at', '>', $desde))
            ->when($historico, fn ($q) => $q->where('gastos.created_at', '<=', $hasta))
            ->join('vehiculos', 'gastos.vehiculo_id', '=', 'vehiculos.id')
            ->join('inversiones', 'vehiculos.inversion_id', '=', 'inversiones.id')
            ->join('empresas', 'vehiculos.empresa_id', '=', 'empresas.id')
            ->select([
                'vehiculos.inversion_id',
                'inversiones.nombre as inversion_nombre',
                'empresas.nombre as empresa_nombre',
                'vehiculos.id as vehiculo_id',
                'vehiculos.patente',
                'vehiculos.marca',
                'vehiculos.modelo',
                'gastos.fecha',
                'gastos.descripcion',
                'gastos.recibio',
                'gastos.monto',
            ])
            ->orderBy('vehiculos.patente')
            ->orderBy('gastos.fecha')
            ->get();

        // Merge en una estructura por inversión → vehículo.
        $inversiones = [];

        $touch = function (int $invId, $row) use (&$inversiones) {
            if (! isset($inversiones[$invId])) {
                $inversiones[$invId] = [
                    'inversion_id' => $invId,
                    'inversion_nombre' => $row->inversion_nombre,
                    'empresa_nombre' => $row->empresa_nombre,
                    'total_cobros' => 0.0,
                    'total_gastos' => 0.0,
                    'total' => 0.0,
                    'vehiculos' => [],
                ];
            }

            if (! isset($inversiones[$invId]['vehiculos'][$row->vehiculo_id])) {
                $inversiones[$invId]['vehiculos'][$row->vehiculo_id] = [
                    'vehiculo_id' => $row->vehiculo_id,
                    'patente' => $row->patente,
                    'marca' => $row->marca,
                    'modelo' => $row->modelo,
                    'cobros' => 0.0,
                    'gastos' => 0.0,
                    'total' => 0.0,
                    'cobros_detalle' => [],
                    'gastos_detalle' => [],
                ];
            }
        };

        foreach ($cobros as $row) {
            $invId = (int) $row->inversion_id;
            $touch($invId, $row);
            $subtotal = (float) $row->subtotal;
            $inversiones[$invId]['vehiculos'][$row->vehiculo_id]['cobros'] += $subtotal;
            $inversiones[$invId]['vehiculos'][$row->vehiculo_id]['cobros_detalle'][] = [
                'articulo' => $row->articulo,
                'cantidad' => (int) $row->cantidad,
                'precio_unitario' => (float) $row->precio_unitario,
                'subtotal' => $subtotal,
            ];
        }

        foreach ($gastos as $row) {
            $invId = (int) $row->inversion_id;
            $touch($invId, $row);
            $monto = (float) $row->monto;
            $inversiones[$invId]['vehiculos'][$row->vehiculo_id]['gastos'] += $monto;
            $inversiones[$invId]['vehiculos'][$row->vehiculo_id]['gastos_detalle'][] = [
                'fecha' => $row->fecha?->toDateString(),
                'descripcion' => $row->descripcion,
                'recibio' => $row->recibio,
                'monto' => $monto,
            ];
        }

        return collect($inversiones)
            ->map(function (array $inv) {
                $vehiculos = collect($inv['vehiculos'])
                    ->map(function (array $v) {
                        $v['total'] = $v['cobros'] + $v['gastos'];

                        return $v;
                    })
                    ->sortBy('patente', SORT_NATURAL | SORT_FLAG_CASE)
                    ->values();

                $inv['vehiculos'] = $vehiculos;
                $inv['total_cobros'] = (float) $vehiculos->sum('cobros');
                $inv['total_gastos'] = (float) $vehiculos->sum('gastos');
                $inv['total'] = $inv['total_cobros'] + $inv['total_gastos'];

                return $inv;
            })
            ->sortBy('inversion_nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->sortBy('empresa_nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
    }
}
