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
 * - Inversor: solo puede estar en una de las empresas a las que pertenece
 *   (pivot empresa_user). Si la sesión apunta a otra, se reemplaza por la
 *   empresa_default_id (si está en su pivot) o la primera del pivot.
 *   Si la sesión apunta a una válida, se respeta (permite el switch).
 * - Admin/Administrativo: arranca con empresa_default_id; si no tiene,
 *   primera empresa.
 * - Mecánico/Chofer (web no aplica): no requieren contexto.
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
            $this->resolveForInversor($request, $user);

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

    private function resolveForInversor(Request $request, $user): void
    {
        $empresaIds = $user->empresaIds();

        if (empty($empresaIds)) {
            // Inversor sin empresas asignadas: sin contexto.
            $request->session()->forget('active_company_id');

            return;
        }

        $current = $request->session()->get('active_company_id');

        if ($current !== null && in_array((int) $current, $empresaIds, true)) {
            return; // La sesión ya apunta a una de sus empresas — respetamos el switch.
        }

        // Caer al default si está dentro de su pivot, sino primera del pivot.
        $resolved = ($user->empresa_default_id !== null && in_array((int) $user->empresa_default_id, $empresaIds, true))
            ? (int) $user->empresa_default_id
            : (int) $empresaIds[0];

        $request->session()->put('active_company_id', $resolved);
    }
}
