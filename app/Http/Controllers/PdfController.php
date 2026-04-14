<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Articulo;
use App\Models\Transaccion;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PdfController extends Controller
{
    /**
     * Generate PDF with current stock of all articles.
     */
    public function stock(): Response
    {
        $articulos = Articulo::orderBy('descripcion')->get();

        $pdf = Pdf::loadView('pdf.stock', compact('articulos'))
            ->setPaper('a4', 'portrait');

        return $pdf->download('stock-' . now()->format('Y-m-d') . '.pdf');
    }

    /**
     * Generate PDF with transaction history, respecting current filters.
     */
    public function transactions(Request $request): Response
    {
        $filters = $request->only(['article', 'plate', 'applicant']);
        $articleId = $filters['article'] ?? null;

        $transactions = Transaccion::with(['articulo', 'vehiculo', 'user'])
            ->filterByItem($articleId ? (int) $articleId : null)
            ->searchByPlate($filters['plate'] ?? null)
            ->searchByApplicant($filters['applicant'] ?? null)
            ->latest()
            ->get();

        $viewData = compact('transactions', 'filters');

        if ($articleId) {
            $articulo = Articulo::find((int) $articleId);
            if ($articulo) {
                $viewData['articleName']  = $articulo->descripcion;
                $viewData['articleStock'] = $articulo->stock;
            }
        }

        $pdf = Pdf::loadView('pdf.transactions', $viewData)
            ->setPaper('a4', 'portrait');

        return $pdf->download('transacciones-' . now()->format('Y-m-d') . '.pdf');
    }
}
