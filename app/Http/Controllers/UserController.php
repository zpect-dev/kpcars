<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Illuminate\Support\Facades\Gate;

use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function store(Request $request)
    {
        Gate::authorize('manage-users');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'dni' => ['required', 'string', 'max:20', 'unique:users,dni'],
            'role' => ['required', Rule::enum(UserRole::class)],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'correo' => ['nullable', 'email', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'fecha_vencimiento_licencia' => ['nullable', 'date'],
            'profile_photo' => ['nullable', 'image', 'max:2048'],
        ]);

        $photoPath = null;
        if ($request->hasFile('profile_photo')) {
            $photoPath = $request->file('profile_photo')->store('profile-photos', 'public');
        }

        User::create([
            'name' => $validated['name'],
            'dni' => $validated['dni'],
            'role' => $validated['role'],
            'password' => Hash::make($validated['password']),
            'must_change_password' => true, // Opcional, pero util para cuentas nuevas
            'correo' => $validated['correo'] ?? null,
            'telefono' => $validated['telefono'] ?? null,
            'fecha_vencimiento_licencia' => $validated['fecha_vencimiento_licencia'] ?? null,
            'profile_photo_path' => $photoPath,
        ]);

        return redirect()->back()->with('success', 'Usuario creado correctamente.');
    }

    public function index(Request $request)
    {
        Gate::authorize('manage-users');

        $users = User::orderBy('name')
            ->when($request->query('role'), function ($query, $role) {
                $query->where('role', $role);
            })
            ->get(['id', 'name', 'dni', 'role', 'inactivo', 'correo', 'telefono', 'fecha_vencimiento_licencia', 'profile_photo_path'])
            ->append('profile_photo_url');
        
        $roles = collect(UserRole::cases())->map(fn($role) => [
            'value' => $role->value,
            'label' => $role->label()
        ]);

        $filterRoles = collect(UserRole::cases())->map(fn($role) => [
            'value' => $role->value,
            'label' => $role->pluralLabel()
        ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'roles' => $roles,
            'filterRoles' => $filterRoles,
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

        $user->update(['role' => $validated['role']]);

        return redirect()->back()->with('success', 'Rol actualizado correctamente.');
    }

    public function toggleStatus(User $user)
    {
        \Illuminate\Support\Facades\Gate::authorize('manage-users');

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'No puedes cambiar tu propio estado.');
        }

        $newInactivoStatus = !$user->inactivo;

        \Illuminate\Support\Facades\DB::transaction(function () use ($user, $newInactivoStatus) {
            $user->update(['inactivo' => $newInactivoStatus]);

            // Si el usuario es desactivado, quitar asignaciones de vehículos
            if ($newInactivoStatus) {
                // Cerrar las asignaciones activas en el historial
                \App\Models\Asignacion::where('conductor_id', $user->id)
                    ->whereNull('fecha_fin')
                    ->update(['fecha_fin' => now()]);

                // Desvincular vehículos que estuvieran a su nombre
                \App\Models\Vehiculo::where('user_id', $user->id)
                    ->update(['user_id' => null]);
            }
        });

        $message = $newInactivoStatus ? 'Usuario desactivado y sus vehículos fueron desasignados.' : 'Usuario activado correctamente.';
        return redirect()->back()->with('success', $message);
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
        ]);

        if ($request->hasFile('profile_photo')) {
            if ($user->profile_photo_path) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($user->profile_photo_path);
            }
            $validated['profile_photo_path'] = $request->file('profile_photo')->store('profile-photos', 'public');
        }

        $user->update($validated);

        return redirect()->back()->with('success', 'Usuario actualizado correctamente.');
    }
}
