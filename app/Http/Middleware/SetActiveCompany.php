<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Empresa;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Garantiza que session('active_company_id') apunte a una empresa válida
 * para usuarios autenticados que operan sobre entidades multi-tenant.
 *
 * - Inversor: queda fijado a su empresa (empresa_id).
 * - Admin/Administrativo: arranca con empresa_default_id; si no tiene, primera empresa.
 * - Mecánico/Chofer (web no aplica): no requieren contexto (entidades globales).
 *
 * Si la empresa de la sesión deja de existir (fue borrada), se reinicializa.
 */
class SetActiveCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        if ($user->isInversor()) {
            // El inversor siempre opera sobre su empresa: forzamos la sesión por si cambia.
            $request->session()->put('active_company_id', $user->empresa_id);

            return $next($request);
        }

        if (! $user->isAdminOrAdministrativo()) {
            // Mecánicos no necesitan contexto de empresa (Inventario/Turnos/Revisiones son globales).
            return $next($request);
        }

        $current = $request->session()->get('active_company_id');

        if ($current !== null && Empresa::whereKey($current)->exists()) {
            return $next($request);
        }

        $resolved = $user->empresa_default_id
            ?? Empresa::orderBy('nombre')->value('id');

        if ($resolved !== null) {
            $request->session()->put('active_company_id', (int) $resolved);
        }

        return $next($request);
    }
}
