<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\Multa;
use App\Models\MultaPago;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use App\Models\Vehiculo;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class MultaController extends Controller
{
    /**
     * Dashboard de multas: lista global de multas con su vehículo y el chofer
     * imputado, más el combo de patentes para registrar nuevas.
     */
    public function index(Request $request): InertiaResponse
    {
        $this->authorize('view-multas');

        $multas = Multa::query()
            ->with([
                'vehiculo' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)->select('id', 'patente', 'marca', 'modelo'),
                'conductor:id,name,inactivo',
                'pagos',
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
                'conductor_inactivo' => (bool) ($m->conductor?->inactivo ?? false),
                'fecha' => $m->fecha?->toDateString(),
                'fecha_vencimiento' => $m->fecha_vencimiento?->toDateString(),
                'monto' => (float) $m->monto,
                'descripcion' => $m->descripcion,
                'punto_rojo' => $m->punto_rojo,
                'jurisdiccion' => $m->jurisdiccion,
                'pdf_url' => $m->pdf_path ? Storage::disk('public')->url($m->pdf_path) : null,
                'pagado' => $m->pagado,
                'cobrado' => $m->cobrado,
                'cobrada_en' => $m->cobrada_en?->toDateString(),
                'monto_cobrado' => (float) $m->monto_cobrado,
                'pagos' => $m->pagos->map(fn (MultaPago $p) => [
                    'id' => $p->id,
                    'fecha' => $p->fecha?->toDateString(),
                    'monto' => (float) $p->monto,
                    'comprobante_url' => $p->comprobante_path ? Storage::disk('public')->url($p->comprobante_path) : null,
                ])->values(),
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
     * PDF de multas.
     * Sin ?id → exporta todas agrupadas por ?tipo (vehiculo|chofer).
     * Con ?id → exporta solo las de ese vehículo/chofer.
     */
    public function pdf(Request $request): Response
    {
        $this->authorize('view-multas');

        $tipo  = $request->query('tipo', 'vehiculo');
        $id    = $request->query('id');
        $q     = $request->query('q');
        $juris = $request->query('jurisdiccion');
        $sis   = $request->query('sistema');
        $chof  = $request->query('chofer');
        $pr    = $request->query('punto_rojo');
        $inact = $request->query('inactivo');
        $desde = $request->query('desde');
        $hasta = $request->query('hasta');

        $query = Multa::query()
            ->with([
                'vehiculo' => fn ($q2) => $q2->withoutGlobalScope(TenantScope::class)->select('id', 'patente', 'marca', 'modelo'),
                'conductor:id,name',
            ])
            ->orderByDesc('fecha');

        // Filtros compartidos con la vista
        if ($q) {
            $query->where(fn ($q2) => $q2
                ->whereHas('vehiculo', fn ($q3) => $q3->withoutGlobalScope(TenantScope::class)->where('patente', 'like', "%{$q}%"))
                ->orWhereHas('conductor', fn ($q3) => $q3->where('name', 'like', "%{$q}%"))
            );
        }
        if ($juris) $query->where('jurisdiccion', $juris);
        if ($sis === 'si') $query->where('pagado', true);
        if ($sis === 'no') $query->where('pagado', false);
        if ($chof === 'si') $query->where('cobrado', true);
        if ($chof === 'no') $query->where('cobrado', false);
        if ($pr) $query->where('punto_rojo', true);
        if ($inact) $query->whereHas('conductor', fn ($q2) => $q2->where('inactivo', true));
        $venc = $request->query('vencimiento');
        if ($venc === 'no-vencida') $query->whereNotNull('fecha_vencimiento')->whereDate('fecha_vencimiento', '>=', today());
        if ($venc === 'vencida') $query->whereNotNull('fecha_vencimiento')->whereDate('fecha_vencimiento', '<', today());
        if ($desde) $query->whereDate('fecha', '>=', $desde);
        if ($hasta) $query->whereDate('fecha', '<=', $hasta);

        $esGlobal = !$id;

        if ($tipo === 'vehiculo' && $id) {
            $query->where('vehiculo_id', $id);
            $titulo = Vehiculo::withoutGlobalScope(TenantScope::class)->find($id)?->patente ?? 'Vehículo';
        } elseif ($tipo === 'chofer' && $id === '0') {
            $query->whereNull('conductor_id');
            $titulo = 'Sin chofer';
        } elseif ($tipo === 'chofer' && $id) {
            $query->where('conductor_id', $id);
            $titulo = User::find($id)?->name ?? 'Chofer';
        } else {
            $titulo = $tipo === 'chofer' ? 'Todas — Por chofer' : 'Todas — Por vehículo';
        }

        $multas = $query->get()->map(fn (Multa $m) => [
            'fecha'            => $m->fecha?->format('d/m/Y'),
            'fecha_vencimiento'=> $m->fecha_vencimiento?->format('d/m/Y'),
            'patente'          => $m->vehiculo?->patente ?? 'N/A',
            'conductor'        => $m->conductor?->name,
            'descripcion'      => $m->descripcion,
            'jurisdiccion'     => $m->jurisdiccion,
            'punto_rojo'       => $m->punto_rojo,
            'monto'            => (float) $m->monto,
            'pagado'           => $m->pagado,
            'cobrado'          => $m->cobrado,
        ]);

        $totalMonto = $multas->where('punto_rojo', false)->sum('monto');
        $sinPagar   = $multas->where('pagado', false)->where('punto_rojo', false)->sum('monto');
        $sinCobrar  = $multas->where('cobrado', false)->where('punto_rojo', false)->sum('monto');

        // Export global: agrupar por vehículo o chofer
        $grupos = null;
        if ($esGlobal) {
            $grupos = ($tipo === 'chofer'
                ? $multas->groupBy('conductor')
                : $multas->groupBy('patente')
            )->map(fn ($ms) => [
                'label'    => $ms->first()[$tipo === 'chofer' ? 'conductor' : 'patente'] ?? 'Sin chofer',
                'multas'   => $ms,
                'total'    => $ms->where('punto_rojo', false)->sum('monto'),
                'adeudado' => $ms->where('cobrado', false)->where('punto_rojo', false)->sum('monto'),
            ])->sortByDesc('adeudado')->values();
        }

        $pdf = Pdf::loadView('pdf.multas', compact('multas', 'titulo', 'tipo', 'totalMonto', 'sinPagar', 'sinCobrar', 'esGlobal', 'grupos'));
        $pdf->setPaper('a4', 'landscape');

        $filename = 'multas-' . str($titulo)->slug() . '-' . now()->format('Ymd') . '.pdf';

        return $pdf->download($filename);
    }

    public function destroy(Request $request, Multa $multa): RedirectResponse
    {
        $this->authorize('manage-multas');

        if ($multa->pdf_path) {
            Storage::disk('public')->delete($multa->pdf_path);
        }

        $multa->delete();

        return redirect()->back()->with('success', 'Multa eliminada.');
    }

    /**
     * Registra un pago del chofer (con su fecha y comprobante opcional). Admite
     * pagos parciales: la multa queda cobrada cuando la suma de los pagos alcanza
     * el total a cobrar. Con ?reset se borran todos los pagos.
     */
    public function registrarCobro(Request $request, Multa $multa): RedirectResponse
    {
        $this->authorize('manage-multas');

        // Reiniciar el cobro (deshacer): borra todos los pagos y sus comprobantes.
        if ($request->boolean('reset')) {
            foreach ($multa->pagos as $pago) {
                if ($pago->comprobante_path) {
                    Storage::disk('public')->delete($pago->comprobante_path);
                }
            }
            $multa->pagos()->delete();
            $multa->update(['cobrado' => false, 'cobrada_en' => null, 'monto_cobrado' => 0]);

            return redirect()->back()->with('success', 'Cobro reiniciado.');
        }

        // Punto rojo: sin importe, es un simple sí/no con su fecha (sin pagos).
        if ($multa->punto_rojo) {
            $validated = $request->validate(['fecha_cobro' => ['required', 'date']]);
            $multa->update(['cobrado' => true, 'cobrada_en' => $validated['fecha_cobro']]);

            return redirect()->back()->with('success', 'Multa marcada como cobrada.');
        }

        $validated = $request->validate([
            'monto' => ['required', 'numeric', 'min:0.01'],
            'fecha_cobro' => ['required', 'date'],
            'comprobante' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
        ]);

        $multa->pagos()->create([
            'monto' => $validated['monto'],
            'fecha' => $validated['fecha_cobro'],
            'comprobante_path' => $request->hasFile('comprobante')
                ? $request->file('comprobante')->store('comprobantes-multas', 'public')
                : null,
            'registrado_por' => $request->user()->id,
        ]);

        $completo = $this->recomputarCobro($multa);

        if ($completo) {
            return redirect()->back()->with('success', 'Multa cobrada por completo.');
        }

        $falta = max(round($this->montoACobrar($multa) - (float) $multa->monto_cobrado, 2), 0);

        return redirect()->back()->with('success', 'Pago parcial registrado. Falta $'.number_format($falta, 2, ',', '.').'.');
    }

    /**
     * Elimina un pago puntual del chofer y recalcula el estado del cobro.
     */
    public function eliminarPago(Request $request, Multa $multa, MultaPago $pago): RedirectResponse
    {
        $this->authorize('manage-multas');

        abort_unless($pago->multa_id === $multa->id, 404);

        if ($pago->comprobante_path) {
            Storage::disk('public')->delete($pago->comprobante_path);
        }
        $pago->delete();

        $this->recomputarCobro($multa);

        return redirect()->back()->with('success', 'Pago eliminado.');
    }

    /**
     * Recalcula monto_cobrado / cobrado / cobrada_en a partir de los pagos.
     * Devuelve si la multa quedó cobrada por completo.
     */
    private function recomputarCobro(Multa $multa): bool
    {
        $suma = round((float) $multa->pagos()->sum('monto'), 2);
        $total = $this->montoACobrar($multa);
        $completo = $suma > 0 && $suma + 0.001 >= $total;

        $multa->update([
            'monto_cobrado' => $suma,
            'cobrado' => $completo,
            'cobrada_en' => $suma > 0 ? $multa->pagos()->max('fecha') : null,
        ]);

        return $completo;
    }

    /**
     * Total a cobrar hoy: 50% si es de CABA y todavía no venció, si no el total.
     */
    private function montoACobrar(Multa $multa): float
    {
        $monto = (float) $multa->monto;

        $conDescuento = $multa->jurisdiccion === 'CABA'
            && $multa->fecha_vencimiento !== null
            && today()->lte($multa->fecha_vencimiento);

        return $conDescuento ? $monto * 0.5 : $monto;
    }
}
