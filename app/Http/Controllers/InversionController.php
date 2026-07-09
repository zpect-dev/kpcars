<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Inversion;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InversionController extends Controller
{
    /**
     * Crea una inversión en la empresa activa, con la opción de elegir
     * en el mismo paso los inversores que la financian.
     *
     * Se conserva porque el dashboard de vehículos crea inversiones desde acá.
     * La asignación inversor↔inversión (financiador/deuda) se gestiona ahora
     * desde Personal (UserController::syncInversiones).
     */
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', Inversion::class);

        $empresaActiva = session('active_company_id');

        $validated = $request->validate([
            'nombre' => [
                'required',
                'string',
                'max:255',
                Rule::unique('inversiones', 'nombre')->where(fn ($q) => $q->where('empresa_id', $empresaActiva)),
            ],
            'financiadores' => ['sometimes', 'array', 'max:'.Inversion::MAX_INVERSORES],
            'financiadores.*' => ['required', 'integer', 'distinct', 'exists:users,id'],
        ], [
            'nombre.unique' => 'Ya existe una inversión con ese nombre en esta empresa.',
        ]);

        $financiadorIds = $validated['financiadores'] ?? [];

        if (! empty($financiadorIds)) {
            $noInversores = User::whereIn('id', $financiadorIds)
                ->where('role', '!=', UserRole::INVERSOR)
                ->exists();
            if ($noInversores) {
                return back()->with('error', 'Uno o más financiadores seleccionados no tienen rol de inversor.');
            }
        }

        DB::transaction(function () use ($validated, $empresaActiva, $financiadorIds) {
            $inversion = Inversion::create([
                'nombre' => trim($validated['nombre']),
                'empresa_id' => $empresaActiva,
            ]);

            foreach ($financiadorIds as $userId) {
                $inversion->inversores()->attach($userId, [
                    'es_financiador' => true,
                    'deuda' => 0,
                ]);
            }
        });

        return back()->with('success', 'Inversión creada correctamente.');
    }
}
