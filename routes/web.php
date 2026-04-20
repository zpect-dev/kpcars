<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ArticuloController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\AsignacionController;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VehiculoController;

Route::get('/', function () {
    if (auth()->check()) {
        if (auth()->user()->isMechanic()) {
            return redirect()->route('articulos.index');
        }
        return redirect()->route('dashboard');
    }
    return redirect()->route('login');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::post('vehiculos', [VehiculoController::class, 'store'])->name('vehiculos.store');
    Route::put('vehiculos/{vehiculo}', [VehiculoController::class, 'update'])->name('vehiculos.update');
    Route::delete('vehiculos/{vehiculo}', [VehiculoController::class, 'destroy'])->name('vehiculos.destroy');

    Route::get('articulos', [ArticuloController::class, 'index'])->name('articulos.index');
    Route::post('articulos', [ArticuloController::class, 'store'])->name('articulos.store');
    Route::post('articulos/{articulo}/movimiento', [ArticuloController::class, 'storeMovement'])->name('articulos.movimiento');

    Route::get('transactions', [TransactionController::class, 'index'])->name('transactions.index');

    Route::get('vehiculos/{vehiculo}/asignaciones', [AsignacionController::class, 'index'])->name('vehiculos.asignaciones');
    Route::get('vehiculos/{vehiculo}/asignaciones/pdf', [AsignacionController::class, 'pdf'])->name('vehiculos.asignaciones.pdf');

    Route::get('pdf/stock', [PdfController::class, 'stock'])->name('pdf.stock');
    Route::get('pdf/transactions', [PdfController::class, 'transactions'])->name('pdf.transactions');

    Route::get('appointments', [AppointmentController::class, 'index'])->name('appointments.index');

    Route::post('appointments', [AppointmentController::class, 'store'])->name('appointments.store');
    Route::patch('appointments/{appointment}/status', [AppointmentController::class, 'updateStatus'])->name('appointments.status');

    Route::get('users', [UserController::class, 'index'])->name('users.index');
    Route::post('users', [UserController::class, 'store'])->name('users.store');
    Route::patch('users/{user}/role', [UserController::class, 'updateRole'])->name('users.update-role');
    Route::patch('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');
});

require __DIR__.'/settings.php';
