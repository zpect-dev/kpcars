<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessBulkStockOutAction;
use App\Actions\ProcessStockMovementAction;
use App\Models\Articulo;
use App\Models\Vehiculo;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class ArticuloController extends Controller
{
    /**
     * Display the list of items ordered alphabetically.
     */
    public function index(Request $request): Response
    {
        $articulos = Articulo::orderBy('descripcion')->get();
        // Inventario es global: se puede despachar a cualquier carro de cualquier
        // empresa. El cobro generado se asigna a la empresa del carro destino.
        $vehiculos = Vehiculo::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->with('user:id,name')
            ->orderBy('patente')
            ->select('id', 'patente', 'marca', 'modelo', 'user_id')
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
        $this->authorize('create', Articulo::class);

        $validated = $request->validate([
            'descripcion' => ['required', 'string', 'max:255'],
            'codigo' => ['nullable', 'string', 'max:255'],
            'repuestos' => ['nullable', 'boolean'],
            'stock' => ['required', 'integer', 'min:0'],
            'min_stock' => ['required', 'integer', 'min:0'],
            'costo' => ['nullable', 'numeric', 'min:0'],
        ]);

        $descripcion = trim($validated['descripcion']);
        $quantityToAdd = (int) $validated['stock'];
        $isNew = false;

        $articulo = DB::transaction(function () use ($descripcion, $validated, $quantityToAdd, $action, &$isNew) {
            $articulo = Articulo::whereRaw('LOWER(descripcion) = ?', [strtolower($descripcion)])->first();

            if ($articulo) {
                $updateData = [];
                if ((int) $articulo->min_stock !== (int) $validated['min_stock']) {
                    $updateData['min_stock'] = $validated['min_stock'];
                }
                if (array_key_exists('codigo', $validated) && $validated['codigo'] !== $articulo->codigo) {
                    $updateData['codigo'] = $validated['codigo'];
                }
                if (array_key_exists('repuestos', $validated) && (bool) $validated['repuestos'] !== (bool) $articulo->repuestos) {
                    $updateData['repuestos'] = (bool) $validated['repuestos'];
                }
                // Si se reingresa un costo, recalcular el precio (costo * 1.45).
                if (isset($validated['costo']) && $validated['costo'] !== '') {
                    $costo = (float) $validated['costo'];
                    $updateData['costo'] = $costo;
                    $updateData['precio'] = Articulo::precioDesdeCosto($costo);
                }
                if (! empty($updateData)) {
                    $articulo->update($updateData);
                }
            } else {
                // Create item with stock 0 initially. Si hay costo, el precio se
                // calcula automáticamente sumándole el 45%.
                $hasCosto = isset($validated['costo']) && $validated['costo'] !== '';
                $costo = $hasCosto ? (float) $validated['costo'] : null;

                $articulo = Articulo::create([
                    'descripcion' => $descripcion,
                    'codigo' => $validated['codigo'] ?? null,
                    'repuestos' => (bool) ($validated['repuestos'] ?? false),
                    'stock' => 0,
                    'min_stock' => $validated['min_stock'],
                    'costo' => $costo,
                    'precio' => $hasCosto ? Articulo::precioDesdeCosto($costo) : 0,
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
        $this->authorize('storeMovement', Articulo::class);

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

    /**
     * Procesa un pedido de salida (OUT) con múltiples artículos a un único
     * destino (vehículo + solicitante), de forma atómica.
     */
    public function salidaMultiple(Request $request, ProcessBulkStockOutAction $action): RedirectResponse
    {
        $this->authorize('storeMovement', Articulo::class);

        $validated = $request->validate([
            'patente' => ['required', 'string'],
            'solicitante' => ['nullable', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:255'],
            'lineas' => ['required', 'array', 'min:1'],
            'lineas.*.articulo_id' => ['required', 'integer', 'exists:articulos,id'],
            'lineas.*.cantidad' => ['required', 'integer', 'min:1'],
        ]);

        try {
            $action->execute(
                $validated['lineas'],
                $validated['patente'],
                $validated['solicitante'] ?? null,
                $validated['descripcion'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return redirect()->back()->withErrors(['patente' => $e->getMessage()]);
        } catch (Exception $e) {
            return redirect()->back()->withErrors(['lineas' => $e->getMessage()]);
        }

        $count = count($validated['lineas']);

        return redirect()->back()->with('success', "Salida registrada: {$count} artículo(s) despachado(s).");
    }

    /**
     * Update the cost for a given item. El precio de venta se recalcula
     * automáticamente sumándole el 45% al costo (precio = costo * 1.45).
     */
    public function updateCosto(Request $request, Articulo $articulo): RedirectResponse
    {
        $this->authorize('updateCosto', $articulo);

        $validated = $request->validate([
            'costo' => ['required', 'numeric', 'min:0'],
        ]);

        $costo = (float) $validated['costo'];

        $articulo->update([
            'costo' => $costo,
            'precio' => Articulo::precioDesdeCosto($costo),
        ]);

        return redirect()->back()->with('success', "Costo actualizado para \"{$articulo->descripcion}\".");
    }
}
