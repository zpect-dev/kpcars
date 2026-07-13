<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessCierreUnificadoAction;
use App\Models\AperturaRecaudacion;
use App\Models\CierreRecaudacion;
use App\Models\Empresa;
use App\Models\Recaudacion;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class RecaudacionController extends Controller
{
    /**
     * Display the recaudaciones table for the active company (current period).
     */
    public function index(Request $request): Response
    {
        $this->authorize('view-recaudaciones');

        // Apertura abierta de la empresa activa (TenantScope la scopea).
        $apertura = AperturaRecaudacion::abierta()
            ->with('user:id,name')
            ->latest()
            ->first();

        $filas = collect();

        if ($apertura !== null) {
            $apertura->load([
                'recaudaciones.vehiculo:id,patente,inversion_id',
                'recaudaciones.vehiculo.inversion:id,nombre',
                'recaudaciones.chofer:id,name,correo,telefono',
            ]);

            $filas = $apertura->recaudaciones
                ->map(function (Recaudacion $r) {
                    $total = (float) $r->total;
                    $descuento = (float) $r->descuento;
                    $precio = (float) $r->precio;
                    $precioEfectivo = max($precio - $descuento, 0);

                    return [
                        'vehiculo_id' => $r->vehiculo_id,
                        'inversion_nombre' => $r->vehiculo?->inversion?->nombre ?? 'Sin inversión',
                        'patente' => $r->vehiculo?->patente ?? 'N/A',
                        'chofer' => $r->chofer?->name ?? 'N/A',
                        'chofer_telefono' => $r->chofer?->telefono,
                        'chofer_correo' => $r->chofer?->correo,
                        'precio' => $precio,
                        'efectivo' => (float) $r->efectivo,
                        'transferencia' => (float) $r->transferencia,
                        'total' => $total,
                        'descuento' => $descuento,
                        'descripcion' => $r->descripcion ?? '',
                        'deuda' => max($precioEfectivo - $total, 0),
                        'estado' => $total >= $precioEfectivo ? 'pagado' : 'deuda',
                    ];
                })
                ->sortBy('patente', SORT_NATURAL | SORT_FLAG_CASE)
                ->sortBy('inversion_nombre', SORT_NATURAL | SORT_FLAG_CASE)
                ->values();
        }

        $ultimo = CierreRecaudacion::with('user:id,name')->latest()->first();

        // Ganancia potencial: lo que recaudaría la empresa si TODOS los autos de la
        // flota estuvieran alquilados (con chofer). Suma el precio de cada vehículo
        // de la empresa activa, excluyendo el ficticio EXTERNO. El TenantScope lo
        // limita a la empresa activa.
        $gananciaPotencial = (float) Vehiculo::query()
            ->where('patente', '!=', 'EXTERNO')
            ->sum('precio');

        return Inertia::render('Recaudaciones/Index', [
            'abierta' => $apertura !== null,
            'apertura' => $apertura
                ? ['id' => $apertura->id, 'user' => $apertura->user, 'created_at' => $apertura->created_at]
                : null,
            'filas' => $filas,
            'totalGeneral' => $filas->sum('total'),
            'gananciaPotencial' => $gananciaPotencial,
            'ultimoCierre' => $ultimo
                ? ['id' => $ultimo->id, 'user' => $ultimo->user, 'created_at' => $ultimo->created_at]
                : null,
            'cierreUnificado' => $this->datosCierreUnificado(),
        ]);
    }

    /**
     * Datos para el modal del cierre unificado: estado de la apertura de cada
     * empresa (el cierre exige que TODAS estén abiertas), los socios deudores
     * con su deuda por inversión para registrar los abonos, y los vehículos
     * cuya inversión pertenece a otra empresa (bloquean el cierre).
     *
     * @return array{empresas: mixed, deudores: mixed, vehiculosCruzados: mixed}
     */
    private function datosCierreUnificado(): array
    {
        // Aperturas abiertas de TODAS las empresas (bypass del TenantScope).
        $aperturasAbiertas = AperturaRecaudacion::withoutGlobalScope(TenantScope::class)
            ->abierta()
            ->get()
            ->keyBy('empresa_id');

        // Total recaudado hasta ahora en el período abierto de cada empresa.
        $totalesAbiertos = DB::table('recaudaciones')
            ->whereIn('apertura_id', $aperturasAbiertas->pluck('id'))
            ->whereNull('cierre_id')
            ->groupBy('empresa_id')
            ->selectRaw('empresa_id, SUM(total) as total')
            ->pluck('total', 'empresa_id');

        $empresas = Empresa::orderBy('id')->get()->map(fn (Empresa $e) => [
            'id' => $e->id,
            'nombre' => $e->nombre,
            'apertura_abierta' => $aperturasAbiertas->has($e->id),
            'total_recaudado' => (float) ($totalesAbiertos[$e->id] ?? 0),
        ])->values();

        // Socios deudores (pivot deuda > 0) de todas las empresas, con el
        // detalle por inversión en el mismo orden de la cascada de abonos.
        $filasDeuda = DB::table('inversion_user')
            ->join('users', 'inversion_user.user_id', '=', 'users.id')
            ->join('inversiones', 'inversion_user.inversion_id', '=', 'inversiones.id')
            ->join('empresas', 'inversiones.empresa_id', '=', 'empresas.id')
            ->where('inversion_user.deuda', '>', 0)
            ->orderBy('users.name')
            ->orderByRaw('LENGTH(inversiones.nombre), inversiones.nombre')
            ->get([
                'users.id as user_id',
                'users.name as user_name',
                'inversiones.id as inversion_id',
                'inversiones.nombre as inversion_nombre',
                'empresas.nombre as empresa_nombre',
                'inversion_user.deuda as deuda',
            ]);

        $deudores = $filasDeuda
            ->groupBy('user_id')
            ->map(fn ($filas) => [
                'user_id' => $filas->first()->user_id,
                'name' => $filas->first()->user_name,
                'deuda_total' => (float) $filas->sum('deuda'),
                'inversiones' => $filas->map(fn ($f) => [
                    'inversion_id' => $f->inversion_id,
                    'inversion' => $f->inversion_nombre,
                    'empresa' => $f->empresa_nombre,
                    'deuda' => (float) $f->deuda,
                ])->values(),
            ])
            ->values();

        // Vehículos del período cuya inversión es de OTRA empresa: la Action
        // rechaza el cierre; se anticipan acá para avisar en el modal.
        $vehiculosCruzados = DB::table('recaudaciones')
            ->whereIn('recaudaciones.apertura_id', $aperturasAbiertas->pluck('id'))
            ->whereNull('recaudaciones.cierre_id')
            ->join('vehiculos', 'recaudaciones.vehiculo_id', '=', 'vehiculos.id')
            ->join('inversiones', 'vehiculos.inversion_id', '=', 'inversiones.id')
            ->whereColumn('inversiones.empresa_id', '!=', 'recaudaciones.empresa_id')
            ->pluck('vehiculos.patente')
            ->unique()
            ->values();

        return [
            'empresas' => $empresas,
            'deudores' => $deudores,
            'vehiculosCruzados' => $vehiculosCruzados,
        ];
    }

    /**
     * Open a new recaudaciones period, snapshotting the current vehicle/driver
     * assignments into frozen rows. The list stays fixed until the period is closed.
     */
    public function abrir(Request $request): RedirectResponse
    {
        $this->authorize('manage-recaudaciones');

        // No permitir dos aperturas abiertas a la vez.
        if (AperturaRecaudacion::abierta()->exists()) {
            return redirect()->back()->with('warning', 'Ya hay una recaudación abierta.');
        }

        // Vehículos elegibles en este instante: con chofer asignado y no EXTERNO.
        $vehiculos = Vehiculo::query()
            ->whereNotNull('user_id')
            ->where('patente', '!=', 'EXTERNO')
            ->get(['id', 'empresa_id', 'user_id', 'precio']);

        if ($vehiculos->isEmpty()) {
            return redirect()->back()->with('warning', 'No hay vehículos con chofer para abrir la recaudación.');
        }

        DB::transaction(function () use ($vehiculos) {
            $apertura = AperturaRecaudacion::create([
                'empresa_id' => session('active_company_id'),
                'user_id' => auth()->id(),
            ]);

            // Una fila congelada por vehículo: snapshot de precio y chofer (user_id).
            foreach ($vehiculos as $v) {
                Recaudacion::create([
                    'vehiculo_id' => $v->id,
                    'user_id' => $v->user_id,
                    'empresa_id' => $v->empresa_id,
                    'apertura_id' => $apertura->id,
                    'efectivo' => 0,
                    'transferencia' => 0,
                    'total' => 0,
                    'descuento' => 0,
                    'precio' => (float) $v->precio,
                    'descripcion' => null,
                ]);
            }
        });

        return redirect()->back()->with('success', 'Recaudación abierta. La lista quedó congelada.');
    }

    /**
     * List the historical recaudacion closings for the active company.
     */
    public function historial(Request $request): Response
    {
        $this->authorize('view-recaudaciones');

        $cierres = CierreRecaudacion::with('user:id,name')
            ->withCount('recaudaciones')
            ->withSum('recaudaciones', 'total')
            ->latest()
            ->get()
            ->map(fn (CierreRecaudacion $c) => [
                'id' => $c->id,
                'user' => $c->user,
                'total' => (float) ($c->recaudaciones_sum_total ?? 0),
                'vehiculos_count' => (int) $c->recaudaciones_count,
                'created_at' => $c->created_at,
            ]);

        return Inertia::render('Recaudaciones/Historial', [
            'cierres' => $cierres,
        ]);
    }

    /**
     * Show the full detail of a closing with every recaudacion (paid, partial, debt).
     */
    public function showCierre(Request $request, CierreRecaudacion $cierreRecaudacion): Response
    {
        $this->authorize('view-recaudaciones');

        $cierreRecaudacion->load([
            'user:id,name',
            'recaudaciones.vehiculo:id,patente,inversion_id',
            'recaudaciones.vehiculo.inversion:id,nombre',
            'recaudaciones.chofer:id,name',
        ]);

        $filas = $cierreRecaudacion->recaudaciones
            ->map(function (Recaudacion $r) {
                $precio = (float) $r->precio;
                $descuento = (float) $r->descuento;
                $total = (float) $r->total;
                $precioEfectivo = max($precio - $descuento, 0);

                return [
                    'id' => $r->id,
                    'vehiculo_id' => $r->vehiculo_id,
                    'inversion_nombre' => $r->vehiculo?->inversion?->nombre ?? 'Sin inversión',
                    'patente' => $r->vehiculo?->patente ?? 'N/A',
                    'chofer' => $r->chofer?->name ?? 'N/A',
                    'precio' => $precio,
                    'efectivo' => (float) $r->efectivo,
                    'transferencia' => (float) $r->transferencia,
                    'total' => $total,
                    'descuento' => $descuento,
                    'descripcion' => $r->descripcion ?? '',
                    'deuda' => max($precioEfectivo - $total, 0),
                    'estado' => $total >= $precioEfectivo ? 'pagado' : 'deuda',
                ];
            })
            ->sortBy('patente', SORT_NATURAL | SORT_FLAG_CASE)
            ->sortBy('inversion_nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        return Inertia::render('Recaudaciones/Cierre', [
            'cierre' => [
                'id' => $cierreRecaudacion->id,
                'user' => $cierreRecaudacion->user,
                'created_at' => $cierreRecaudacion->created_at,
            ],
            'filas' => $filas,
            'totalGeneral' => $filas->sum('total'),
        ]);
    }

    /**
     * Store/update the open recaudacion for a vehicle (current period).
     */
    public function update(Request $request, Vehiculo $vehiculo): RedirectResponse
    {
        $this->authorize('manage-recaudaciones');

        // La fila ya existe congelada desde la apertura; si no hay período abierto
        // o el vehículo no entró en la foto, no se puede cargar.
        $recaudacion = Recaudacion::abiertas()
            ->where('vehiculo_id', $vehiculo->id)
            ->first();

        if ($recaudacion === null) {
            throw ValidationException::withMessages([
                'transferencia' => 'No hay una recaudación abierta para este vehículo. Abrí una recaudación primero.',
            ]);
        }

        $validated = $this->validatePayload($request);

        $efectivo = (float) $validated['efectivo'];
        $transferencia = (float) $validated['transferencia'];
        $descuento = (float) $validated['descuento'];
        $total = $efectivo + $transferencia;

        // Se usa el precio congelado en la fila, no el actual del vehículo.
        $this->assertNoSupera($total, (float) $recaudacion->precio, $descuento);

        $recaudacion->update([
            'efectivo' => $efectivo,
            'transferencia' => $transferencia,
            'total' => $total,
            'descuento' => $descuento,
            'descripcion' => $validated['descripcion'] ?? null,
        ]);

        return redirect()->back()->with('success', "Recaudación de {$vehiculo->patente} guardada.");
    }

    /**
     * Update a single recaudacion record (used to edit closed cierres).
     * The snapshot precio of the record is kept; only collected amounts change.
     */
    public function updateRegistro(Request $request, Recaudacion $recaudacion): RedirectResponse
    {
        $this->authorize('manage-recaudaciones');

        $validated = $this->validatePayload($request);

        $efectivo = (float) $validated['efectivo'];
        $transferencia = (float) $validated['transferencia'];
        $descuento = (float) $validated['descuento'];
        $total = $efectivo + $transferencia;

        $this->assertNoSupera($total, (float) $recaudacion->precio, $descuento);

        $recaudacion->update([
            'efectivo' => $efectivo,
            'transferencia' => $transferencia,
            'total' => $total,
            'descuento' => $descuento,
            'descripcion' => $validated['descripcion'] ?? null,
        ]);

        return redirect()->back()->with('success', 'Registro actualizado.');
    }

    /**
     * Cierre UNIFICADO: congela las recaudaciones abiertas de ambas empresas
     * a la vez y dispara el cálculo de sueldos de los socios (con los abonos
     * de deuda seleccionados en el modal).
     */
    public function cierre(Request $request, ProcessCierreUnificadoAction $action): RedirectResponse
    {
        $this->authorize('manage-recaudaciones');

        $validated = $request->validate([
            'tasa' => ['required', 'numeric', 'min:0.0001', 'max:9999999999.9999'],
        ]);

        try {
            $cierre = $action->execute((float) $validated['tasa'], $request->user());
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return redirect()->route('cierres-sueldo.show', $cierre->id)
            ->with('success', 'Cierre unificado ejecutado correctamente.');
    }

    /**
     * @return array{efectivo: mixed, transferencia: mixed, descuento: mixed, descripcion: ?string}
     */
    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'efectivo' => ['required', 'numeric', 'min:0'],
            'transferencia' => ['required', 'numeric', 'min:0'],
            'descuento' => ['required', 'numeric', 'min:0'],
            'descripcion' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    /**
     * The collected total cannot exceed the price minus the discount.
     */
    private function assertNoSupera(float $total, float $precio, float $descuento): void
    {
        $precioEfectivo = max($precio - $descuento, 0);

        if ($total > $precioEfectivo) {
            throw ValidationException::withMessages([
                'transferencia' => 'El total (efectivo + transferencia) no puede superar el precio menos el descuento.',
            ]);
        }
    }
}
