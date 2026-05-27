<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Empresa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class EmpresaController extends Controller
{
    /**
     * Cambiar la empresa activa en la sesión del usuario.
     *
     * Controlado por el Gate 'switch-empresa':
     *  - Admin/Administrativo: pueden saltar a cualquier empresa.
     *  - Inversor: sólo a las empresas a las que pertenece (pivot empresa_user).
     *
     * Persiste la empresa elegida como `empresa_default_id` para que el
     * siguiente login arranque en el mismo contexto.
     */
    public function switch(Request $request): RedirectResponse
    {
        Gate::authorize('switch-empresa');

        $validated = $request->validate([
            'empresa_id' => ['required', 'integer', 'exists:empresas,id'],
        ]);

        $empresaId = (int) $validated['empresa_id'];
        $user = $request->user();

        // Inversor sólo puede saltar a sus empresas.
        if ($user->isInversor() && ! in_array($empresaId, $user->empresaIds(), true)) {
            abort(403, 'No pertenecés a esa empresa.');
        }

        $request->session()->put('active_company_id', $empresaId);

        $user->forceFill(['empresa_default_id' => $empresaId])->save();

        $nombre = Empresa::whereKey($empresaId)->value('nombre');

        return redirect()
            ->back()
            ->with('success', "Empresa activa cambiada a {$nombre}.");
    }
}
