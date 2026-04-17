<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Illuminate\Support\Facades\Gate;

class UserController extends Controller
{
    public function index()
    {
        Gate::authorize('manage-users');

        $users = User::orderBy('name')->get(['id', 'name', 'dni', 'role', 'inactivo']);
        
        $roles = collect(UserRole::cases())->map(fn($role) => [
            'value' => $role->value,
            'label' => $role->label()
        ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'roles' => $roles,
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
}
