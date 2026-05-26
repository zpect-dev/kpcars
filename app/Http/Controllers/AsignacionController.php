<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ImportAsignacionesAction;
use App\Models\Vehiculo;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AsignacionController extends Controller
{
    public function index(Request $request, Vehiculo $vehiculo): Response
    {
        $this->ensureVehiculoVisible($request, $vehiculo);

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
        $this->ensureVehiculoVisible($request, $vehiculo);

        $asignaciones = $vehiculo->asignaciones()
            ->with(['conductor:id,name,dni', 'asignadoPor:id,name'])
            ->get();

        $pdf = Pdf::loadView('pdf.asignaciones', compact('vehiculo', 'asignaciones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download("asignaciones-{$vehiculo->patente}-".now()->format('Y-m-d').'.pdf');
    }

    private function ensureVehiculoVisible(Request $request, Vehiculo $vehiculo): void
    {
        $empresaId = $request->user()->restrictedEmpresaId();
        if ($empresaId && $vehiculo->empresa_id !== $empresaId) {
            abort(403);
        }
    }

    public function import(Request $request, ImportAsignacionesAction $action): RedirectResponse
    {
        abort_unless($request->user()->isAdmin(), 403, 'Solo los administradores pueden importar asignaciones.');

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
