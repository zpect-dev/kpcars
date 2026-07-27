<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CalcularResumenAction;
use App\Http\Requests\ResumenFiltrosRequest;
use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Inertia\Inertia;
use Inertia\Response;

class ResumenController extends Controller
{
    /**
     * Resumen financiero (ingresos vs egresos). Vista GLOBAL: los catálogos y
     * las cifras ignoran la empresa activa de la sesión; la empresa es un
     * filtro más del reporte. La autorización vive en el FormRequest
     * (gate view-resumen) más el middleware role:administrador de la ruta.
     */
    public function index(ResumenFiltrosRequest $request, CalcularResumenAction $action): Response
    {
        $filtros = $request->filtros();

        // Catálogos globales para los filtros (todas las empresas).
        $empresas = Empresa::orderBy('nombre')->get(['id', 'nombre']);

        $inversiones = Inversion::query()
            ->withoutGlobalScope(TenantScope::class)
            ->with('empresa:id,nombre')
            ->get(['id', 'nombre', 'empresa_id'])
            ->map(fn (Inversion $i) => [
                'id' => $i->id,
                'nombre' => $i->nombre,
                'empresa_nombre' => $i->empresa?->nombre,
            ])
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $vehiculos = Vehiculo::query()
            ->withoutGlobalScope(TenantScope::class)
            ->where('patente', '!=', 'EXTERNO')
            ->orderBy('patente')
            ->get(['id', 'patente', 'marca', 'modelo']);

        return Inertia::render('Resumen/Index', [
            'filters' => $filtros,
            'resumen' => $action->execute($filtros),
            'empresas' => $empresas,
            'inversiones' => $inversiones,
            'vehiculos' => $vehiculos,
            'tipos' => CalcularResumenAction::TIPO_LABELS,
        ]);
    }
}
