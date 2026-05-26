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
        Gate::authorize('manage-users');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'dni' => ['required', 'string', 'max:20', 'unique:users,dni'],
            'role' => ['required', Rule::enum(UserRole::class)],
            'correo' => ['nullable', 'email', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'fecha_vencimiento_licencia' => ['nullable', 'date'],
            'profile_photo' => ['nullable', 'image', 'max:2048'],
            'empresa_id' => ['nullable', 'exists:empresas,id'],
            'empresa_acceso' => ['nullable', 'integer', Rule::in([0, 1, 2])],
            'deposito' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'deposito_moneda' => ['nullable', 'required_with:deposito', Rule::enum(DepositoMoneda::class)],
        ]);

        if ($validated['role'] !== UserRole::INVERSOR->value) {
            $validated['empresa_id'] = null;
        } else {
            $empresaRestringida = $request->user()->restrictedEmpresaId();
            if ($empresaRestringida) {
                $validated['empresa_id'] = $empresaRestringida;
            }
        }

        // empresa_acceso solo aplica para administradores
        if ($validated['role'] !== UserRole::ADMINISTRADOR->value) {
            $validated['empresa_acceso'] = null;
        }

        $photoPath = null;
        if ($request->hasFile('profile_photo')) {
            $photoPath = $request->file('profile_photo')->store('profile-photos', 'public');
        }

        // Automatización de contraseña: Primera letra del nombre (Mayúscula) + DNI
        $generatedPassword = strtoupper(mb_substr($validated['name'], 0, 1)).$validated['dni'];

        User::create([
            'name' => $validated['name'],
            'dni' => $validated['dni'],
            'role' => $validated['role'],
            'password' => Hash::make($generatedPassword),
            'must_change_password' => true,
            'correo' => $validated['correo'] ?? null,
            'telefono' => $validated['telefono'] ?? null,
            'fecha_vencimiento_licencia' => $validated['fecha_vencimiento_licencia'] ?? null,
            'profile_photo_path' => $photoPath,
            'empresa_id' => $validated['empresa_id'] ?? null,
            'empresa_acceso' => $validated['empresa_acceso'] ?? null,
            'deposito' => $validated['deposito'] ?? null,
            'deposito_moneda' => isset($validated['deposito']) ? ($validated['deposito_moneda'] ?? null) : null,
        ]);

        return redirect()->back()->with('success', 'Usuario creado correctamente.');
    }

    public function index(Request $request)
    {
        abort_unless($request->user()->isAdmin() || $request->user()->isInversor(), 403);

        $inversorEmpresaId = $request->user()->isInversor() ? $request->user()->empresa_id : null;
        $isChoferFilter = $request->query('role') === 'chofer';

        $choferCounts = null;
        if ($isChoferFilter) {
            $baseChofer = User::where('role', 'chofer')
                ->when($inversorEmpresaId, fn ($q) => $q->where('empresa_id', $inversorEmpresaId));
            $choferCounts = [
                'activos'   => (clone $baseChofer)->where('inactivo', false)->count(),
                'inactivos' => (clone $baseChofer)->where('inactivo', true)->count(),
            ];
        }

        $query = User::orderBy('name')
            ->when($inversorEmpresaId, fn ($q) => $q->where('empresa_id', $inversorEmpresaId))
            ->when($request->query('role'), function ($query, $role) {
                $query->where('role', $role);
            })
            ->when($request->query('status'), function ($query, $status) {
                if ($status === 'activos') {
                    $query->where('inactivo', false);
                } elseif ($status === 'inactivos') {
                    $query->where('inactivo', true);
                }
<<<<<<< HEAD
            });

        if ($isChoferFilter) {
            $query->with(['asignacionActiva.vehiculo']);
        }

        $users = $query
            ->get(['id', 'name', 'dni', 'role', 'absoluto', 'inactivo', 'correo', 'telefono', 'fecha_vencimiento_licencia', 'profile_photo_path', 'empresa_id', 'deposito', 'deposito_moneda'])
=======
            })
            ->get(['id', 'name', 'dni', 'role', 'absoluto', 'empresa_acceso', 'inactivo', 'correo', 'telefono', 'fecha_vencimiento_licencia', 'profile_photo_path', 'empresa_id', 'deposito', 'deposito_moneda'])
