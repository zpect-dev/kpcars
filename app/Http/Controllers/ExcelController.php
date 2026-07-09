<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\BuildResumenIntegradoAction;
use App\Models\AperturaRecaudacion;
use App\Models\CierreGasto;
use App\Models\CierreSueldo;
use App\Models\CierreSueldoPago;
use App\Models\Cobro;
use App\Models\Recaudacion;
use Illuminate\Http\Request;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExcelController extends Controller
{
    /**
     * Excel del resumen integrado: cobros + gastos por vehículo e inversión.
     */
    public function cobrosIntegrado(Request $request, BuildResumenIntegradoAction $action): StreamedResponse
    {
        // Acceso: middleware role:administrador.
        $resumen = $action->execute();

        $filename = 'resumen-cobros-gastos-'.now()->format('Y-m-d').'.xlsx';
        $writer = SimpleExcelWriter::streamDownload($filename);
        $writer->addHeader(['Inversión', 'Patente', 'Tipo', 'Detalle', 'Monto ARS']);

        foreach ($resumen as $inv) {
            foreach ($inv['vehiculos'] as $v) {
                $vehiculoLabel = trim($v['patente'].' '.$v['marca'].' '.$v['modelo']);

                foreach ($v['cobros_detalle'] as $c) {
                    $writer->addRow([
                        $inv['inversion_nombre'],
                        $v['patente'],
                        'Cobro',
                        $c['articulo'].' ×'.$c['cantidad'],
                        round((float) $c['subtotal'], 2),
                    ]);
                }

                foreach ($v['gastos_detalle'] as $g) {
                    $detalle = trim(($g['fecha'] ? $g['fecha'].' ' : '').($g['descripcion'] ?: $g['recibio'] ?: 'Gasto'));
                    $writer->addRow([
                        $inv['inversion_nombre'],
                        $v['patente'],
                        'Gasto',
                        $detalle,
                        round((float) $g['monto'], 2),
                    ]);
                }

                $writer->addRow([
                    $inv['inversion_nombre'],
                    $v['patente'],
                    'Subtotal vehículo',
                    $vehiculoLabel,
                    round((float) $v['total'], 2),
                ]);
            }

            $writer->addRow([
                $inv['inversion_nombre'],
                '',
                'Subtotal inversión',
                'Cobros '.round((float) $inv['total_cobros'], 2).' + Gastos '.round((float) $inv['total_gastos'], 2),
                round((float) $inv['total'], 2),
            ]);
        }

        $writer->addRow(['TOTAL GENERAL', '', '', '', round((float) $resumen->sum('total'), 2)]);

        return $writer->toBrowser();
    }

    /**
     * Excel export de un cierre de gastos: desglose por tipo y por patente.
     */
    public function cierreGasto(Request $request, CierreGasto $cierreGasto): StreamedResponse
    {
        // Acceso: middleware role:administrador.
        ['porTipo' => $porTipo, 'porVehiculo' => $porVehiculo] = $cierreGasto->desglose();

        $filename = 'cierre-gastos-'.$cierreGasto->id.'-'.$cierreGasto->periodo_fin->format('Y-m-d').'.xlsx';

        $writer = SimpleExcelWriter::streamDownload($filename);
        $writer->addHeader(['Categoría', 'Detalle', 'Monto ARS']);

        $porTipo->each(function (object $d) use ($writer) {
            $writer->addRow([ucfirst($d->tipo), '', round($d->total, 2)]);
        });

        $porVehiculo->each(function (object $d) use ($writer) {
            $writer->addRow(['Vehículo', $d->patente ?? '—', round($d->total, 2)]);
        });

        $writer->addRow(['TOTAL', '', round((float) $cierreGasto->total_general, 2)]);

        return $writer->toBrowser();
    }

    /**
     * Excel export del cierre de sueldos, con desglose por empresa.
     */
    public function cierreSueldo(Request $request, CierreSueldo $cierreSueldo): StreamedResponse
    {
        // Acceso: middleware role:administrador.

        $cierreSueldo->load([
            'pagos.user:id,name,dni',
            'pagos.empresa:id,nombre',
        ]);

        $flotaConceptos = ['parte_completa', 'media_parte_deudor', 'cero_deudor'];
        $tasa = (float) $cierreSueldo->tasa;

        $filename = 'cierre-sueldo-'.$cierreSueldo->id.'-'.$cierreSueldo->created_at->format('Y-m-d').'.xlsx';

        $writer = SimpleExcelWriter::streamDownload($filename);
        $writer->addHeader(['Empresa', 'Inversor', 'DNI', 'Flota ARS', 'Flota USD', 'Financiación ARS', 'Financiación USD', 'Total ARS', 'Total USD']);

        $porEmpresaInversor = $cierreSueldo->pagos
            ->groupBy(fn (CierreSueldoPago $p) => $p->empresa_id.':'.$p->user_id)
            ->map(fn ($pagos) => [
                'empresa' => $pagos->first()->empresa,
                'user' => $pagos->first()->user,
                'pagos' => $pagos,
            ])
            ->sortBy([
                fn ($a, $b) => ($a['empresa']?->id ?? 0) <=> ($b['empresa']?->id ?? 0),
                fn ($a, $b) => strcasecmp((string) $a['user']->name, (string) $b['user']->name),
            ])
            ->values();

        foreach ($porEmpresaInversor as $row) {
            $flota = $row['pagos']->filter(fn ($p) => in_array($p->concepto, $flotaConceptos))->sum('monto');
            $financ = $row['pagos']->filter(fn ($p) => $p->concepto === 'redistribucion_financiador')->sum('monto');
            $total = $flota + $financ;

            $writer->addRow([
                $row['empresa']?->nombre ?? '—',
                $row['user']->name,
                $row['user']->dni,
                round((float) $flota, 2),
                $tasa > 0 ? round((float) $flota / $tasa, 2) : '',
                $financ > 0 ? round((float) $financ, 2) : '',
                $financ > 0 && $tasa > 0 ? round((float) $financ / $tasa, 2) : '',
                round((float) $total, 2),
                $tasa > 0 ? round((float) $total / $tasa, 2) : '',
            ]);
        }

        return $writer->toBrowser();
    }

    /**
     * Excel export for the current user's Mi Cuenta (historial de cierres).
     */
    public function miCuenta(Request $request): StreamedResponse
    {
        // Acceso: middleware role:inversor. El Gate valida que tenga inversiones.
        \Illuminate\Support\Facades\Gate::authorize('view-mi-cuenta');

        $user = $request->user();

        $flotaConceptos = ['parte_completa', 'media_parte_deudor', 'cero_deudor'];

        // Los cierres de sueldo son globales (cubren ambas empresas).
        $pagosPorCierre = CierreSueldoPago::with('cierre:id,tasa,created_at')
            ->where('user_id', $user->id)
            ->orderByDesc('cierre_sueldo_id')
            ->get()
            ->groupBy('cierre_sueldo_id');

        $writer = SimpleExcelWriter::streamDownload('mi-cuenta-'.now()->format('Y-m-d').'.xlsx');
        $writer->addHeader(['Cierre #', 'Fecha', 'Flota ARS', 'Financiación ARS', 'Total ARS']);

        foreach ($pagosPorCierre as $pagos) {
            $cierre = $pagos->first()->cierre;
            $flota = $pagos->filter(fn ($p) => in_array($p->concepto, $flotaConceptos))->sum('monto');
            $financ = $pagos->filter(fn ($p) => $p->concepto === 'redistribucion_financiador')->sum('monto');
            $total = $flota + $financ;

            $writer->addRow([
                $cierre?->id,
                $cierre?->created_at?->format('d/m/Y'),
                round((float) $flota, 2),
                $financ > 0 ? round((float) $financ, 2) : '',
                round((float) $total, 2),
            ]);
        }

        return $writer->toBrowser();
    }

    /**
     * Excel export for pending cobros.
     */
    public function cobros(Request $request): StreamedResponse
    {
        // Acceso: middleware role:administrador.
        // Cobro auto-scopea por empresa activa vía TenantScope.
        $cobros = Cobro::query()
            ->pendientes()
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->join('inversiones', 'cobros.inversion_id', '=', 'inversiones.id')
            ->select([
                'inversiones.nombre as inversion_nombre',
                'articulos.descripcion as articulo_descripcion',
                'vehiculos.patente',
                'transacciones.cantidad',
                'articulos.precio',
            ])
            ->selectRaw('articulos.precio * transacciones.cantidad as subtotal')
            ->orderBy('inversiones.nombre')
            ->get();

        $writer = SimpleExcelWriter::streamDownload('cobros-'.now()->format('Y-m-d').'.xlsx');
        $writer->addHeader(['Inversión', 'Artículo', 'Patente', 'Cantidad', 'Precio', 'Subtotal']);

        foreach ($cobros as $row) {
            $writer->addRow([
                $row->inversion_nombre,
                $row->articulo_descripcion,
                $row->patente,
                $row->cantidad,
                round((float) $row->precio, 2),
                round((float) $row->subtotal, 2),
            ]);
        }

        return $writer->toBrowser();
    }

    /**
     * Excel del período actual de recaudaciones, agrupado por inversión.
     */
    public function recaudacionesActuales(Request $request): StreamedResponse
    {
        $apertura = AperturaRecaudacion::abierta()
            ->with([
                'recaudaciones.vehiculo:id,patente,inversion_id',
                'recaudaciones.vehiculo.inversion:id,nombre',
                'recaudaciones.chofer:id,name',
            ])
            ->latest()
            ->first();

        $filas = ($apertura?->recaudaciones ?? collect())
            ->map(fn (Recaudacion $r) => [
                'inversion' => $r->vehiculo?->inversion?->nombre ?? 'Sin inversión',
                'patente'   => $r->vehiculo?->patente ?? 'N/A',
                'chofer'    => $r->chofer?->name ?? 'N/A',
                'efectivo'  => round((float) $r->efectivo, 2),
                'transf'    => round((float) $r->transferencia, 2),
                'total'     => round((float) $r->total, 2),
                'estado'    => $r->total >= max((float) $r->precio - (float) $r->descuento, 0) ? 'Pagado' : 'Deuda',
            ])
            ->sortBy([['inversion', SORT_NATURAL], ['patente', SORT_NATURAL]])
            ->values();

        $filename = 'recaudaciones-periodo-actual-'.now()->format('Y-m-d').'.xlsx';
        $writer = SimpleExcelWriter::streamDownload($filename);
        $writer->addHeader(['Inversión', 'Patente', 'Chofer', 'Efectivo', 'Transferencia', 'Total', 'Estado']);

        foreach ($filas as $f) {
            $writer->addRow([$f['inversion'], $f['patente'], $f['chofer'], $f['efectivo'], $f['transf'], $f['total'], $f['estado']]);
        }

        $writer->addRow(['', '', 'TOTAL', $filas->sum('efectivo'), $filas->sum('transf'), $filas->sum('total'), '']);

        return $writer->toBrowser();
    }

    public function recaudacionesDescuentos(): StreamedResponse
    {
        $apertura = AperturaRecaudacion::abierta()
            ->with([
                'recaudaciones.vehiculo:id,patente,inversion_id',
                'recaudaciones.vehiculo.inversion:id,nombre',
                'recaudaciones.chofer:id,name',
            ])
            ->latest()
            ->first();

        $filas = ($apertura?->recaudaciones ?? collect())
            ->filter(fn (Recaudacion $r) => (float) $r->descuento > 0)
            ->map(fn (Recaudacion $r) => [
                'inversion'   => $r->vehiculo?->inversion?->nombre ?? 'Sin inversión',
                'patente'     => $r->vehiculo?->patente ?? 'N/A',
                'chofer'      => $r->chofer?->name ?? 'N/A',
                'descuento'   => round((float) $r->descuento, 2),
                'descripcion' => $r->descripcion ?? '',
                'estado'      => $r->total >= max((float) $r->precio - (float) $r->descuento, 0) ? 'Pagado' : 'Deuda',
            ])
            ->sortBy([['inversion', SORT_NATURAL], ['patente', SORT_NATURAL]])
            ->values();

        $filename = 'recaudaciones-descuentos-'.now()->format('Y-m-d').'.xlsx';
        $writer = SimpleExcelWriter::streamDownload($filename);
        $writer->addHeader(['Inversión', 'Patente', 'Chofer', 'Descuento', 'Descripción', 'Estado']);

        foreach ($filas as $f) {
            $writer->addRow([$f['inversion'], $f['patente'], $f['chofer'], $f['descuento'], $f['descripcion'], $f['estado']]);
        }

        $writer->addRow(['', '', 'TOTAL', $filas->sum('descuento'), '', '']);

        return $writer->toBrowser();
    }
}
