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
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
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
                'fecha_vencimiento' => $m->fecha_vencimiento?->toDateString(),
                'monto' => (float) $m->monto,
                'descripcion' => $m->descripcion,
                'punto_rojo' => $m->punto_rojo,
                'jurisdiccion' => $m->jurisdiccion,
                'pdf_url' => $m->pdf_path ? Storage::disk('public')->url($m->pdf_path) : null,
                'pagado' => $m->pagado,
                'cobrado' => $m->cobrado,
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

        // Punto rojo: no tiene importe; el monto y el vencimiento (descuento) no aplican.
        $esPuntoRojo = $request->boolean('punto_rojo');

        $validated = $request->validate([
            'vehiculo_id' => ['required', 'integer'],
            'fecha' => ['required', 'date'],
            'fecha_vencimiento' => [Rule::requiredIf(! $esPuntoRojo), 'nullable', 'date', 'after_or_equal:fecha'],
            'monto' => [Rule::requiredIf(! $esPuntoRojo), 'nullable', 'numeric', 'min:0'],
            'descripcion' => ['required', 'string', 'max:1000'],
            'punto_rojo' => ['boolean'],
            'jurisdiccion' => ['required', 'in:CABA,GBA'],
            'pdf' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
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
            'fecha_vencimiento' => $esPuntoRojo ? null : $validated['fecha_vencimiento'],
            'monto' => $esPuntoRojo ? 0 : $validated['monto'],
            'descripcion' => $validated['descripcion'],
            'punto_rojo' => $esPuntoRojo,
            'jurisdiccion' => $validated['jurisdiccion'],
            'pdf_path' => $request->hasFile('pdf') ? $request->file('pdf')->store('multas', 'public') : null,
            'pagado' => false,
            'cobrado' => false,
            'registrado_por' => $request->user()->id,
        ]);

        $conductor = $conductorId ? User::find($conductorId)?->name : null;
        $mensaje = $conductor
            ? "Multa registrada e imputada a {$conductor}."
            : 'Multa registrada (sin chofer asignado en esa fecha).';

        return redirect()->back()->with('success', $mensaje);
    }

    /**
     * Edita una multa: el PDF en todos los casos, y el monto + vencimiento solo
     * si no es de punto rojo (esas no tienen importe ni vencimiento).
     */
    public function update(Request $request, Multa $multa): RedirectResponse
    {
        $this->authorize('manage-multas');

        $rules = ['pdf' => ['nullable', 'file', 'mimes:pdf', 'max:10240']];

        if (! $multa->punto_rojo) {
            $rules['monto'] = ['required', 'numeric', 'min:0'];
            $rules['fecha_vencimiento'] = ['required', 'date', 'after_or_equal:'.$multa->fecha->toDateString()];
        }

        $validated = $request->validate($rules);

        $updates = [];

        if (! $multa->punto_rojo) {
            $updates['monto'] = $validated['monto'];
            $updates['fecha_vencimiento'] = $validated['fecha_vencimiento'];
        }

        if ($request->hasFile('pdf')) {
            if ($multa->pdf_path) {
                Storage::disk('public')->delete($multa->pdf_path);
            }
            $updates['pdf_path'] = $request->file('pdf')->store('multas', 'public');
        }

        if ($updates !== []) {
            $multa->update($updates);
        }

        return redirect()->back()->with('success', 'Multa actualizada.');
    }

    /**
     * Alterna si la multa fue pagada al organismo. Registra/limpia la fecha de pago.
     */
    public function togglePagado(Request $request, Multa $multa): RedirectResponse
    {
        $this->authorize('manage-multas');

        $nuevo = ! $multa->pagado;

        $multa->update([
            'pagado' => $nuevo,
            'pagada_en' => $nuevo ? ($multa->pagada_en ?? now()) : null,
        ]);

        return redirect()->back()->with('success', $nuevo ? 'Multa marcada como pagada.' : 'Multa marcada como no pagada.');
    }

    /**
     * Alterna si la empresa ya le cobró la multa al chofer.
     */
    public function toggleCobrado(Request $request, Multa $multa): RedirectResponse
    {
        $this->authorize('manage-multas');

        $nuevo = ! $multa->cobrado;

        $multa->update(['cobrado' => $nuevo]);

        return redirect()->back()->with('success', $nuevo ? 'Multa marcada como cobrada.' : 'Multa marcada como no cobrada.');
    }
}
