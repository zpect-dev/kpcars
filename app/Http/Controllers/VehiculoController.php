<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\Vehiculo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VehiculoController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        abort_if($request->user()->isInversor(), 403);

        $validated = $request->validate([
            'patente'      => ['required', 'string', 'max:20', 'unique:vehiculos,patente'],
            'marca'        => ['required', 'string', 'max:100'],
            'modelo'       => ['required', 'string', 'max:100'],
            'anio'         => ['required', 'string', 'max:10'],
            'propietario'  => ['nullable', 'string', 'max:255'],
            'inversion_id' => ['required', 'exists:inversiones,id'],
            'empresa_id'   => ['nullable', 'exists:empresas,id'],
            'user_id'      => ['nullable', 'exists:users,id'],
        ]);

        $validated['patente'] = strtoupper(trim($validated['patente']));

        DB::transaction(function () use ($validated, $request) {
            $vehiculo = Vehiculo::create($validated);

            // Si se asigna conductor al crear, registrar en historial
            if (!empty($validated['user_id'])) {
                Asignacion::create([
                    'vehiculo_id'  => $vehiculo->id,
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
        abort_if($request->user()->isInversor(), 403);

        $validated = $request->validate([
            'patente'      => ['required', 'string', 'max:20', "unique:vehiculos,patente,{$vehiculo->id}"],
            'marca'        => ['required', 'string', 'max:100'],
            'modelo'       => ['required', 'string', 'max:100'],
            'anio'         => ['required', 'string', 'max:10'],
            'propietario'  => ['nullable', 'string', 'max:255'],
            'inversion_id' => ['required', 'exists:inversiones,id'],
            'empresa_id'   => ['nullable', 'exists:empresas,id'],
            'user_id'      => ['nullable', 'exists:users,id'],
        ]);

        $validated['patente'] = strtoupper(trim($validated['patente']));

        DB::transaction(function () use ($validated, $vehiculo, $request) {
            $conductorAnterior = $vehiculo->user_id;
            $conductorNuevo    = $validated['user_id'] ?? null;

            $vehiculo->update($validated);

            // Solo registrar si el conductor cambió
            if ($conductorAnterior != $conductorNuevo) {
                // Cerrar asignación activa anterior
                Asignacion::where('vehiculo_id', $vehiculo->id)
                    ->whereNull('fecha_fin')
                    ->update(['fecha_fin' => now()]);

                // Abrir nueva asignación si hay conductor nuevo
                if ($conductorNuevo) {
                    Asignacion::create([
                        'vehiculo_id'  => $vehiculo->id,
                        'conductor_id' => $conductorNuevo,
                        'asignado_por' => $request->user()->id,
                        'fecha_inicio' => now(),
                    ]);
                }
            }
        });

        return redirect()->back()->with('success', "Vehículo {$validated['patente']} actualizado correctamente.");
    }

    public function desasignar(Request $request, Vehiculo $vehiculo): RedirectResponse
    {
        abort_if($request->user()->isInversor(), 403);

        if (!$vehiculo->user_id) {
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
        abort_if($request->user()->isInversor(), 403);

        $patente = $vehiculo->patente;
        $vehiculo->delete();

        return redirect()->back()->with('success', "Vehículo {$patente} eliminado correctamente.");
    }
}
