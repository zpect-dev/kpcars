<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CierreRecaudacion;
use App\Models\Recaudacion;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RecaudacionController extends Controller
{
    /**
     * Display the recaudaciones table for the active company (current period).
     */
    public function index(Request $request): Response
    {
        $this->authorize('view-recaudaciones');

        // Vehiculo se auto-scopea por empresa activa vía TenantScope.
        // Solo vehículos con chofer asignado (y no el placeholder EXTERNO).
        $vehiculos = Vehiculo::query()
            ->with(['user:id,name', 'inversion:id,nombre', 'recaudacionAbierta'])
            ->whereNotNull('user_id')
            ->where('patente', '!=', 'EXTERNO')
            ->get();

        $filas = $vehiculos
            ->map(function (Vehiculo $v) {
                $r = $v->recaudacionAbierta;
                $total = (float) ($r->total ?? 0);
                $descuento = (float) ($r->descuento ?? 0);
                $precio = (float) $v->precio;
                $precioEfectivo = max($precio - $descuento, 0);

                return [
                    'vehiculo_id' => $v->id,
                    'inversion_nombre' => $v->inversion?->nombre ?? 'Sin inversión',
                    'patente' => $v->patente,
                    'chofer' => $v->user?->name ?? 'N/A',
                    'precio' => $precio,
                    'efectivo' => (float) ($r->efectivo ?? 0),
                    'transferencia' => (float) ($r->transferencia ?? 0),
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

        $ultimo = CierreRecaudacion::with('user:id,name')->latest()->first();

        return Inertia::render('Recaudaciones/Index', [
            'filas' => $filas,
            'totalGeneral' => $filas->sum('total'),
            'ultimoCierre' => $ultimo
                ? ['id' => $ultimo->id, 'user' => $ultimo->user, 'created_at' => $ultimo->created_at]
                : null,
        ]);
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
            'recaudaciones.vehiculo:id,patente,inversion_id,user_id',
            'recaudaciones.vehiculo.inversion:id,nombre',
            'recaudaciones.vehiculo.user:id,name',
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
                    'chofer' => $r->vehiculo?->user?->name ?? 'N/A',
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

        $validated = $this->validatePayload($request);

        $efectivo = (float) $validated['efectivo'];
        $transferencia = (float) $validated['transferencia'];
        $descuento = (float) $validated['descuento'];
        $total = $efectivo + $transferencia;

        $this->assertNoSupera($total, (float) $vehiculo->precio, $descuento);

        $recaudacion = Recaudacion::abiertas()
            ->firstOrNew(['vehiculo_id' => $vehiculo->id]);

        $recaudacion->fill([
            'empresa_id' => $vehiculo->empresa_id,
            'efectivo' => $efectivo,
            'transferencia' => $transferencia,
            'total' => $total,
            'descuento' => $descuento,
            'precio' => (float) $vehiculo->precio,
            'descripcion' => $validated['descripcion'] ?? null,
        ]);
        $recaudacion->save();

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
     * Close the current recaudaciones period, snapshotting the open rows.
     */
    public function cierre(Request $request): RedirectResponse
    {
        $this->authorize('manage-recaudaciones');

        // Vehículos elegibles de la empresa activa (con chofer, no EXTERNO).
        $vehiculos = Vehiculo::query()
            ->with('recaudacionAbierta')
            ->whereNotNull('user_id')
            ->where('patente', '!=', 'EXTERNO')
            ->get();

        if ($vehiculos->isEmpty()) {
            return redirect()->back()->with('warning', 'No hay vehículos con chofer para cerrar.');
        }

        DB::transaction(function () use ($vehiculos) {
            $cierre = CierreRecaudacion::create([
                'empresa_id' => session('active_company_id'),
                'user_id' => auth()->id(),
            ]);

            // Crear filas en 0 para los vehículos que no cargaron nada (abonaron 0),
            // con snapshot del precio actual, para que el cierre incluya a TODOS.
            foreach ($vehiculos as $v) {
                if ($v->recaudacionAbierta === null) {
                    Recaudacion::create([
                        'vehiculo_id' => $v->id,
                        'empresa_id' => $v->empresa_id,
                        'efectivo' => 0,
                        'transferencia' => 0,
                        'total' => 0,
                        'descuento' => 0,
                        'precio' => (float) $v->precio,
                        'descripcion' => null,
                    ]);
                }
            }

            // Congelar todas las recaudaciones abiertas de la empresa activa
            // asignándoles este cierre. TenantScope limita el update a la empresa.
            Recaudacion::abiertas()->update(['cierre_id' => $cierre->id]);
        });

        return redirect()->back()->with('success', 'Cierre de recaudaciones ejecutado correctamente.');
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
