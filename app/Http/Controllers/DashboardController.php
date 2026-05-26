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

        $filters = $request->only(['empresa_id', 'inversion_id']);
        $empresaRestringida = $request->user()->restrictedEmpresaId();

        $vehiculos = Vehiculo::with(['user', 'inversion', 'empresa'])
            ->visibleTo($request->user())
            ->where('patente', '!=', 'EXTERNO')
            ->when(! empty($filters['empresa_id']), fn ($q) => $q->where('empresa_id', $filters['empresa_id']))
            ->when(! empty($filters['inversion_id']), fn ($q) => $q->where('inversion_id', $filters['inversion_id']))
            ->orderBy('patente')
            ->get();

        // Si el admin está restringido o es inversor, no exponemos la lista de empresas
        // para que la UI no muestre el filtro ni el selector.
        $empresas = ($request->user()->isInversor() || $empresaRestringida)
            ? collect()
            : Empresa::orderBy('nombre')->get(['id', 'nombre']);
        $inversiones = Inversion::when($empresaRestringida, fn ($q) => $q->where('empresa_id', $empresaRestringida))
            ->orderBy('nombre')->get(['id', 'nombre'])->sortBy('nombre', SORT_NATURAL)->values();
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
