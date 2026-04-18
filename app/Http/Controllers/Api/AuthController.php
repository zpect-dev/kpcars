<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Authenticate a driver and return a Sanctum token.
     *
     * Only users with role "chofer" who are not inactive can log in.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dni' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        /** @var User|null $user */
        $user = User::where('dni', $validated['dni'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'dni' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        if ($user->inactivo) {
            throw ValidationException::withMessages([
                'dni' => ['Su cuenta se encuentra deshabilitada. Contacte al administrador.'],
            ]);
        }

        if ($user->role !== UserRole::CHOFER) {
            throw ValidationException::withMessages([
                'dni' => ['Acceso no autorizado. Solo conductores pueden iniciar sesión.'],
            ]);
        }

        // Revoke previous tokens to enforce single-session
        $user->tokens()->delete();

        $token = $user->createToken('conductor-app')->plainTextToken;

        return response()->json([
            'token' => $token,
            'must_change_password' => $user->must_change_password,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'dni' => $user->dni,
                'role' => $user->role->value,
            ],
        ]);
    }

    /**
     * Revoke the current token (logout).
     */
    public function logout(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada correctamente.']);
    }

    /**
     * Change the password on first login.
     *
     * Validates current password, sets the new one, clears the
     * must_change_password flag, and re-issues a fresh token.
     */
    public function changePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $isFirstLogin = $user->must_change_password;

        $rules = [
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];

        // Only require current password on voluntary changes, not on first login
        if (! $isFirstLogin) {
            $rules['current_password'] = ['required', 'string'];
        }

        $validated = $request->validate($rules);

        if (! $isFirstLogin) {
            if (! Hash::check($validated['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['La contraseña actual es incorrecta.'],
                ]);
            }
        }

        $user->update([
            'password' => $validated['password'],
            'must_change_password' => false,
        ]);

        // Revoke all tokens and issue a fresh one
        $user->tokens()->delete();
        $token = $user->createToken('conductor-app')->plainTextToken;

        return response()->json([
            'message' => 'Contraseña actualizada correctamente.',
            'token' => $token,
        ]);
    }
}
