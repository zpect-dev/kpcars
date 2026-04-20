<?php

use App\Http\Controllers\Api\AppointmentController;
use App\Http\Controllers\Api\AppointmentSyncController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\VehiculoController;
use App\Http\Middleware\EnsurePasswordChanged;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Conductor (Driver) Endpoints
|--------------------------------------------------------------------------
|
| These routes are loaded by bootstrap/app.php and are prefixed with /api.
| Authentication is handled via Laravel Sanctum (Bearer token).
|
*/

// Public: Authentication
Route::post('login', [AuthController::class, 'login']);

// Protected: Requires valid Sanctum token
Route::middleware('auth:sanctum')->group(function () {
    // These two are always accessible (even if must_change_password is true)
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('change-password', [AuthController::class, 'changePassword']);

    // These require the password to have been changed first
    Route::middleware(EnsurePasswordChanged::class)->group(function () {
        Route::get('me', [ProfileController::class, 'show']);
        Route::get('mi-vehiculo', [VehiculoController::class, 'show']);
        Route::get('mis-turnos', [AppointmentController::class, 'index']);
        Route::post('mis-turnos', [AppointmentController::class, 'store']);

        // External integration endpoints
        Route::get('sync-turnos', AppointmentSyncController::class);
        Route::post('turnos-externos', [AppointmentController::class, 'storeExternal']);
        Route::patch('turnos-externos/{appointment}/cancelar', [AppointmentController::class, 'cancelExternal']);
    });
});
