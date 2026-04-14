<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ArticuloController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\PdfController;

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }
    return redirect()->route('login');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::get('articulos', [ArticuloController::class, 'index'])->name('articulos.index');
    Route::post('articulos', [ArticuloController::class, 'store'])->name('articulos.store');
    Route::post('articulos/{articulo}/movimiento', [ArticuloController::class, 'storeMovement'])->name('articulos.movimiento');

    Route::get('transactions', [TransactionController::class, 'index'])->name('transactions.index');

    Route::get('pdf/stock', [PdfController::class, 'stock'])->name('pdf.stock');
    Route::get('pdf/transactions', [PdfController::class, 'transactions'])->name('pdf.transactions');
});

require __DIR__.'/settings.php';
