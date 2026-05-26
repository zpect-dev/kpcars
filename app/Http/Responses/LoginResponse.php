<?php

declare(strict_types=1);

namespace App\Http\Responses;

use App\Models\Empresa;
use Illuminate\Http\Request;
use Laravel\Fortify\Contracts\LoginResponse as LoginResponseContract;
use Symfony\Component\HttpFoundation\Response;

class LoginResponse implements LoginResponseContract
{
    /**
     * @param  Request  $request
     */
    public function toResponse($request): Response
    {
        $user = $request->user();

        if ($user) {
            $this->primeActiveCompany($request, $user);
        }

        if ($user && $user->isMechanic()) {
            return redirect()->route('appointments.index');
        }

        if ($user && $user->isInversor()) {
            return redirect()->route('mi-cuenta.index');
        }

        return redirect()->intended(config('fortify.home'));
    }

    /**
     * Inicializa session('active_company_id') al login para que la primera
     * pantalla cargue con contexto multi-tenant correcto, sin depender de
     * un redirect adicional que invoque SetActiveCompany.
     */
    private function primeActiveCompany(Request $request, $user): void
    {
        if ($user->isInversor()) {
            $request->session()->put('active_company_id', $user->empresa_id);

            return;
        }

        if (! $user->isAdminOrAdministrativo()) {
            return;
        }

        $resolved = $user->empresa_default_id
            ?? Empresa::orderBy('nombre')->value('id');

        if ($resolved !== null) {
            $request->session()->put('active_company_id', (int) $resolved);
        }
    }
}
