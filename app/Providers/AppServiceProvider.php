<?php

namespace App\Providers;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->defineGates();
    }

    /**
     * Gates semánticos consumidos por:
     *  - Controllers vía Gate::authorize() / abort_unless(Gate::allows()).
     *  - Inertia share auth.permissions para renderizado condicional de UI.
     *  - Middleware ad-hoc cuando un grupo de rutas comparte permisos.
     *
     * Convención: cada Gate corresponde 1:1 con una "capacidad" del usuario.
     * Los chequeos de tenant (empresa activa) los aplica TenantScope al modelo,
     * no estos Gates.
     */
    private function defineGates(): void
    {
        // Cambio de empresa:
        //  - admin/administrativo: sí, salvo que estén fijados a una empresa
        //    (empresa_restringida_id).
        //  - inversor: sólo si pertenece a >= 2 empresas.
        Gate::define('switch-empresa', function (User $user) {
            if ($user->isAdminOrAdministrativo()) {
                return $user->empresa_restringida_id === null;
            }

            if ($user->isInversor()) {
                return count($user->empresaIds()) >= 2;
            }

            return false;
        });

        // Vehículos: dashboard operativo de flota.
        Gate::define('view-vehiculos', fn (User $user) => $user->isAdminOrAdministrativo());
        Gate::define('manage-vehiculos', fn (User $user) => $user->isAdminOrAdministrativo());

        // Inventario: global (no scoped).
        Gate::define('view-inventario', fn (User $user) => $user->isAdminOrAdministrativo() || $user->isMechanic());
        Gate::define('manage-inventario', fn (User $user) => $user->isAdminOrAdministrativo() || $user->isMechanic());
        Gate::define('manage-precios', fn (User $user) => $user->isAdmin());

        // Turnos: global; chofer accede sólo vía API (no aplicable a este Gate web).
        Gate::define('view-turnos', fn (User $user) => $user->isAdminOrAdministrativo() || $user->isMechanic());
        Gate::define('manage-turnos', fn (User $user) => $user->isAdminOrAdministrativo() || $user->isMechanic());

        // Revisiones: global.
        Gate::define('view-revisiones', fn (User $user) => $user->isAdminOrAdministrativo());
        Gate::define('manage-revisiones', fn (User $user) => $user->isAdminOrAdministrativo());

        // Service: global. Incluye al mecánico (es quien realiza el service).
        Gate::define('view-service', fn (User $user) => $user->isAdminOrAdministrativo() || $user->isMechanic());
        Gate::define('manage-service', fn (User $user) => $user->isAdminOrAdministrativo() || $user->isMechanic());

        // Personal (gestión de usuarios): global.
        Gate::define('view-personal', fn (User $user) => $user->isAdminOrAdministrativo());
        Gate::define('manage-users', fn (User $user) => $user->isAdminOrAdministrativo());

        // Áreas exclusivas del Administrador puro.
        Gate::define('view-cobros', fn (User $user) => $user->isAdmin());
        Gate::define('manage-cobros', fn (User $user) => $user->isAdmin());
        Gate::define('view-gastos', fn (User $user) => $user->isAdmin());
        Gate::define('manage-gastos', fn (User $user) => $user->isAdmin());
        Gate::define('view-inversiones', fn (User $user) => $user->isAdmin());
        Gate::define('manage-inversiones', fn (User $user) => $user->isAdmin());
        Gate::define('view-cierres-inversion', fn (User $user) => $user->isAdmin());
        Gate::define('manage-cierres-inversion', fn (User $user) => $user->isAdmin());
        Gate::define('annul-transactions', fn (User $user) => $user->isAdmin());
        Gate::define('import-asignaciones', fn (User $user) => $user->isAdmin());

        // Vista del inversor. Es cross-empresa: chequeamos sus inversiones sin
        // aplicar TenantScope (puede tener inversiones sólo en una empresa
        // distinta a la activa de la sesión y aun así corresponde mostrarle Mi Cuenta).
        Gate::define('view-mi-cuenta', fn (User $user) => $user->isInversor()
            && $user->inversiones()
                ->withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                ->exists());
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
