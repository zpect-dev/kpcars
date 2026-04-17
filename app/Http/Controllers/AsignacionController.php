<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Vehiculo;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AsignacionController extends Controller
{
    public function index(Vehiculo $vehiculo): Response
    {
        $asignaciones = $vehiculo->asignaciones()
            ->with(['conductor:id,name,dni', 'asignadoPor:id,name'])
            ->get()
            ->map(fn($a) => [
                'id'           => $a->id,
                'conductor'    => $a->conductor ? [
                    'id'   => $a->conductor->id,
                    'name' => $a->conductor->name,
                    'dni'  => $a->conductor->dni,
                ] : null,
                'asignado_por' => $a->asignadoPor?->name,
                'fecha_inicio' => $a->fecha_inicio?->toISOString(),
                'fecha_fin'    => $a->fecha_fin?->toISOString(),
            ]);

        return Inertia::render('Asignaciones/Index', [
            'vehiculo'    => [
                'id'     => $vehiculo->id,
                'patente' => $vehiculo->patente,
                'marca'   => $vehiculo->marca,
                'modelo'  => $vehiculo->modelo,
                'anio'    => $vehiculo->anio,
            ],
            'asignaciones' => $asignaciones,
        ]);
    }

    public function pdf(Vehiculo $vehiculo): \Illuminate\Http\Response
    {
        $asignaciones = $vehiculo->asignaciones()
            ->with(['conductor:id,name,dni', 'asignadoPor:id,name'])
            ->get();

        $pdf = Pdf::loadView('pdf.asignaciones', compact('vehiculo', 'asignaciones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download("asignaciones-{$vehiculo->patente}-" . now()->format('Y-m-d') . '.pdf');
    }
}
