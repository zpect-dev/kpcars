<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\DepositoMoneda;
use App\Enums\UserRole;
use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Barryvdh\DomPDF\Facade\Pdf;
use Inertia\Response;
class UserController extends Controller
{
    public function store(Request $request)
    {
        $this->authorize('create', User::class);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'dni' => ['required', 'string', 'max:20', 'unique:users,dni'],
            'role' => ['required', Rule::enum(UserRole::class)],
            'correo' => ['nullable', 'email', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'fecha_vencimiento_licencia' => ['nullable', 'date'],
            'profile_photo' => ['nullable', 'image', 'max:2048'],
            'empresas' => ['nullable', 'array'],
            'empresas.*' => ['integer', 'exists:empresas,id'],
            'empresa_restringida_id' => ['nullable', 'integer', 'exists:empresas,id'],
            'deposito' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'deposito_moneda' => ['nullable', 'required_with:deposito', Rule::enum(DepositoMoneda::class)],
        ]);

        $photoPath = null;
        if ($request->hasFile('profile_photo')) {
            $photoPath = $request->file('profile_photo')->store('profile-photos', 'public');
        }

        // La restricción de empresa sólo aplica a admin/administrativo.
        $esGestor = in_array($validated['role'], [UserRole::ADMINISTRADOR->value, UserRole::ADMINISTRATIVO->value], true);

        // Automatización de contraseña: Primera letra del nombre (Mayúscula) + DNI
        $generatedPassword = strtoupper(mb_substr($validated['name'], 0, 1)).$validated['dni'];

        $user = User::create([
            'name' => $validated['name'],
            'dni' => $validated['dni'],
            'role' => $validated['role'],
            'password' => Hash::make($generatedPassword),
            'must_change_password' => true,
            'correo' => $validated['correo'] ?? null,
            'telefono' => $validated['telefono'] ?? null,
            'fecha_vencimiento_licencia' => $validated['fecha_vencimiento_licencia'] ?? null,
            'profile_photo_path' => $photoPath,
            'empresa_restringida_id' => $esGestor ? ($validated['empresa_restringida_id'] ?? null) : null,
            'deposito' => $validated['deposito'] ?? null,
            'deposito_moneda' => isset($validated['deposito']) ? ($validated['deposito_moneda'] ?? null) : null,
        ]);

        // Pivot empresa_user: sólo aplica al rol inversor.
        if ($validated['role'] === UserRole::INVERSOR->value) {
            $empresaIds = $validated['empresas'] ?? [];
            // Default si el form no envió nada: la empresa activa de la sesión.
            if (empty($empresaIds) && session('active_company_id')) {
                $empresaIds = [(int) session('active_company_id')];
            }
            if (! empty($empresaIds)) {
                $user->empresas()->sync($empresaIds);
                // Setea empresa_default_id para que el próximo login arranque ahí.
                $user->forceFill(['empresa_default_id' => (int) $empresaIds[0]])->save();
            }
        }

