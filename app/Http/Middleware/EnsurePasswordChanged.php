<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks API access when the authenticated user must change their password.
 *
 * Only the change-password and logout endpoints are allowed through.
 */
class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password) {
            return new JsonResponse([
                'message' => 'Debe cambiar su contraseña antes de continuar.',
                'must_change_password' => true,
            ], 403);
        }

        return $next($request);
    }
}
