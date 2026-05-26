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
        abort_if($request->user()->isMechanic(), 403);

        if ($request->user()->isInversor()) {
            return redirect()->route('mi-cuenta.index');
        }

        $filters = $request->only(['inversion_id']);

        // Vehiculo + Inversion ya están auto-scopeados por la empresa activa
        // de la sesión vía App\Models\Scopes\TenantScope.
        $vehiculos = Vehiculo::with(['user', 'inversion', 'empresa'])
            ->where('patente', '!=', 'EXTERNO')
            ->when(! empty($filters['inversion_id']), fn ($q) => $q->where('inversion_id', $filters['inversion_id']))
            ->orderBy('patente')
            ->get();

        $inversiones = Inversion::orderBy('nombre')
            ->get(['id', 'nombre'])
            ->sortBy('nombre', SORT_NATURAL)
            ->values();

        $empresas = collect();
        $users = User::orderBy('name')->get(['id', 'name']);

        return Inertia::render('dashboard', [
            'vehiculos' => $vehiculos,
            'empresas' => $empresas,
            'inversiones' => $inversiones,
            'users' => $users,
            'filters' => $filters,
        ]);
    }
}