        return redirect()->back()->with('success', 'Usuario creado correctamente.');
    }

    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $isChoferFilter = $request->query('role') === 'chofer';
        $isInversorFilter = $request->query('role') === 'inversor';
        $empresaActiva = session('active_company_id');

        $choferCounts = null;
        if ($isChoferFilter) {
            $baseChofer = User::where('role', 'chofer');
            $choferCounts = [
                'activos'   => (clone $baseChofer)->where('inactivo', false)->count(),
                'inactivos' => (clone $baseChofer)->where('inactivo', true)->count(),
            ];
        }

        $query = User::orderBy('name')
            ->when($request->query('role'), function ($query, $role) {
                $query->where('role', $role);
            })
            // Cuando se listan inversores, sólo aparecen los que pertenecen a la
            // empresa activa (via pivot empresa_user).
            ->when($isInversorFilter && $empresaActiva, function ($query) use ($empresaActiva) {
                $query->whereHas('empresas', fn ($q) => $q->where('empresas.id', $empresaActiva));
            })
            ->when($request->query('status'), function ($query, $status) {
                if ($status === 'activos') {
                    $query->where('inactivo', false);
                } elseif ($status === 'inactivos') {
                    $query->where('inactivo', true);
                }
            });

        if ($isChoferFilter) {
            // Personal es global: el carro asignado al chofer puede ser de
            // cualquier empresa (bypass TenantScope en la relación). Usamos
            // vehiculoAsignado (vehiculos.user_id) — misma fuente que el dashboard.
            $query->with([
                'vehiculoAsignado' => fn ($q) => $q->withoutGlobalScope(\App\Models\Scopes\TenantScope::class),
            ]);
        }

        if ($isInversorFilter) {
            $query->with(['empresas:id,nombre']);
        }

        $users = $query
            ->get(['id', 'name', 'dni', 'role', 'inactivo', 'correo', 'telefono', 'fecha_vencimiento_licencia', 'profile_photo_path', 'empresa_default_id', 'empresa_restringida_id', 'deposito', 'deposito_moneda'])
            ->append('profile_photo_url');

        if ($isChoferFilter) {
            $today = now()->startOfDay();
            $users = $users->map(function (User $user) use ($today) {
                $arr = collect($user->toArray())->except(['vehiculo_asignado'])->all();
                $vehiculo = $user->vehiculoAsignado;
                $vencimientoLicencia = $user->fecha_vencimiento_licencia;

                $arr['vehiculo'] = $vehiculo ? [
                    'patente' => $vehiculo->patente,
                    'marca'   => $vehiculo->marca,
                    'modelo'  => $vehiculo->modelo,
                ] : null;
                $arr['licencia_por_vencer'] = $vencimientoLicencia !== null
                    && $vencimientoLicencia->gte($today)
                    && $vencimientoLicencia->lte($today->copy()->addDays(30));
                $arr['sin_licencia'] = $vencimientoLicencia === null;
                $arr['falta_foto'] = $user->profile_photo_path === null;

                return $arr;
            });
        }

        $empresas = Empresa::orderBy('nombre')->get(['id', 'nombre']);

        $roles = collect(UserRole::cases())->map(fn ($role) => [
            'value' => $role->value,
            'label' => $role->label(),
        ]);

        $filterRoles = collect(UserRole::cases())->map(fn ($role) => [
            'value' => $role->value,
            'label' => $role->pluralLabel(),
        ]);

        $monedas = collect(DepositoMoneda::cases())->map(fn ($m) => [
            'value' => $m->value,
            'label' => $m->label(),
            'symbol' => $m->symbol(),
        ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'roles' => $roles,
            'filterRoles' => $filterRoles,
            'empresas' => $empresas,
            'monedas' => $monedas,
            'choferCounts' => $choferCounts,
        ]);
    }

    public function updateRole(Request $request, User $user)
    {
        // UserPolicy::updateRole bloquea self-edit (mismo id).
        $this->authorize('updateRole', $user);

        $validated = $request->validate([
            'role' => ['required', Rule::enum(UserRole::class)],
        ]);

        $payload = ['role' => $validated['role']];
        if ($validated['role'] !== UserRole::INVERSOR->value) {
            $payload['empresa_id'] = null;
        }

        $user->update($payload);

        return redirect()->back()->with('success', 'Rol actualizado correctamente.');
    }

    public function toggleStatus(User $user)
    {
        // UserPolicy::toggleStatus bloquea self-edit.
        $this->authorize('toggleStatus', $user);

        $newInactivoStatus = ! $user->inactivo;

        DB::transaction(function () use ($user, $newInactivoStatus) {
            $user->update(['inactivo' => $newInactivoStatus]);

            // Si el usuario es desactivado, quitar asignaciones de vehículos
            if ($newInactivoStatus) {
                // Cerrar las asignaciones activas en el historial
                Asignacion::where('conductor_id', $user->id)
                    ->whereNull('fecha_fin')
                    ->update(['fecha_fin' => now()]);

                // Desvincular vehículos que estuvieran a su nombre.
                // Sin el TenantScope: el usuario puede tener vehículos en
                // otras empresas y todos deben quedar desasignados.
                Vehiculo::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                    ->where('user_id', $user->id)
                    ->update(['user_id' => null]);
            }
        });

        $message = $newInactivoStatus ? 'Usuario desactivado y sus vehículos fueron desasignados.' : 'Usuario activado correctamente.';

        return redirect()->back()->with('success', $message);
    }

    public function update(Request $request, User $user)
    {
        $this->authorize('update', $user);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'dni' => ['required', 'string', 'max:20', Rule::unique('users')->ignore($user->id)],
            'correo' => ['nullable', 'email', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'fecha_vencimiento_licencia' => ['nullable', 'date'],
            'profile_photo' => ['nullable', 'image', 'max:2048'],
            'empresas' => ['nullable', 'array'],
            'empresas.*' => ['integer', 'exists:empresas,id'],
            'empresa_restringida_id' => ['nullable', 'integer', 'exists:empresas,id'],
            'deposito' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'deposito_moneda' => ['nullable', 'required_with:deposito', Rule::enum(DepositoMoneda::class)],
        ]);

        // Limpiar moneda si no hay depósito
        if (empty($validated['deposito'])) {
            $validated['deposito'] = null;
            $validated['deposito_moneda'] = null;
        }

        if ($request->hasFile('profile_photo')) {
            if ($user->profile_photo_path) {
                Storage::disk('public')->delete($user->profile_photo_path);
            }
            $validated['profile_photo_path'] = $request->file('profile_photo')->store('profile-photos', 'public');
        }

        // El campo empresas no se persiste directamente en el modelo.
        $empresaIds = $validated['empresas'] ?? null;
        unset($validated['empresas']);

        // La restricción de empresa sólo aplica a admin/administrativo.
        if (! $user->isAdminOrAdministrativo()) {
            $validated['empresa_restringida_id'] = null;
        }

        $user->update($validated);

        // Sincroniza pivot empresa_user para inversor (no aplica a otros roles).
        if ($user->isInversor() && $empresaIds !== null) {
            $user->empresas()->sync($empresaIds);

            // Si empresa_default_id ya no está dentro del nuevo set, lo realineamos.
            if (! in_array((int) $user->empresa_default_id, array_map('intval', $empresaIds), true)) {
                $user->forceFill([
                    'empresa_default_id' => ! empty($empresaIds) ? (int) $empresaIds[0] : null,
                ])->save();
            }
        }

        return redirect()->back()->with('success', 'Usuario actualizado correctamente.');
    }

    public function asignaciones(User $user): Response
    {
        $this->authorize('viewAsignaciones', $user);

        $asignaciones = Asignacion::where('conductor_id', $user->id)
            ->with(['vehiculo', 'asignadoPor:id,name'])
            ->orderBy('fecha_inicio', 'desc')
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'vehiculo' => $a->vehiculo ? [
                    'id' => $a->vehiculo->id,
                    'patente' => $a->vehiculo->patente,
                    'marca' => $a->vehiculo->marca,
                    'modelo' => $a->vehiculo->modelo,
                    'anio' => $a->vehiculo->anio,
                ] : null,
                'asignado_por' => $a->asignadoPor?->name,
                'fecha_inicio' => $a->fecha_inicio?->toISOString(),
                'fecha_fin' => $a->fecha_fin?->toISOString(),
            ]);

        return Inertia::render('Users/Asignaciones', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'dni' => $user->dni,
                'role' => $user->role,
            ],
            'asignaciones' => $asignaciones,
        ]);
    }

    public function asignacionesPdf(User $user): \Illuminate\Http\Response
    {
        $this->authorize('viewAsignaciones', $user);

        $asignaciones = Asignacion::where('conductor_id', $user->id)
            ->with(['vehiculo', 'asignadoPor:id,name'])
            ->orderBy('fecha_inicio', 'desc')
            ->get();

        $pdf = Pdf::loadView('pdf.user-asignaciones', compact('user', 'asignaciones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download("asignaciones-{$user->dni}-".now()->format('Y-m-d').'.pdf');
    }
}
