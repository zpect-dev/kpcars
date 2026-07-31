<?php

declare(strict_types=1);

namespace App\Actions;

/**
 * Recorta el resumen financiero (ya calculado por CalcularResumenAction) a la
 * selección de filas que el usuario tildó en pantalla, para que las
 * exportaciones PDF/Excel puedan traer "sólo lo que seleccioné" en vez del
 * período completo. No repite ningún cálculo: sólo filtra y re-suma sobre
 * las colecciones ya resueltas.
 *
 * Los "totales" del resumen (ingresos/egresos/neto del período completo) no
 * se tocan: quedan como contexto. La selección se agrega aparte bajo la key
 * `seleccion`, que las vistas de exportación usan para mostrar un subtotal.
 */
class AplicarSeleccionResumenAction
{
    /**
     * @param  array<string, mixed>  $resumen  Resultado de CalcularResumenAction::execute()
     * @param  array<int, int>  $selVehiculoIds
     * @param  array<int, string>  $selTipos
     * @return array<string, mixed>
     */
    public function execute(array $resumen, array $selVehiculoIds, array $selTipos): array
    {
        $activa = $selVehiculoIds !== [] || $selTipos !== [];

        $porVehiculo = $selVehiculoIds !== []
            ? $resumen['por_vehiculo']->whereIn('vehiculo_id', $selVehiculoIds)->values()
            : $resumen['por_vehiculo'];

        $porTipo = $selTipos !== []
            ? $resumen['por_tipo']->whereIn('tipo', $selTipos)->values()
            : $resumen['por_tipo'];

        $resumen['por_vehiculo'] = $porVehiculo;
        $resumen['por_tipo'] = $porTipo;

        $resumen['seleccion'] = [
            'activa' => $activa,
            'vehiculo' => [
                'ingresos' => round((float) $porVehiculo->sum('ingresos'), 2),
                'gastos' => round((float) $porVehiculo->sum('gastos'), 2),
                'repuestos' => round((float) $porVehiculo->sum('repuestos'), 2),
                'egresos' => round((float) $porVehiculo->sum('egresos'), 2),
                'neto' => round((float) $porVehiculo->sum('neto'), 2),
            ],
            'tipo_total' => round((float) $porTipo->sum('total'), 2),
        ];

        return $resumen;
    }
}
