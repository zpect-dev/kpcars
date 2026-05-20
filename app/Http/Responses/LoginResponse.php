<?php

declare(strict_types=1);

namespace App\Http\Responses;

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

        if ($user && $user->isMechanic()) {
            return redirect()->route('appointments.index');
        }

        if ($user && $user->isInversor()) {
            return redirect()->route('mi-cuenta.index');
        }

        return redirect()->intended(config('fortify.home'));
    }
}
