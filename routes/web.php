<?php

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\ArticuloController;
use App\Http\Controllers\AsignacionController;
use App\Http\Controllers\CierreGastoController;
use App\Http\Controllers\CierreInversionController;
use App\Http\Controllers\CobroController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EmpresaController;
use App\Http\Controllers\ExcelController;
use App\Http\Controllers\GastoController;
use App\Http\Controllers\InversionController;
use App\Http\Controllers\HistorialController;
use App\Http\Controllers\RecaudacionController;
use App\Http\Controllers\MiCuentaController;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\RevisionController;
use App\Http\Controllers\RevisionMecanicaController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VehiculoController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (auth()->check()) {
        if (auth()->user()->isMechanic()) {
            return redirect()->route('appointments.index');
        }

        if (auth()->user()->isInversor()) {
            return redirect()->route('mi-cuenta.index');
        }

        return redirect()->route('dashboard');
    }

    return redirect()->route('login');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {

    // ── Cambio de empresa activa (admin + administrativo vía Gate) ──────
    Route::post('empresa/switch', [EmpresaController::class, 'switch'])->name('empresa.switch');

    // ─────────────────────────────────────────────────────────────────────
    // Administrador + Administrativo + Mecánico
    // Áreas globales: Inventario y Turnos.
    // ─────────────────────────────────────────────────────────────────────
    Route::middleware('role:administrador,administrativo,mecanico')->group(function () {
        // Inventario
        Route::get('articulos', [ArticuloController::class, 'index'])->name('articulos.index');
        Route::post('articulos', [ArticuloController::class, 'store'])->name('articulos.store');
        Route::post('articulos/{articulo}/movimiento', [ArticuloController::class, 'storeMovement'])->name('articulos.movimiento');
        Route::post('articulos/salida-multiple', [ArticuloController::class, 'salidaMultiple'])->name('articulos.salida-multiple');

        // Turnos (mecánico puede ver y cambiar status; create lo limita la Policy).
        Route::get('appointments', [AppointmentController::class, 'index'])->name('appointments.index');
        Route::post('appointments', [AppointmentController::class, 'store'])->name('appointments.store');
        Route::patch('appointments/{appointment}/status', [AppointmentController::class, 'updateStatus'])->name('appointments.status');

        // Service (global): mecánico también, es quien realiza el service.
        Route::get('services', [ServiceController::class, 'index'])->name('services.index');
        Route::post('services/{vehiculo}', [ServiceController::class, 'store'])->name('services.store');
        Route::post('services/{vehiculo}/kilometraje', [ServiceController::class, 'storeKilometraje'])->name('services.kilometraje');
        Route::delete('services/{service}', [ServiceController::class, 'destroy'])->name('services.destroy');

        // PDFs de inventario/turnos
        Route::get('pdf/stock', [PdfController::class, 'stock'])->name('pdf.stock');
        Route::get('pdf/appointments', [PdfController::class, 'appointments'])->name('pdf.appointments');
    });

    // ─────────────────────────────────────────────────────────────────────
    // Administrador + Administrativo
    // Vehículos, Revisiones, Personal, Transacciones (vista).
    // ─────────────────────────────────────────────────────────────────────
    Route::middleware('role:administrador,administrativo')->group(function () {
        Route::get('dashboard', DashboardController::class)->name('dashboard');

        // Vehículos
        Route::post('vehiculos', [VehiculoController::class, 'store'])->name('vehiculos.store');
        Route::put('vehiculos/{vehiculo}', [VehiculoController::class, 'update'])->name('vehiculos.update');
        Route::patch('vehiculos/{vehiculo}/desasignar', [VehiculoController::class, 'desasignar'])->name('vehiculos.desasignar');
        Route::patch('vehiculos/{vehiculo}/estado-patente', [VehiculoController::class, 'updateEstadoPatente'])->name('vehiculos.estado-patente');
        Route::post('vehiculos/{vehiculo}/documentos', [VehiculoController::class, 'updateDocumentos'])->name('vehiculos.documentos');
        Route::delete('vehiculos/{vehiculo}', [VehiculoController::class, 'destroy'])->name('vehiculos.destroy');
        Route::get('vehiculos/{vehiculo}/asignaciones', [AsignacionController::class, 'index'])->name('vehiculos.asignaciones');
        Route::get('vehiculos/{vehiculo}/asignaciones/pdf', [AsignacionController::class, 'pdf'])->name('vehiculos.asignaciones.pdf');

        // Revisión mecánica (dashboard de prioridad de reparación)
        Route::get('revision-mecanica', [RevisionMecanicaController::class, 'index'])->name('revision-mecanica.index');
        Route::post('revision-mecanica/{vehiculo}', [RevisionMecanicaController::class, 'store'])->name('revision-mecanica.store');

        // Revisiones
        Route::get('revisiones', [RevisionController::class, 'index'])->name('revisiones.index');
        Route::post('revisiones/cierre', [RevisionController::class, 'cerrar'])->name('revisiones.cerrar');
        Route::get('revisiones/historial', [RevisionController::class, 'historial'])->name('revisiones.historial');
        Route::get('revisiones/historial/{cierre}', [RevisionController::class, 'historialShow'])->name('revisiones.historial.show');
        Route::post('revisiones/{vehiculo}', [RevisionController::class, 'store'])->name('revisiones.store');

        // Personal
        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::put('users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::patch('users/{user}/role', [UserController::class, 'updateRole'])->name('users.update-role');
        Route::patch('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');
        Route::get('users/{user}/asignaciones', [UserController::class, 'asignaciones'])->name('users.asignaciones');
        Route::get('users/{user}/asignaciones/pdf', [UserController::class, 'asignacionesPdf'])->name('users.asignaciones.pdf');

        // Transacciones (vista)
        Route::get('transactions', [TransactionController::class, 'index'])->name('transactions.index');

        // Historial de movimientos de personal (altas/bajas de choferes y cambios
        // de vehículo) con stats, filtros y ajuste de fechas inline.
        Route::get('historial', [HistorialController::class, 'index'])->name('historial.index');
        Route::patch('historial/chofer-evento/{choferEvento}', [HistorialController::class, 'updateChoferEvento'])->name('historial.chofer-evento.update');
        Route::patch('historial/asignacion/{asignacion}', [HistorialController::class, 'updateAsignacion'])->name('historial.asignacion.update');

        // PDFs operativos
        Route::get('pdf/vehiculos', [PdfController::class, 'vehiculos'])->name('pdf.vehiculos');
        Route::get('pdf/transactions', [PdfController::class, 'transactions'])->name('pdf.transactions');
    });

    // ─────────────────────────────────────────────────────────────────────
    // Sólo Administrador
    // Cobros, Gastos, Inversiones, Cierres-Inversión, anulaciones, precios.
    // ─────────────────────────────────────────────────────────────────────
    Route::middleware('role:administrador')->group(function () {
        // Cobros
        Route::get('cobros', [CobroController::class, 'index'])->name('cobros.index');
        Route::get('cobros/cierres/{cierre}/desglose', [CobroController::class, 'cierreDesglose'])->name('cobros.cierre-desglose');
        Route::get('cobros/{inversion}', [CobroController::class, 'show'])->name('cobros.show');
        Route::post('cobros/cierre', [CobroController::class, 'cierreCaja'])->name('cobros.cierre');

        // Recaudaciones
        Route::get('recaudaciones', [RecaudacionController::class, 'index'])->name('recaudaciones.index');
        Route::post('recaudaciones/abrir', [RecaudacionController::class, 'abrir'])->name('recaudaciones.abrir');
        Route::post('recaudaciones/cierre', [RecaudacionController::class, 'cierre'])->name('recaudaciones.cierre');
        Route::get('recaudaciones/historial', [RecaudacionController::class, 'historial'])->name('recaudaciones.historial');
        Route::get('recaudaciones/cierres/{cierreRecaudacion}', [RecaudacionController::class, 'showCierre'])->name('recaudaciones.cierres.show');
        Route::patch('recaudaciones/registro/{recaudacion}', [RecaudacionController::class, 'updateRegistro'])->name('recaudaciones.registro.update');
        Route::patch('recaudaciones/{vehiculo}', [RecaudacionController::class, 'update'])->name('recaudaciones.update');

        // Gastos
        Route::get('gastos', [GastoController::class, 'index'])->name('gastos.index');
        Route::post('gastos', [GastoController::class, 'store'])->name('gastos.store');
        Route::delete('gastos/{gasto}', [GastoController::class, 'destroy'])->name('gastos.destroy');

        // Cierres de gastos
        Route::get('cierres-gasto', [CierreGastoController::class, 'index'])->name('cierres-gasto.index');
        Route::post('cierres-gasto', [CierreGastoController::class, 'store'])->name('cierres-gasto.store');
        Route::get('cierres-gasto/{cierreGasto}', [CierreGastoController::class, 'show'])->name('cierres-gasto.show');
        Route::get('pdf/cierres-gasto/{cierreGasto}', [PdfController::class, 'cierreGasto'])->name('pdf.cierre-gasto');
        Route::get('excel/cierres-gasto/{cierreGasto}', [ExcelController::class, 'cierreGasto'])->name('excel.cierre-gasto');

        // Inversiones
        Route::get('inversiones', [InversionController::class, 'index'])->name('inversiones.index');
        Route::post('inversiones', [InversionController::class, 'store'])->name('inversiones.store');
        Route::post('inversiones/{inversion}/inversores', [InversionController::class, 'attachInversor'])->name('inversiones.inversores.attach');
        Route::put('inversiones/{inversion}/inversores/sync', [InversionController::class, 'syncInversores'])->name('inversiones.inversores.sync');
        Route::patch('inversiones/{inversion}/inversores/{user}', [InversionController::class, 'updateInversor'])->name('inversiones.inversores.update');
        Route::delete('inversiones/{inversion}/inversores/{user}', [InversionController::class, 'detachInversor'])->name('inversiones.inversores.detach');
        Route::get('inversiones/{inversion}/inversores/{user}/deuda', [InversionController::class, 'showDeuda'])->name('inversiones.deuda.show');
        Route::post('inversiones/{inversion}/inversores/{user}/deuda', [InversionController::class, 'storeDeudaMovimiento'])->name('inversiones.deuda.store');
        Route::post('inversores/{user}/pago-cascada', [InversionController::class, 'pagoEnCascada'])->name('inversiones.deuda.cascada');

        // Cierres semanales de inversión
        Route::get('cierres-inversion', [CierreInversionController::class, 'index'])->name('cierres-inversion.index');
        Route::get('cierres-inversion/nuevo', [CierreInversionController::class, 'create'])->name('cierres-inversion.create');
        Route::post('cierres-inversion', [CierreInversionController::class, 'store'])->name('cierres-inversion.store');
        Route::get('cierres-inversion/{cierreInversion}', [CierreInversionController::class, 'show'])->name('cierres-inversion.show');
        Route::get('cierres-inversion/{cierreInversion}/inversor/{user}', [CierreInversionController::class, 'showInversor'])->name('cierres-inversion.inversor');

        // Anulación de transacciones (auditoría sensible)
        Route::post('transactions/{transaccion}/annul', [TransactionController::class, 'annul'])->name('transactions.annul');

        // Importación de asignaciones (operación masiva)
        Route::post('asignaciones/import', [AsignacionController::class, 'import'])->name('asignaciones.import');

        // Costo de inventario (el precio de venta se calcula con +45%)
        Route::patch('articulos/{articulo}/costo', [ArticuloController::class, 'updateCosto'])->name('articulos.update-costo');

        // PDFs/Excels financieros y de cierres
        Route::get('pdf/recaudaciones-actuales', [PdfController::class, 'recaudacionesActuales'])->name('pdf.recaudaciones-actuales');
        Route::get('excel/recaudaciones-actuales', [ExcelController::class, 'recaudacionesActuales'])->name('excel.recaudaciones-actuales');
        Route::get('pdf/recaudaciones-deudores', [PdfController::class, 'recaudacionesDeudores'])->name('pdf.recaudaciones-deudores');
        Route::get('pdf/recaudaciones-deudores/cierre/{cierreRecaudacion}', [PdfController::class, 'recaudacionesDeudoresCierre'])->name('pdf.recaudaciones-deudores-cierre');
        Route::get('pdf/cobros', [PdfController::class, 'cobros'])->name('pdf.cobros');
        Route::get('pdf/cobros-integrado', [PdfController::class, 'cobrosIntegrado'])->name('pdf.cobros-integrado');
        Route::get('excel/cobros-integrado', [ExcelController::class, 'cobrosIntegrado'])->name('excel.cobros-integrado');
        Route::get('pdf/cierres-caja/{cierre}', [PdfController::class, 'cierreCaja'])->name('pdf.cierre-caja');
        Route::get('pdf/cierres-inversion/{cierreInversion}', [PdfController::class, 'cierreInversion'])->name('pdf.cierre-inversion');
        Route::get('excel/cierres-inversion/{cierreInversion}', [ExcelController::class, 'cierreInversion'])->name('excel.cierre-inversion');
        Route::get('excel/cobros', [ExcelController::class, 'cobros'])->name('excel.cobros');
    });

    // ─────────────────────────────────────────────────────────────────────
    // Sólo Inversor
    // ─────────────────────────────────────────────────────────────────────
    Route::middleware('role:inversor')->group(function () {
        Route::get('mi-cuenta', [MiCuentaController::class, 'index'])->name('mi-cuenta.index');
        Route::get('pdf/mi-cuenta', [PdfController::class, 'miCuenta'])->name('pdf.mi-cuenta');
        Route::get('excel/mi-cuenta', [ExcelController::class, 'miCuenta'])->name('excel.mi-cuenta');
    });
});

require __DIR__.'/settings.php';
