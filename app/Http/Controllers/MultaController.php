<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\Multa;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class MultaController extends Controller
{
    /**
     * Dashboard de multas: lista global de multas con su vehículo y el chofer
     * imputado, más el combo de patentes para registrar nuevas.
     */
    public function index(Request $request): Response
    {
        $this->authorize('view-multas');

        $multas = Multa::query()
            ->with([
                'vehiculo' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)->select('id', 'patente', 'marca', 'modelo'),
                'conductor:id,name',
            ])
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Multa $m) => [
                'id' => $m->id,
                'vehiculo_id' => $m->vehiculo_id,
                'patente' => $m->vehiculo?->patente ?? 'N/A',
                'marca' => $m->vehiculo?->marca,
                'modelo' => $m->vehiculo?->modelo,
                'conductor_id' => $m->conductor_id,
                'conductor' => $m->conductor?->name,
                'fecha' => $m->fecha?->toDateString(),
                'monto' => (float) $m->monto,
                'descripcion' => $m->descripcion,
                'pagada' => $m->pagada,
            ]);

        // Combo de patentes: todos los vehículos (global), menos el ficticio EXTERNO.
        $vehiculos = Vehiculo::withoutGlobalScope(TenantScope::class)
            ->where('patente', '!=', 'EXTERNO')
            ->orderBy('patente')
            ->get(['id', 'patente', 'marca', 'modelo']);

        return Inertia::render('Multas/Index', [
            'multas' => $multas,
            'vehiculos' => $vehiculos,
        ]);
    }

    /**
     * Registra una multa e imputa el chofer según la asignación activa en la
     * fecha de la infracción. Si no había chofer asignado, queda sin imputar.
     */
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('manage-multas');

        $validated = $request->validate([
            'vehiculo_id' => ['required', 'integer'],
            'fecha' => ['required', 'date'],
            'monto' => ['required', 'numeric', 'min:0'],
            'descripcion' => ['required', 'string', 'max:1000'],
        ]);

        $vehiculo = Vehiculo::withoutGlobalScope(TenantScope::class)->findOrFail($validated['vehiculo_id']);
        $fecha = Carbon::parse($validated['fecha']);

        // Chofer imputado: asignación del vehículo vigente en esa fecha
        // (fecha_inicio <= fecha <= fecha_fin, o sin cerrar).
        $asignacion = Asignacion::query()
            ->where('vehiculo_id', $vehiculo->id)
            ->whereDate('fecha_inicio', '<=', $fecha)
            ->where(fn ($q) => $q->whereNull('fecha_fin')->orWhereDate('fecha_fin', '>=', $fecha))
            ->orderByDesc('fecha_inicio')
            ->orderByDesc('id')
            ->first();

        $conductorId = $asignacion?->conductor_id;

        Multa::create([
            'vehiculo_id' => $vehiculo->id,
            'conductor_id' => $conductorId,
            'fecha' => $fecha->toDateString(),
            'monto' => $validated['monto'],
            'descripcion' => $validated['descripcion'],
            'pagada' => false,
            'registrado_por' => $request->user()->id,
        ]);

        $conductor = $conductorId ? User::find($conductorId)?->name : null;
        $mensaje = $conductor
            ? "Multa registrada e imputada a {$conductor}."
            : 'Multa registrada (sin chofer asignado en esa fecha).';

        return redirect()->back()->with('success', $mensaje);
    }

    /**
     * Alterna el estado de pago de una multa.
     */
    public function togglePago(Request $request, Multa $multa): RedirectResponse
    {
        $this->authorize('manage-multas');

        $nuevaPagada = ! $multa->pagada;

        $multa->update([
            'pagada' => $nuevaPagada,
            'pagada_en' => $nuevaPagada ? now() : null,
        ]);

        return redirect()->back()->with('success', $nuevaPagada ? 'Multa marcada como pagada.' : 'Multa marcada como impaga.');
    }
}
