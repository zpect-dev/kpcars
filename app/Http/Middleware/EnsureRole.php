<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware de control de acceso por rol.
 *
 * Uso en rutas:
 *   Route::middleware('role:administrador,administrativo')->group(fn () => ...);
 *
 * Rechaza con 403 si el usuario autenticado no tiene uno de los roles permitidos.
 * Si no hay usuario autenticado, deja que el middleware 'auth' siguiente decida
 * (este middleware no asume login, solo discrimina por rol).
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user === null) {
            return $next($request);
        }

        $allowed = array_map(fn (string $role) => UserRole::from($role), $roles);

        if (! in_array($user->role, $allowed, true)) {
            abort(403, 'No tienes permiso para acceder a esta sección.');
        }

        return $next($request);
    }
}
