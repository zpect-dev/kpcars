<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    /**
     * Return the authenticated driver's profile.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id'                => $user->id,
                'name'              => $user->name,
                'dni'               => $user->dni,
                'role'              => $user->role->value,
                'correo'            => $user->correo,
                'telefono'                   => $user->telefono,
                'fecha_vencimiento_licencia' => $user->fecha_vencimiento_licencia?->toDateString(),
                'profile_photo_url'          => $user->profile_photo_url,
            ],
        ]);
    }
}
