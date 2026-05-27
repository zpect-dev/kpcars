<?php

namespace App\Http\Middleware;

use App\Models\Empresa;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * Gates expuestos al frontend como `auth.permissions.can_*`.
     * El nombre del gate (kebab-case) se traduce a `can_<snake_case>`.
     */
    private const EXPOSED_GATES = [
        'switch-empresa',
        'view-vehiculos', 'manage-vehiculos',
        'view-inventario', 'manage-inventario', 'manage-precios',
        'view-turnos', 'manage-turnos',
        'view-revisiones', 'manage-revisiones',
        'view-personal', 'manage-users',
        'view-cobros', 'manage-cobros',
        'view-gastos', 'manage-gastos',
        'view-inversiones', 'manage-inversiones',
        'view-cierres-inversion', 'manage-cierres-inversion',
        'annul-transactions', 'import-asignaciones',
        'view-mi-cuenta',
    ];

    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * Importante: los valores dependientes de auth/session se entregan como
     * closures. Inertia evalúa estos closures en tiempo de render — DESPUÉS
     * de que el middleware `auth` haya populado $request->user() y
     * SetActiveCompany haya inicializado la sesión. Pasar el valor directo
     * provoca que se capture el estado pre-auth (user=null, session vacía).
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => fn () => ($u = $request->user()) ? $this->userPayload($u) : null,
                'active_company' => fn () => $this->activeCompany($request),
                'empresas_disponibles' => fn () => $this->empresasDisponibles($request->user()),
                'permissions' => fn () => $this->permissionsFor($request->user()),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'warning' => fn () => $request->session()->get('warning'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }

    /**
     * Payload del usuario autenticado para el frontend. El frontend ya no
     * lee campos derivados de role (`isInversor`, `tiene_inversiones`, etc.)
     * — esa información vive en `auth.permissions`.
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'dni' => $user->dni,
            'correo' => $user->correo,
            'role' => $user->role,
            'empresa_id' => $user->empresa_id,
            'empresa_default_id' => $user->empresa_default_id,
            'profile_photo_url' => $user->profile_photo_url,
        ];
    }

    /**
     * Empresa activa de la sesión (objeto completo), o null si no aplica
     * o si la empresa ya no existe.
     */
    private function activeCompany(Request $request): ?array
    {
        $id = $request->session()->get('active_company_id');

        if ($id === null) {
            return null;
        }

        $empresa = Empresa::find($id);

        return $empresa ? ['id' => $empresa->id, 'nombre' => $empresa->nombre] : null;
    }

    /**
     * Lista de empresas entre las que el usuario puede cambiar (vacía si no
     * tiene el Gate switch-empresa).
     *
     * @return array<int, array{id:int, nombre:string}>
     */
    private function empresasDisponibles(?User $user): array
    {
        if ($user === null || ! Gate::forUser($user)->allows('switch-empresa')) {
            return [];
        }

        return Empresa::orderBy('nombre')
            ->get(['id', 'nombre'])
            ->map(fn (Empresa $e) => ['id' => $e->id, 'nombre' => $e->nombre])
            ->all();
    }

    /**
     * Diccionario de permisos del usuario para uso en el frontend
     * (renderizado condicional de sidebar/menúes/botones).
     *
     * @return array<string, bool>
     */
    private function permissionsFor(?User $user): array
    {
        if ($user === null) {
            return [];
        }

        $permissions = [];
        foreach (self::EXPOSED_GATES as $gate) {
            $key = 'can_'.str_replace('-', '_', $gate);
            $permissions[$key] = Gate::forUser($user)->allows($gate);
        }

        return $permissions;
    }
}