>>>>>>> a510d7cb9332b2ec01fd013791fba308b02471db
            ->append('profile_photo_url');

        if ($isChoferFilter) {
            $today = now()->startOfDay();
            $users = $users->map(function (User $user) use ($today) {
                $arr = collect($user->toArray())->except(['asignacion_activa'])->all();
                $vehiculo = $user->asignacionActiva?->vehiculo;
                $vencimientoLicencia = $user->fecha_vencimiento_licencia;

                $arr['vehiculo'] = $vehiculo ? [
                    'patente' => $vehiculo->patente,
                    'marca'   => $vehiculo->marca,
                    'modelo'  => $vehiculo->modelo,
                ] : null;
                $arr['licencia_por_vencer'] = $vencimientoLicencia !== null
                    && $vencimientoLicencia->gte($today)
                    && $vencimientoLicencia->lte($today->copy()->addDays(30));
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
        Gate::authorize('manage-users');

        $validated = $request->validate([
            'role' => ['required', Rule::enum(UserRole::class)],
        ]);

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'No puedes cambiar tu propio rol.');
        }

        $payload = ['role' => $validated['role']];
        if ($validated['role'] !== UserRole::INVERSOR->value) {
            $payload['empresa_id'] = null;
        }

        $user->update($payload);

        return redirect()->back()->with('success', 'Rol actualizado correctamente.');
    }

    public function toggleStatus(User $user)
    {
        Gate::authorize('manage-users');

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'No puedes cambiar tu propio estado.');
        }

        $newInactivoStatus = ! $user->inactivo;

        DB::transaction(function () use ($user, $newInactivoStatus) {
            $user->update(['inactivo' => $newInactivoStatus]);

            // Si el usuario es desactivado, quitar asignaciones de vehículos
            if ($newInactivoStatus) {
                // Cerrar las asignaciones activas en el historial
                Asignacion::where('conductor_id', $user->id)
                    ->whereNull('fecha_fin')
                    ->update(['fecha_fin' => now()]);

                // Desvincular vehículos que estuvieran a su nombre
                Vehiculo::where('user_id', $user->id)
                    ->update(['user_id' => null]);
            }
        });

        $message = $newInactivoStatus ? 'Usuario desactivado y sus vehículos fueron desasignados.' : 'Usuario activado correctamente.';

        return redirect()->back()->with('success', $message);
    }

    public function toggleAbsoluto(User $user)
    {
        Gate::authorize('manage-users');

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'No puedes cambiar tu propia bandera de acceso absoluto.');
        }

        if (! $user->isAdmin()) {
            return redirect()->back()->with('error', 'Solo los administradores pueden tener acceso absoluto.');
        }

        $user->update(['absoluto' => ! $user->absoluto]);

        $message = $user->absoluto ? 'Acceso absoluto activado.' : 'Acceso absoluto desactivado.';

        return redirect()->back()->with('success', $message);
    }

    public function updateEmpresaAcceso(Request $request, User $user)
    {
        Gate::authorize('manage-users');

        if (! $user->isAdmin()) {
            return redirect()->back()->with('error', 'Solo los administradores pueden tener acceso por empresa.');
        }

        $validated = $request->validate([
            'empresa_acceso' => ['nullable', 'integer', Rule::in([0, 1, 2])],
        ]);

        $user->update(['empresa_acceso' => $validated['empresa_acceso'] ?? null]);

        return redirect()->back()->with('success', 'Acceso por empresa actualizado.');
    }

    public function update(Request $request, User $user)
    {
        Gate::authorize('manage-users');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'dni' => ['required', 'string', 'max:20', Rule::unique('users')->ignore($user->id)],
            'correo' => ['nullable', 'email', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'fecha_vencimiento_licencia' => ['nullable', 'date'],
            'profile_photo' => ['nullable', 'image', 'max:2048'],
            'empresa_id' => ['nullable', 'exists:empresas,id'],
            'empresa_acceso' => ['nullable', 'integer', Rule::in([0, 1, 2])],
            'deposito' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'deposito_moneda' => ['nullable', 'required_with:deposito', Rule::enum(DepositoMoneda::class)],
        ]);

        if (! $user->isInversor()) {
            unset($validated['empresa_id']);
        } else {
            $empresaRestringida = $request->user()->restrictedEmpresaId();
            if ($empresaRestringida) {
                $validated['empresa_id'] = $empresaRestringida;
            }
        }

        if (! $user->isAdmin()) {
            unset($validated['empresa_acceso']);
        }

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

        $user->update($validated);

        return redirect()->back()->with('success', 'Usuario actualizado correctamente.');
    }

    public function asignaciones(User $user): Response
    {
        Gate::authorize('manage-users');

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
        Gate::authorize('manage-users');

        $asignaciones = Asignacion::where('conductor_id', $user->id)
            ->with(['vehiculo', 'asignadoPor:id,name'])
            ->orderBy('fecha_inicio', 'desc')
            ->get();

        $pdf = Pdf::loadView('pdf.user-asignaciones', compact('user', 'asignaciones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download("asignaciones-{$user->dni}-".now()->format('Y-m-d').'.pdf');
    }
}
