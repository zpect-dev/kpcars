<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\AnnulTransactionAction;
use App\Models\Articulo;
use App\Models\Transaccion;
use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    /**
     * Display a listing of the transactions.
     */
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Transaccion::class);

        $filters = $request->only(['article', 'plate', 'applicant', 'from', 'to']);

        $articleId = $filters['article'] ?? null;

        $empresaActiva = session('active_company_id');

        $transactions = Transaccion::with(['articulo', 'vehiculo', 'user'])
            ->filterByItem($articleId ? (int) $articleId : null)
            ->searchByPlate($filters['plate'] ?? null)
            ->searchByApplicant($filters['applicant'] ?? null)
            ->filterByDate($filters['from'] ?? null, $filters['to'] ?? null)
            ->when($empresaActiva, fn ($q) => $q->where(function ($q2) {
                $q2->whereNull('vehiculo_id')->orWhereHas('vehiculo');
            }))
            ->latest()
            ->paginate(60)
            ->withQueryString();

        return Inertia::render('Transactions/Index', [
            'transactions' => $transactions,
            'filters' => $filters,
            'items' => Articulo::orderBy('descripcion')->select('id', 'descripcion')->get(),
            'vehiculos' => Vehiculo::query()->orderBy('patente')->select('id', 'patente', 'marca', 'modelo')->get(),
        ]);
    }

    /**
     * Annul the specified transaction.
     */
    public function annul(Transaccion $transaccion, AnnulTransactionAction $annulAction)
    {
        $this->authorize('annul', $transaccion);

        $annulAction->execute($transaccion);

        return back()->with('success', 'Transacción anulada correctamente.');
    }
}
