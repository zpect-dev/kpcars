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
     * Solo administradores y administrativos pueden ejecutar este switch
     * (controlado por el Gate 'switch-empresa'). También persiste la empresa
     * elegida como `empresa_default_id` para que el siguiente login arranque
     * en el mismo contexto.
     */
    public function switch(Request $request): RedirectResponse
    {
        Gate::authorize('switch-empresa');

        $validated = $request->validate([
            'empresa_id' => ['required', 'integer', 'exists:empresas,id'],
        ]);

        $empresaId = (int) $validated['empresa_id'];

        $request->session()->put('active_company_id', $empresaId);

        $request->user()->forceFill(['empresa_default_id' => $empresaId])->save();

        $nombre = Empresa::whereKey($empresaId)->value('nombre');

        return redirect()
            ->back()
            ->with('success', "Empresa activa cambiada a {$nombre}.");
    }
}
