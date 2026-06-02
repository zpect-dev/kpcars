<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VehiculoController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', Vehiculo::class);

        $validated = $request->validate([
            'patente' => ['required', 'string', 'max:20', 'unique:vehiculos,patente'],
            'marca' => ['required', 'string', 'max:100'],
            'modelo' => ['required', 'string', 'max:100'],
            'anio' => ['required', 'string', 'max:10'],
            'propietario' => ['nullable', 'string', 'max:255'],
            'estado_patente' => ['nullable', Rule::in(['buen_estado', 'mal_estado', 'provisional', 'no_posee'])],
            'inversion_id' => ['required', 'exists:inversiones,id'],
            'empresa_id' => ['nullable', 'exists:empresas,id'],
            'user_id' => ['nullable', Rule::exists('users', 'id')->where('inactivo', 0)],
            'fecha_vencimiento_vtv' => ['nullable', 'date_format:Y-m'],
            'fecha_vencimiento_gnc' => ['nullable', 'date_format:Y-m'],
        ], [
            'user_id.exists' => 'No se puede asignar un conductor inactivo.',
        ]);

        $validated['patente'] = strtoupper(trim($validated['patente']));

        if (! empty($validated['fecha_vencimiento_vtv'])) {
            $validated['fecha_vencimiento_vtv'] .= '-01';
        }

        if (! empty($validated['fecha_vencimiento_gnc'])) {
            $validated['fecha_vencimiento_gnc'] .= '-01';
        }

        $empresaActiva = session('active_company_id');
        if ($empresaActiva) {
            $validated['empresa_id'] = (int) $empresaActiva;
        }

        DB::transaction(function () use ($validated, $request) {
            $vehiculo = Vehiculo::create($validated);

            // Si se asigna conductor al crear, asegurar que no tenga otro vehículo
            if (! empty($validated['user_id'])) {
                $prevVehiculoIds = Vehiculo::where('user_id', $validated['user_id'])
                    ->where('id', '!=', $vehiculo->id)
                    ->pluck('id');

                if ($prevVehiculoIds->isNotEmpty()) {
                    Vehiculo::whereIn('id', $prevVehiculoIds)->update(['user_id' => null]);
                    Asignacion::whereIn('vehiculo_id', $prevVehiculoIds)
                        ->whereNull('fecha_fin')
                        ->update(['fecha_fin' => now()]);
                }

                Asignacion::create([
                    'vehiculo_id' => $vehiculo->id,
                    'conductor_id' => $validated['user_id'],
                    'asignado_por' => $request->user()->id,
                    'fecha_inicio' => now(),
                ]);
            }
        });

        return redirect()->back()->with('success', "Vehículo {$validated['patente']} registrado correctamente.");
    }

    public function update(Request $request, Vehiculo $vehiculo): RedirectResponse
    {
        $this->authorize('update', $vehiculo);

        $validated = $request->validate([
            'patente' => ['required', 'string', 'max:20', "unique:vehiculos,patente,{$vehiculo->id}"],
            'marca' => ['required', 'string', 'max:100'],
            'modelo' => ['required', 'string', 'max:100'],
            'anio' => ['required', 'string', 'max:10'],
            'propietario' => ['nullable', 'string', 'max:255'],
            'estado_patente' => ['nullable', Rule::in(['buen_estado', 'mal_estado', 'provisional', 'no_posee'])],
            'inversion_id' => ['required', 'exists:inversiones,id'],
            'empresa_id' => ['nullable', 'exists:empresas,id'],
            'user_id' => ['nullable', Rule::exists('users', 'id')->where('inactivo', 0)],
            'fecha_vencimiento_vtv' => ['nullable', 'date_format:Y-m'],
            'fecha_vencimiento_gnc' => ['nullable', 'date_format:Y-m'],
        ], [
            'user_id.exists' => 'No se puede asignar un conductor inactivo.',
        ]);

        $validated['patente'] = strtoupper(trim($validated['patente']));

        if (! empty($validated['fecha_vencimiento_vtv'])) {
            $validated['fecha_vencimiento_vtv'] .= '-01';
        }

        if (! empty($validated['fecha_vencimiento_gnc'])) {
            $validated['fecha_vencimiento_gnc'] .= '-01';
        }

        $empresaActiva = session('active_company_id');
        if ($empresaActiva) {
            $validated['empresa_id'] = (int) $empresaActiva;
        }
        // Si el vehículo no pertenece a la empresa activa, el TenantScope ya lo
        // habría filtrado y la inyección de ruta devolvería 404 antes de llegar aquí.

        DB::transaction(function () use ($validated, $vehiculo, $request) {
            $conductorAnterior = $vehiculo->user_id;
            $conductorNuevo = $validated['user_id'] ?? null;

            $vehiculo->update($validated);

            // Solo registrar si el conductor cambió
            if ($conductorAnterior != $conductorNuevo) {
                // Cerrar asignación activa anterior
                Asignacion::where('vehiculo_id', $vehiculo->id)
                    ->whereNull('fecha_fin')
                    ->update(['fecha_fin' => now()]);

                // Abrir nueva asignación si hay conductor nuevo
                if ($conductorNuevo) {
                    $prevVehiculoIds = Vehiculo::where('user_id', $conductorNuevo)
                        ->where('id', '!=', $vehiculo->id)
                        ->pluck('id');

                    if ($prevVehiculoIds->isNotEmpty()) {
                        Vehiculo::whereIn('id', $prevVehiculoIds)->update(['user_id' => null]);
                        Asignacion::whereIn('vehiculo_id', $prevVehiculoIds)
                            ->whereNull('fecha_fin')
                            ->update(['fecha_fin' => now()]);
                    }

                    Asignacion::create([
                        'vehiculo_id' => $vehiculo->id,
                        'conductor_id' => $conductorNuevo,
                        'asignado_por' => $request->user()->id,
                        'fecha_inicio' => now(),
                    ]);
                }
            }
        });

        return redirect()->back()->with('success', "Vehículo {$validated['patente']} actualizado correctamente.");
    }

    /**
     * Actualiza sólo el estado de la patente (edición rápida desde el badge).
     */
    public function updateEstadoPatente(Request $request, Vehiculo $vehiculo): RedirectResponse
    {
        $this->authorize('update', $vehiculo);

        $validated = $request->validate([
            'estado_patente' => ['nullable', Rule::in(['buen_estado', 'mal_estado', 'provisional', 'no_posee'])],
        ]);

        $vehiculo->update(['estado_patente' => $validated['estado_patente'] ?? null]);

        return redirect()->back()->with('success', 'Estado de la patente actualizado.');
    }

    public function desasignar(Request $request, Vehiculo $vehiculo): RedirectResponse
    {
        $this->authorize('desasignar', $vehiculo);

        if (! $vehiculo->user_id) {
            return redirect()->back()->with('warning', 'El vehículo no tiene un conductor asignado.');
        }

        DB::transaction(function () use ($vehiculo) {
            // Cerrar asignación activa
            Asignacion::where('vehiculo_id', $vehiculo->id)
                ->whereNull('fecha_fin')
                ->update(['fecha_fin' => now()]);

            // Quitar conductor del vehículo
            $vehiculo->update(['user_id' => null]);
        });

        return redirect()->back()->with('success', "Conductor desasignado correctamente del vehículo {$vehiculo->patente}.");
    }

    public function destroy(Request $request, Vehiculo $vehiculo): RedirectResponse
    {
        $this->authorize('delete', $vehiculo);

        $patente = $vehiculo->patente;
        $vehiculo->delete();

        return redirect()->back()->with('success', "Vehículo {$patente} eliminado correctamente.");
    }
}
