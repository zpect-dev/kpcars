<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessStockMovementAction;
use App\Models\Articulo;
use App\Models\Vehiculo;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;
use Illuminate\Support\Facades\DB;

class ArticuloController extends Controller
{
    /**
     * Display the list of items ordered alphabetically.
     */
    public function index(Request $request): Response
    {
        abort_if($request->user()->isInversor(), 403);

        $articulos = Articulo::orderBy('descripcion')->get();
        $vehiculos = Vehiculo::visibleTo($request->user())
            ->orderBy('patente')
            ->select('id', 'patente', 'marca', 'modelo')
            ->get();

        return Inertia::render('Items/Index', [
            'items' => $articulos,
            'vehiculos' => $vehiculos,
        ]);
    }

    /**
     * Store a newly created item or add stock to an existing one.
     */
    public function store(Request $request, ProcessStockMovementAction $action): RedirectResponse
    {
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isInversor(), 403);
        $validated = $request->validate([
            'descripcion' => ['required', 'string', 'max:255'],
            'stock' => ['required', 'integer', 'min:0'],
            'min_stock' => ['required', 'integer', 'min:0'],
        ]);

        $descripcion = trim($validated['descripcion']);
        $quantityToAdd = (int) $validated['stock'];
        $isNew = false;

        $articulo = DB::transaction(function () use ($descripcion, $validated, $quantityToAdd, $action, &$isNew) {
            $articulo = Articulo::whereRaw('LOWER(descripcion) = ?', [strtolower($descripcion)])->first();

            if ($articulo) {
                // Update min_stock if changed
                if ((int)$articulo->min_stock !== (int)$validated['min_stock']) {
                    $articulo->update(['min_stock' => $validated['min_stock']]);
                }
            } else {
                // Create item with stock 0 initially
                $articulo = Articulo::create([
                    'descripcion' => $descripcion,
                    'stock' => 0,
                    'min_stock' => $validated['min_stock'],
                ]);
                $isNew = true;
            }

            // Always register stock movement asynchronously via append-only mechanism if quantity > 0
            if ($quantityToAdd > 0) {
                $action->execute($articulo, 'IN', $quantityToAdd);
            }

            return $articulo;
        });

        if ($isNew) {
            return redirect()->back()->with('success', "Artículo \"{$descripcion}\" registrado correctamente.");
        }

        return redirect()->back()->with('success', "Stock actualizado correctamente para \"{$descripcion}\".");
    }

    /**
     * Process a stock movement (IN/OUT) for a given item.
     */
    public function storeMovement(Request $request, Articulo $articulo, ProcessStockMovementAction $action): RedirectResponse
    {
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isInversor(), 403);
        $validated = $request->validate([
            'tipo' => ['required', 'in:IN,OUT'],
            'cantidad' => ['required', 'numeric', 'min:1'],
            'patente' => ['required_if:tipo,OUT', 'nullable', 'string'],
            'solicitante' => ['nullable', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $action->execute(
                $articulo,
                $validated['tipo'],
                (int) $validated['cantidad'],
                $validated['patente'] ?? null,
                $validated['solicitante'] ?? null,
                $validated['descripcion'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return redirect()->back()->withErrors(['patente' => $e->getMessage()]);
        } catch (Exception $e) {
            return redirect()->back()->withErrors(['stock' => $e->getMessage()]);
        }

        // Refresh the model to get the updated stock value
        $articulo->refresh();

        // Evaluate low-stock alert (logic-rules: current_stock <= min_stock)
        if ($articulo->stock <= $articulo->min_stock) {
            return redirect()->back()->with('warning', "Alerta: Stock mínimo alcanzado para {$articulo->descripcion}.");
        }

        return redirect()->back()->with('success', 'Movimiento registrado correctamente.');
    }
}
