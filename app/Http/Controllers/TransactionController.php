<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\AnnulTransactionAction;
use App\Models\Articulo;
use App\Models\Scopes\TenantScope;
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

        // Inventario es global: el historial de transacciones muestra TODAS las
        // operaciones de todas las empresas. Eager-load del vehículo sin
        // TenantScope para que la patente se vea aunque sea de otra empresa.
        $transactions = Transaccion::with([
            'articulo',
            'vehiculo' => fn ($q) => $q->withoutGlobalScope(TenantScope::class),
            'user',
        ])
            ->filterByItem($articleId ? (int) $articleId : null)
            ->searchByPlate($filters['plate'] ?? null)
            ->searchByApplicant($filters['applicant'] ?? null)
            ->filterByDate($filters['from'] ?? null, $filters['to'] ?? null)
            ->latest()
            ->paginate(60)
            ->withQueryString();

        return Inertia::render('Transactions/Index', [
            'transactions' => $transactions,
            'filters' => $filters,
            'items' => Articulo::orderBy('descripcion')->select('id', 'descripcion')->get(),
            'vehiculos' => Vehiculo::withoutGlobalScope(TenantScope::class)
                ->orderBy('patente')
                ->select('id', 'patente', 'marca', 'modelo')
                ->get(),
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
