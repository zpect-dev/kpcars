<?php

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\ArticuloController;
use App\Http\Controllers\AsignacionController;
use App\Http\Controllers\CierreInversionController;
use App\Http\Controllers\CobroController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InversionController;
use App\Http\Controllers\MiCuentaController;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\RevisionController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VehiculoController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (auth()->check()) {
        if (auth()->user()->isMechanic()) {
            return redirect()->route('appointments.index');
        }

        return redirect()->route('dashboard');
    }

    return redirect()->route('login');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::post('vehiculos', [VehiculoController::class, 'store'])->name('vehiculos.store');
    Route::put('vehiculos/{vehiculo}', [VehiculoController::class, 'update'])->name('vehiculos.update');
    Route::patch('vehiculos/{vehiculo}/desasignar', [VehiculoController::class, 'desasignar'])->name('vehiculos.desasignar');
    Route::delete('vehiculos/{vehiculo}', [VehiculoController::class, 'destroy'])->name('vehiculos.destroy');

    Route::get('articulos', [ArticuloController::class, 'index'])->name('articulos.index');
    Route::post('articulos', [ArticuloController::class, 'store'])->name('articulos.store');
    Route::post('articulos/{articulo}/movimiento', [ArticuloController::class, 'storeMovement'])->name('articulos.movimiento');

    Route::get('transactions', [TransactionController::class, 'index'])->name('transactions.index');
    Route::post('transactions/{transaccion}/annul', [TransactionController::class, 'annul'])->name('transactions.annul');

    Route::get('vehiculos/{vehiculo}/asignaciones', [AsignacionController::class, 'index'])->name('vehiculos.asignaciones');
    Route::get('vehiculos/{vehiculo}/asignaciones/pdf', [AsignacionController::class, 'pdf'])->name('vehiculos.asignaciones.pdf');

    Route::post('asignaciones/import', [AsignacionController::class, 'import'])->name('asignaciones.import');

    Route::get('pdf/stock', [PdfController::class, 'stock'])->name('pdf.stock');
    Route::get('pdf/transactions', [PdfController::class, 'transactions'])->name('pdf.transactions');
    Route::get('pdf/appointments', [PdfController::class, 'appointments'])->name('pdf.appointments');
    Route::get('pdf/cobros', [PdfController::class, 'cobros'])->name('pdf.cobros');

    Route::get('appointments', [AppointmentController::class, 'index'])->name('appointments.index');

    Route::post('appointments', [AppointmentController::class, 'store'])->name('appointments.store');
    Route::patch('appointments/{appointment}/status', [AppointmentController::class, 'updateStatus'])->name('appointments.status');

    Route::get('users', [UserController::class, 'index'])->name('users.index');
    Route::post('users', [UserController::class, 'store'])->name('users.store');
    Route::put('users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::patch('users/{user}/role', [UserController::class, 'updateRole'])->name('users.update-role');
    Route::patch('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');
    Route::patch('users/{user}/toggle-absoluto', [UserController::class, 'toggleAbsoluto'])->name('users.toggle-absoluto');
    Route::get('users/{user}/asignaciones', [UserController::class, 'asignaciones'])->name('users.asignaciones');
    Route::get('users/{user}/asignaciones/pdf', [UserController::class, 'asignacionesPdf'])->name('users.asignaciones.pdf');

    Route::get('revisiones', [RevisionController::class, 'index'])->name('revisiones.index');
    Route::post('revisiones/cierre', [RevisionController::class, 'cerrar'])->name('revisiones.cerrar');
    Route::get('revisiones/historial', [RevisionController::class, 'historial'])->name('revisiones.historial');
    Route::get('revisiones/historial/{cierre}', [RevisionController::class, 'historialShow'])->name('revisiones.historial.show');
    Route::post('revisiones/{vehiculo}', [RevisionController::class, 'store'])->name('revisiones.store');

    Route::get('cobros', [CobroController::class, 'index'])->name('cobros.index');
    Route::get('cobros/{inversion}', [CobroController::class, 'show'])->name('cobros.show');
    Route::post('cobros/cierre', [CobroController::class, 'cierreCaja'])->name('cobros.cierre');

    Route::patch('articulos/{articulo}/precio', [ArticuloController::class, 'updatePrecio'])->name('articulos.update-precio');

    // Panel admin: inversiones e inversores asignados + deuda
    Route::get('inversiones', [InversionController::class, 'index'])->name('inversiones.index');
    Route::post('inversiones/{inversion}/inversores', [InversionController::class, 'attachInversor'])->name('inversiones.inversores.attach');
    Route::put('inversiones/{inversion}/inversores/sync', [InversionController::class, 'syncInversores'])->name('inversiones.inversores.sync');
    Route::patch('inversiones/{inversion}/inversores/{user}', [InversionController::class, 'updateInversor'])->name('inversiones.inversores.update');
    Route::delete('inversiones/{inversion}/inversores/{user}', [InversionController::class, 'detachInversor'])->name('inversiones.inversores.detach');
    Route::get('inversiones/{inversion}/inversores/{user}/deuda', [InversionController::class, 'showDeuda'])->name('inversiones.deuda.show');
    Route::post('inversiones/{inversion}/inversores/{user}/deuda', [InversionController::class, 'storeDeudaMovimiento'])->name('inversiones.deuda.store');

    // Cierres semanales de inversión (admin)
    Route::get('cierres-inversion', [CierreInversionController::class, 'index'])->name('cierres-inversion.index');
    Route::get('cierres-inversion/nuevo', [CierreInversionController::class, 'create'])->name('cierres-inversion.create');
    Route::post('cierres-inversion', [CierreInversionController::class, 'store'])->name('cierres-inversion.store');
    Route::get('cierres-inversion/{cierreInversion}', [CierreInversionController::class, 'show'])->name('cierres-inversion.show');
    Route::get('cierres-inversion/{cierreInversion}/inversor/{user}', [CierreInversionController::class, 'showInversor'])->name('cierres-inversion.inversor');

    // Vista del inversor
    Route::get('mi-cuenta', [MiCuentaController::class, 'index'])->name('mi-cuenta.index');
});

require __DIR__.'/settings.php';
