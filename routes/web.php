<?php

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\ArticuloController;
use App\Http\Controllers\AsignacionController;
use App\Http\Controllers\CierreGastoController;
use App\Http\Controllers\CierreSueldoController;
use App\Http\Controllers\CobroController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EmpresaController;
use App\Http\Controllers\ExcelController;
use App\Http\Controllers\GastoController;
use App\Http\Controllers\InversionController;
use App\Http\Controllers\HistorialController;
use App\Http\Controllers\MultaController;
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
        Route::patch('articulos/{articulo}', [ArticuloController::class, 'update'])->name('articulos.update');
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
        Route::get('revision-mecanica/pdf', [RevisionMecanicaController::class, 'pdf'])->name('revision-mecanica.pdf');
        Route::post('revision-mecanica/{vehiculo}', [RevisionMecanicaController::class, 'store'])->name('revision-mecanica.store');

        // Revisiones
        Route::get('revisiones', [RevisionController::class, 'index'])->name('revisiones.index');
        Route::post('revisiones/cierre', [RevisionController::class, 'cerrar'])->name('revisiones.cerrar');
        Route::get('revisiones/historial', [RevisionController::class, 'historial'])->name('revisiones.historial');
        Route::get('revisiones/historial/{cierre}', [RevisionController::class, 'historialShow'])->name('revisiones.historial.show');
        Route::post('revisiones/{vehiculo}', [RevisionController::class, 'store'])->name('revisiones.store');

        // Personal
        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::get('users/choferes/pdf', [UserController::class, 'choferesPdf'])->name('users.choferes.pdf');
        Route::patch('users/cotizacion-dolar', [UserController::class, 'updateCotizacion'])->name('users.cotizacion');
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::put('users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::patch('users/{user}/role', [UserController::class, 'updateRole'])->name('users.update-role');
        Route::patch('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');
        Route::get('users/{user}/asignaciones', [UserController::class, 'asignaciones'])->name('users.asignaciones');
        Route::get('users/{user}/asignaciones/pdf', [UserController::class, 'asignacionesPdf'])->name('users.asignaciones.pdf');

        // Multas (registro manual + dashboard de deuda por vehículo / por chofer)
        Route::get('multas', [MultaController::class, 'index'])->name('multas.index');
        Route::post('multas', [MultaController::class, 'store'])->name('multas.store');
        Route::patch('multas/{multa}', [MultaController::class, 'update'])->name('multas.update');
        Route::patch('multas/{multa}/pagado', [MultaController::class, 'togglePagado'])->name('multas.pagado');
        Route::patch('multas/{multa}/cobrado', [MultaController::class, 'registrarCobro'])->name('multas.cobrado');
        Route::delete('multas/{multa}/pagos/{pago}', [MultaController::class, 'eliminarPago'])->name('multas.pagos.destroy');
        Route::delete('multas/{multa}', [MultaController::class, 'destroy'])->name('multas.destroy');
        Route::patch('multas/{multa}/restaurar', [MultaController::class, 'restaurar'])->name('multas.restaurar');
        Route::get('multas/pdf', [MultaController::class, 'pdf'])->name('multas.pdf');

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
        // Historial de cierres de caja: lista + réplica de solo lectura por cierre.
        // Deben ir antes de cobros/{inversion} para no colisionar con ese catch-all.
        Route::get('cobros/historial', [CobroController::class, 'historial'])->name('cobros.historial');
        Route::get('cobros/historial/{cierre}', [CobroController::class, 'historialShow'])->name('cobros.historial.show');
        Route::get('cobros/{inversion}', [CobroController::class, 'show'])->name('cobros.show');
        Route::post('cobros/abrir', [CobroController::class, 'abrir'])->name('cobros.abrir');
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
        Route::get('pdf/gastos', [PdfController::class, 'gastos'])->name('pdf.gastos');

        // Cierres de gastos (solo detalle: el cierre se ejecuta unificado desde Cobros.
        // El index/store standalone se removió con el refactor de cobros+gastos).
        Route::get('cierres-gasto/{cierreGasto}', [CierreGastoController::class, 'show'])->name('cierres-gasto.show');
        Route::get('pdf/cierres-gasto/{cierreGasto}', [PdfController::class, 'cierreGasto'])->name('pdf.cierre-gasto');
        Route::get('excel/cierres-gasto/{cierreGasto}', [ExcelController::class, 'cierreGasto'])->name('excel.cierre-gasto');

        // Inversiones: sólo creación (usada por el dashboard de vehículos).
        // El panel navegable se eliminó; la asignación inversor/deuda se hace
        // desde Personal (users/{user}/inversiones).
        Route::post('inversiones', [InversionController::class, 'store'])->name('inversiones.store');

        // Config de inversiones+deuda por inversor desde Personal (sólo admin)
        Route::put('users/{user}/inversiones', [UserController::class, 'syncInversiones'])->name('users.inversiones.sync');

        // Cierres de sueldo (generados por el cierre unificado de recaudaciones)
        Route::get('cierres-sueldo', [CierreSueldoController::class, 'index'])->name('cierres-sueldo.index');
        Route::get('cierres-sueldo/{cierreSueldo}', [CierreSueldoController::class, 'show'])->name('cierres-sueldo.show');
        Route::patch('cierres-sueldo/{cierreSueldo}/socios/{user}', [CierreSueldoController::class, 'updateSocio'])->name('cierres-sueldo.socios.update');

        // Anulación de transacciones (auditoría sensible)
        Route::post('transactions/{transaccion}/annul', [TransactionController::class, 'annul'])->name('transactions.annul');

        // Importación de asignaciones (operación masiva)
        Route::post('asignaciones/import', [AsignacionController::class, 'import'])->name('asignaciones.import');

        // Costo de inventario (el precio de venta se calcula con +45%)
        Route::patch('articulos/{articulo}/costo', [ArticuloController::class, 'updateCosto'])->name('articulos.update-costo');

        // PDFs/Excels financieros y de cierres
        Route::get('pdf/recaudaciones-actuales', [PdfController::class, 'recaudacionesActuales'])->name('pdf.recaudaciones-actuales');
        Route::get('excel/recaudaciones-actuales', [ExcelController::class, 'recaudacionesActuales'])->name('excel.recaudaciones-actuales');
        Route::get('pdf/recaudaciones-descuentos', [PdfController::class, 'recaudacionesDescuentos'])->name('pdf.recaudaciones-descuentos');
        Route::get('excel/recaudaciones-descuentos', [ExcelController::class, 'recaudacionesDescuentos'])->name('excel.recaudaciones-descuentos');
        Route::get('pdf/recaudaciones-deudores', [PdfController::class, 'recaudacionesDeudores'])->name('pdf.recaudaciones-deudores');
        Route::get('pdf/recaudaciones-deudores/cierre/{cierreRecaudacion}', [PdfController::class, 'recaudacionesDeudoresCierre'])->name('pdf.recaudaciones-deudores-cierre');
        Route::get('pdf/cobros', [PdfController::class, 'cobros'])->name('pdf.cobros');
        Route::get('pdf/cobros-integrado', [PdfController::class, 'cobrosIntegrado'])->name('pdf.cobros-integrado');
        Route::get('excel/cobros-integrado', [ExcelController::class, 'cobrosIntegrado'])->name('excel.cobros-integrado');
        // Gastos del panel de Cobros (período actual o de un cierre puntual).
        Route::get('pdf/cobros-gastos', [PdfController::class, 'cobrosGastos'])->name('pdf.cobros-gastos');
        Route::get('pdf/cobros-gastos/{cierre}', [PdfController::class, 'cobrosGastos'])->name('pdf.cobros-gastos.cierre');
        Route::get('pdf/cierres-caja/{cierre}', [PdfController::class, 'cierreCaja'])->name('pdf.cierre-caja');
        Route::get('pdf/cierres-sueldo/{cierreSueldo}', [PdfController::class, 'cierreSueldo'])->name('pdf.cierre-sueldo');
        Route::get('excel/cierres-sueldo/{cierreSueldo}', [ExcelController::class, 'cierreSueldo'])->name('excel.cierre-sueldo');
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
