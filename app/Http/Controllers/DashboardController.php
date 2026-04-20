<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Empresa;
use App\Models\Inversion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request)
    {
        abort_if($request->user()->isMechanic(), 403);

        $filters = $request->only(['empresa_id', 'inversion_id']);

        $vehiculos = Vehiculo::with(['user', 'inversion', 'empresa'])
            ->where('patente', '!=', 'EXTERNO')
            ->when(! empty($filters['empresa_id']), fn ($q) => $q->where('empresa_id', $filters['empresa_id']))
            ->when(! empty($filters['inversion_id']), fn ($q) => $q->where('inversion_id', $filters['inversion_id']))
            ->orderBy('patente')
            ->get();

        $empresas    = Empresa::orderBy('nombre')->get(['id', 'nombre']);
        $inversiones = Inversion::orderBy('nombre')->get(['id', 'nombre']);
        $users       = User::orderBy('name')->get(['id', 'name']);

        return Inertia::render('dashboard', [
            'vehiculos'   => $vehiculos,
            'empresas'    => $empresas,
            'inversiones' => $inversiones,
            'users'       => $users,
            'filters'     => $filters,
        ]);
    }
}
