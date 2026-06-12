<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request)
    {
        // El middleware `role:administrador,administrativo` ya rechazó a
        // mecánico, chofer e inversor. La redirección a Mi Cuenta para
        // inversor vive en la ruta home (`/`).
        $filters = $request->only(['inversion_id']);

        // Vehiculo + Inversion ya están auto-scopeados por la empresa activa
        // de la sesión vía App\Models\Scopes\TenantScope.
        $vehiculos = Vehiculo::with(['user', 'inversion', 'empresa'])
            ->where('patente', '!=', 'EXTERNO')
            ->when(! empty($filters['inversion_id']), fn ($q) => $q->where('inversion_id', $filters['inversion_id']))
            ->orderBy('patente')
            ->get()
            ->append('documentos');

        $inversiones = Inversion::orderBy('nombre')
            ->get(['id', 'nombre'])
            ->sortBy('nombre', SORT_NATURAL)
            ->values();

        $empresas = collect();
        // Solo usuarios activos: no se puede asignar un conductor inactivo.
        $users = User::where('inactivo', false)->orderBy('name')->get(['id', 'name']);

        return Inertia::render('dashboard', [
            'vehiculos' => $vehiculos,
            'empresas' => $empresas,
            'inversiones' => $inversiones,
            'users' => $users,
            'filters' => $filters,
        ]);
    }
}
