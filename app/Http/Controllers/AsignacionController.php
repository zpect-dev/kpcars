<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ImportAsignacionesAction;
use App\Models\Vehiculo;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AsignacionController extends Controller
{
    public function index(Request $request, Vehiculo $vehiculo): Response
    {
        // TenantScope en Vehiculo: el route model binding ya devuelve 404 si el
        // vehículo no pertenece a la empresa activa.
        $asignaciones = $vehiculo->asignaciones()
            ->with(['conductor:id,name,dni', 'asignadoPor:id,name'])
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'conductor' => $a->conductor ? [
                    'id' => $a->conductor->id,
                    'name' => $a->conductor->name,
                    'dni' => $a->conductor->dni,
                ] : null,
                'asignado_por' => $a->asignadoPor?->name,
                'fecha_inicio' => $a->fecha_inicio?->toISOString(),
                'fecha_fin' => $a->fecha_fin?->toISOString(),
            ]);

        return Inertia::render('Asignaciones/Index', [
            'vehiculo' => [
                'id' => $vehiculo->id,
                'patente' => $vehiculo->patente,
                'marca' => $vehiculo->marca,
                'modelo' => $vehiculo->modelo,
                'anio' => $vehiculo->anio,
            ],
            'asignaciones' => $asignaciones,
        ]);
    }

    public function pdf(Request $request, Vehiculo $vehiculo): \Illuminate\Http\Response
    {
        $asignaciones = $vehiculo->asignaciones()
            ->with(['conductor:id,name,dni', 'asignadoPor:id,name'])
            ->get();

        $pdf = Pdf::loadView('pdf.asignaciones', compact('vehiculo', 'asignaciones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download("asignaciones-{$vehiculo->patente}-".now()->format('Y-m-d').'.pdf');
    }

    public function import(Request $request, ImportAsignacionesAction $action): RedirectResponse
    {
        Gate::authorize('import-asignaciones');

        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
        ]);

        try {
            $file = $request->file('file');
            $action->execute($file->path(), $file->getClientOriginalExtension(), $request->user()->id);

            return redirect()->back()->with('success', 'Asignaciones importadas correctamente.');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Error importando asignaciones: '.$e->getMessage(), ['exception' => $e]);

            return redirect()->back()->with('error', 'Error al importar el archivo. Verifique el formato y vuelva a intentar.');
        }
    }
}
