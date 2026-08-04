<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CierreSueldo;
use App\Models\CierreSueldoAbono;
use App\Models\CierreSueldoPago;
use App\Models\Gasto;
use App\Models\Scopes\GastoTenantScope;
use App\Models\Scopes\TenantScope;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class MiCuentaController extends Controller
{
    /**
     * Vista del inversor: sus inversiones, deuda vigente y sueldos cobrados.
     */
    public function index(Request $request): Response
    {
        // El middleware `role:inversor` ya filtró el rol. El Gate adicional valida
        // que el inversor tenga al menos una inversión asignada.
        Gate::authorize('view-mi-cuenta');

        $user = $request->user();

        // Mi Cuenta es vista cross-empresa: muestra TODAS sus inversiones,
        // no sólo las de la empresa activa. Bypasseamos TenantScope.
        $inversiones = $user->inversiones()
            ->withoutGlobalScope(TenantScope::class)
            ->with('empresa:id,nombre')
            ->get()
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $inversionIds = $inversiones->pluck('id');

        // Cantidad de autos alquilados (asignados a un conductor) por inversión.
        // Excluye el ficticio EXTERNO.
        // Bypass de scopes vía Query Builder: la vista es cross-empresa.
        $autosPorInversion = DB::table('vehiculos')
            ->whereIn('inversion_id', $inversionIds)
            ->where('patente', '!=', 'EXTERNO')
            ->whereNotNull('user_id')
            ->groupBy('inversion_id')
            ->selectRaw('inversion_id, COUNT(*) as total')
            ->pluck('total', 'inversion_id');

        // Último cierre de recaudación por empresa: la vista muestra el período
        // YA CERRADO, no el que está corriendo. (La recaudación se cierra por
        // empresa; cross-empresa tomamos el último de cada una.)
        $ultimoCierreRecIds = DB::table('cierres_recaudacion')
            ->groupBy('empresa_id')
            ->selectRaw('MAX(id) as ultimo')
            ->pluck('ultimo')
            ->all();

        // Recaudación del ÚLTIMO PERÍODO CERRADO por inversión: suma el total
        // cobrado de todos los autos de la inversión, no la parte que le
        // corresponde al inversor. Excluye el ficticio EXTERNO.
        $recaudadoPorInversion = $ultimoCierreRecIds === [] ? collect() : DB::table('recaudaciones')
            ->join('vehiculos', 'recaudaciones.vehiculo_id', '=', 'vehiculos.id')
            ->whereIn('vehiculos.inversion_id', $inversionIds)
            ->whereIn('recaudaciones.cierre_id', $ultimoCierreRecIds)
            ->where('vehiculos.patente', '!=', 'EXTERNO')
            ->groupBy('vehiculos.inversion_id')
            ->selectRaw('vehiculos.inversion_id as inversion_id, SUM(recaudaciones.total) as total')
            ->pluck('total', 'inversion_id');

        $inversiones = $inversiones->map(fn ($inv) => [
            'id' => $inv->id,
            'nombre' => $inv->nombre,
            'empresa' => $inv->empresa,
            'es_financiador' => (bool) $inv->pivot->es_financiador,
            'deuda' => (float) $inv->pivot->deuda,
            'autos' => (int) ($autosPorInversion[$inv->id] ?? 0),
            'recaudado' => (float) ($recaudadoPorInversion[$inv->id] ?? 0),
        ]);

        // Historial de cierres en los que cobró (los cierres de sueldo son
        // globales, sin TenantScope; el bypass sólo hace falta en Inversion).
        $pagosPorCierre = CierreSueldoPago::with([
            'cierre:id,tasa,created_at',
            'inversion' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)
                ->select('id', 'nombre'),
        ])
            ->where('user_id', $user->id)
            ->orderByDesc('cierre_sueldo_id')
            ->get()
            ->groupBy('cierre_sueldo_id');

        // Abonos de deuda del inversor registrados en cada cierre.
        $abonosPorCierre = CierreSueldoAbono::where('user_id', $user->id)
            ->selectRaw('cierre_sueldo_id, SUM(monto) as total')
            ->groupBy('cierre_sueldo_id')
            ->pluck('total', 'cierre_sueldo_id');

        $cierres = $pagosPorCierre->map(function ($pagos) use ($abonosPorCierre) {
            $cierre = $pagos->first()->cierre;

            return [
                'id' => $cierre?->id,
                'fecha' => $cierre?->created_at?->toIso8601String(),
                'tasa' => $cierre?->tasa ? (float) $cierre->tasa : null,
                'total' => (float) $pagos->sum(fn (CierreSueldoPago $p) => (float) $p->monto),
                'abonado' => (float) ($abonosPorCierre[$cierre?->id] ?? 0),
                'detalles' => $pagos
                    ->map(fn (CierreSueldoPago $p) => [
                        'inversion' => $p->inversion?->nombre,
                        'concepto' => $p->concepto,
                        'monto' => (float) $p->monto,
                    ])
                    ->sortBy(fn ($d) => (string) $d['inversion'], SORT_NATURAL | SORT_FLAG_CASE)
                    ->values(),
            ];
        })->values();

        // Último cierre de caja por empresa (id + rango de fechas del período):
        // los gastos y repuestos también se muestran del período YA CERRADO. El
        // rango [inicio, fin] acota los cobros (repuestos) de ese cierre.
        $ultimaCajaPorEmpresa = [];
        DB::table('cierres_caja')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get(['id', 'empresa_id', 'created_at'])
            ->groupBy('empresa_id')
            ->each(function ($cajas, $empresaId) use (&$ultimaCajaPorEmpresa) {
                $ultima = $cajas->first();
                $previa = $cajas->get(1);
                $ultimaCajaPorEmpresa[$empresaId] = [
                    'id' => $ultima->id,
                    'inicio' => $previa->created_at ?? null, // null = primer cierre
                    'fin' => $ultima->created_at,
                ];
            });

        // CierreGasto del último cierre de caja de cada empresa (los gastos de
        // ese período tienen su cierre_gasto_id).
        $ultimaCajaIds = array_column($ultimaCajaPorEmpresa, 'id');
        $ultimoCierreGastoIds = $ultimaCajaIds === [] ? [] : DB::table('cierres_gastos')
            ->whereIn('cierre_caja_id', $ultimaCajaIds)
            ->pluck('id')
            ->all();

        // Gastos del ÚLTIMO PERÍODO CERRADO que tocan al inversor: los de flota de
        // sus inversiones (monto completo, sin dividir) + los globales de
        // galpón/taller/oficina (monto completo y la parte que le corresponde
        // según el reparto congelado en `distribucion`). Cross-empresa.
        $gastosPendientes = Gasto::query()
            ->withoutGlobalScope(GastoTenantScope::class)
            ->whereIn('cierre_gasto_id', $ultimoCierreGastoIds)
            ->with([
                'vehiculo' => fn ($q) => $q
                    ->withoutGlobalScope(TenantScope::class)
                    ->select('id', 'patente', 'marca', 'modelo', 'inversion_id'),
            ])
            ->where(function ($q) use ($inversionIds) {
                $q->whereIn('tipo', Gasto::TIPOS_GLOBALES)
                    ->orWhere(fn ($sub) => $sub
                        ->where('tipo', 'vehiculo')
                        ->whereIn('vehiculo_id', DB::table('vehiculos')
                            ->select('id')
                            ->whereIn('inversion_id', $inversionIds)));
            })
            ->latest('fecha')
            ->latest('id')
            ->get();

        $miParte = fn (Gasto $g) => (float) (($g->distribucion ?? [])[$user->id] ?? 0);

        $mapGastoItem = fn (Gasto $g) => [
            'id' => $g->id,
            'fecha' => $g->fecha?->format('Y-m-d'),
            'tipo' => $g->tipo,
            'descripcion' => $g->descripcion,
            'monto' => (float) $g->monto,
            'vehiculo' => $g->vehiculo
                ? trim("{$g->vehiculo->patente} · {$g->vehiculo->marca} {$g->vehiculo->modelo}")
                : null,
        ];

        $gastosGlobales = $gastosPendientes
            ->filter(fn (Gasto $g) => in_array($g->tipo, Gasto::TIPOS_GLOBALES, true))
            ->values();
        $gastosFlota = $gastosPendientes
            ->filter(fn (Gasto $g) => $g->tipo === 'vehiculo' && $g->vehiculo !== null)
            ->values();

        // Repuestos colocados desde inventario a los autos de sus inversiones,
        // valuados a precio de venta (precio * cantidad) — el mismo importe que
        // se le cobra a la inversión en el módulo de Cobros. Se toman los del
        // ÚLTIMO PERÍODO CERRADO: cobros cuya fecha cae en el rango del último
        // cierre de caja de su empresa. Cross-empresa, sin scopes.
        $repuestoRows = DB::table('cobros')
            ->join('transacciones', 'cobros.transaccion_id', '=', 'transacciones.id')
            ->join('articulos', 'transacciones.articulo_id', '=', 'articulos.id')
            ->join('vehiculos', 'transacciones.vehiculo_id', '=', 'vehiculos.id')
            ->where('transacciones.inactiva', false)
            ->whereIn('vehiculos.inversion_id', $inversionIds)
            ->orderByDesc('transacciones.created_at')
            ->get([
                'cobros.id as cobro_id',
                'cobros.empresa_id as empresa_id',
                'cobros.created_at as cobro_fecha',
                'transacciones.cantidad as cantidad',
                'transacciones.created_at as fecha',
                'vehiculos.inversion_id as inversion_id',
                'vehiculos.patente as patente',
                'vehiculos.marca as marca',
                'vehiculos.modelo as modelo',
                'articulos.descripcion as articulo',
                'articulos.precio as precio',
            ])
            ->filter(function ($r) use ($ultimaCajaPorEmpresa) {
                $caja = $ultimaCajaPorEmpresa[$r->empresa_id] ?? null;
                if ($caja === null) {
                    return false; // sin cierre de caja → no hay período cerrado
                }

                $antesDelFin = $r->cobro_fecha <= $caja['fin'];
                $despuesDelInicio = $caja['inicio'] === null || $r->cobro_fecha > $caja['inicio'];

                return $antesDelFin && $despuesDelInicio;
            })
            ->values();

        // Cantidad de inversores por inversión: los repuestos se reparten en
        // partes iguales (cada inversor paga total / cantidad de inversores).
        $inversoresPorInversion = DB::table('inversion_user')
            ->whereIn('inversion_id', $inversionIds)
            ->groupBy('inversion_id')
            ->selectRaw('inversion_id, COUNT(*) as total')
            ->pluck('total', 'inversion_id');

        $repuestoMonto = fn ($r) => round((float) $r->precio * (int) $r->cantidad, 2);

        $mapRepuestoItem = fn ($r) => [
            'id' => (int) $r->cobro_id,
            'fecha' => $r->fecha ? substr((string) $r->fecha, 0, 10) : null,
            'tipo' => 'repuesto',
            'descripcion' => (int) $r->cantidad > 1
                ? "{$r->articulo} ×{$r->cantidad}"
                : $r->articulo,
            'monto' => $repuestoMonto($r),
            'vehiculo' => trim("{$r->patente} · {$r->marca} {$r->modelo}"),
        ];

        $repuestosPorInversion = $repuestoRows->groupBy('inversion_id');
        $repuestosTotal = (float) $repuestoRows->sum($repuestoMonto);

        // Flota por inversión: une los gastos de vehículo (parte según el
        // reparto congelado) y los repuestos (parte igualitaria), con el
        // detalle combinado ordenado gastos primero, repuestos después.
        $gastosFlotaPorInversion = $gastosFlota
            ->groupBy(fn (Gasto $g) => $g->vehiculo->inversion_id);

        $flota = $gastosFlotaPorInversion->keys()
            ->merge($repuestosPorInversion->keys())
            ->unique()
            ->values()
            ->map(function ($invId) use (
                $gastosFlotaPorInversion,
                $repuestosPorInversion,
                $inversoresPorInversion,
                $miParte,
                $mapGastoItem,
                $mapRepuestoItem,
                $repuestoMonto,
            ) {
                $gastoItems = $gastosFlotaPorInversion->get($invId, collect());
                $repItems = $repuestosPorInversion->get($invId, collect());

                $repTotal = (float) $repItems->sum($repuestoMonto);
                $cantInversores = (int) ($inversoresPorInversion[$invId] ?? 0);
                $repMiParte = $cantInversores > 0
                    ? round($repTotal / $cantInversores, 2)
                    : 0.0;

                return [
                    'inversion_id' => (int) $invId,
                    'total' => round((float) $gastoItems->sum('monto') + $repTotal, 2),
                    'mi_parte' => round((float) $gastoItems->sum($miParte) + $repMiParte, 2),
                    'items' => $gastoItems->map($mapGastoItem)
                        ->concat($repItems->map($mapRepuestoItem))
                        ->values(),
                ];
            });

        $gastos = [
            'total' => round(
                (float) $gastosFlota->sum('monto')
                + (float) $gastosGlobales->sum('monto')
                + $repuestosTotal,
                2,
            ),
            'globales' => [
                'total' => (float) $gastosGlobales->sum('monto'),
                'mi_parte' => (float) $gastosGlobales->sum($miParte),
                'items' => $gastosGlobales->map($mapGastoItem)->values(),
            ],
            'flota' => $flota,
        ];

        // Tasa de referencia = la del último cierre de sueldos.
        $tasaActual = CierreSueldo::latest('created_at')->value('tasa');

        // Cotización global (ARS por 1 USD) para expresar los totales en dólares.
        $cotizacionDolar = (float) (Setting::get('cotizacion_dolar') ?? 0);

        return Inertia::render('MiCuenta/Index', [
            'inversiones' => $inversiones,
            'cierres' => $cierres,
            'gastos' => $gastos,
            'tasaActual' => $tasaActual ? (float) $tasaActual : null,
            'cotizacionDolar' => $cotizacionDolar,
        ]);
    }
}
