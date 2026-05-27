<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CierreInversion;
use App\Models\CierreInversionPago;
use App\Models\Cobro;
use App\Models\DeudaMovimiento;
use Illuminate\Http\Request;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExcelController extends Controller
{
    /**
     * Excel export for a cierre de inversión.
     */
    public function cierreInversion(Request $request, CierreInversion $cierreInversion): StreamedResponse
    {
        // Acceso: middleware role:administrador.

        $cierreInversion->load([
            'pagos.user:id,name,dni',
            'pagos.inversion:id,nombre',
        ]);

        $flotaConceptos = ['parte_completa', 'media_parte_deudor', 'cero_deudor'];
        $tasa = $cierreInversion->tasa ? (float) $cierreInversion->tasa : null;

        $filename = 'cierre-inversion-'.$cierreInversion->id.'-'.$cierreInversion->periodo_fin->format('Y-m-d').'.xlsx';

        $writer = SimpleExcelWriter::streamDownload($filename);

        $headers = ['Inversor', 'DNI', 'Flota ARS', 'Financiación ARS', 'Total ARS'];
        if ($tasa) {
            $headers = ['Inversor', 'DNI', 'Flota ARS', 'Flota USD', 'Financiación ARS', 'Financiación USD', 'Total ARS', 'Total USD'];
        }
        $writer->addHeader($headers);

        $porInversor = $cierreInversion->pagos
            ->groupBy('user_id')
            ->map(fn ($pagos) => ['user' => $pagos->first()->user, 'pagos' => $pagos])
            ->sortBy(fn ($row) => mb_strtolower((string) $row['user']->name))
            ->values();

        foreach ($porInversor as $row) {
            $flota = $row['pagos']->filter(fn ($p) => in_array($p->concepto, $flotaConceptos))->sum('monto');
            $financ = $row['pagos']->filter(fn ($p) => $p->concepto === 'redistribucion_financiador')->sum('monto');
            $total = $flota + $financ;

            if ($tasa) {
                $writer->addRow([
                    $row['user']->name,
                    $row['user']->dni,
                    round((float) $flota, 2),
                    round((float) $flota / $tasa, 2),
                    $financ > 0 ? round((float) $financ, 2) : '',
                    $financ > 0 ? round((float) $financ / $tasa, 2) : '',
                    round((float) $total, 2),
                    round((float) $total / $tasa, 2),
                ]);
            } else {
                $writer->addRow([
                    $row['user']->name,
                    $row['user']->dni,
                    round((float) $flota, 2),
                    $financ > 0 ? round((float) $financ, 2) : '',
                    round((float) $total, 2),
                ]);
            }
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

        // Cross-empresa: el inversor puede tener cierres en varias empresas.
        $pagosPorCierre = CierreInversionPago::with([
            'cierre' => fn ($q) => $q->withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                ->select('id', 'periodo_inicio', 'periodo_fin', 'tasa'),
        ])
            ->where('user_id', $user->id)
            ->orderByDesc('cierre_id')
            ->get()
            ->groupBy('cierre_id');

        $writer = SimpleExcelWriter::streamDownload('mi-cuenta-'.now()->format('Y-m-d').'.xlsx');
        $writer->addHeader(['Cierre #', 'Fecha', 'Flota ARS', 'Financiación ARS', 'Total ARS']);

        foreach ($pagosPorCierre as $pagos) {
            $cierre = $pagos->first()->cierre;
            $flota = $pagos->filter(fn ($p) => in_array($p->concepto, $flotaConceptos))->sum('monto');
            $financ = $pagos->filter(fn ($p) => $p->concepto === 'redistribucion_financiador')->sum('monto');
            $total = $flota + $financ;

            $writer->addRow([
                $cierre?->id,
                $cierre?->periodo_fin?->format('d/m/Y'),
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
}
