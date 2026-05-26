<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessStockMovementAction;
use App\Models\Articulo;
use App\Models\Vehiculo;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
            'codigo' => ['nullable', 'string', 'max:255'],
            'repuestos' => ['nullable', 'boolean'],
            'stock' => ['required', 'integer', 'min:0'],
            'min_stock' => ['required', 'integer', 'min:0'],
            'precio' => ['nullable', 'numeric', 'min:0'],
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
                if (! empty($updateData)) {
                    $articulo->update($updateData);
                }
            } else {
                // Create item with stock 0 initially
                $articulo = Articulo::create([
                    'descripcion' => $descripcion,
                    'codigo' => $validated['codigo'] ?? null,
                    'repuestos' => (bool) ($validated['repuestos'] ?? false),
                    'stock' => 0,
                    'min_stock' => $validated['min_stock'],
                    'precio' => $validated['precio'] ?? 0,
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

    /**
     * Upload (or replace) the image of an article.
     */
    public function uploadImage(Request $request, Articulo $articulo): RedirectResponse
    {
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isInversor(), 403);

        $request->validate([
            'imagen' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ]);

        // Remove previous image if exists
        if ($articulo->imagen && Storage::disk('public')->exists($articulo->imagen)) {
            Storage::disk('public')->delete($articulo->imagen);
        }

        $path = $request->file('imagen')->store('articulos', 'public');

        $articulo->update(['imagen' => $path]);

        return redirect()->back()->with('success', 'Imagen actualizada correctamente.');
    }

    /**
     * Delete the image of an article.
     */
    public function deleteImage(Request $request, Articulo $articulo): RedirectResponse
    {
        abort_if($request->user()->isMechanic(), 403);
        abort_if($request->user()->isInversor(), 403);

        if ($articulo->imagen && Storage::disk('public')->exists($articulo->imagen)) {
            Storage::disk('public')->delete($articulo->imagen);
        }

        $articulo->update(['imagen' => null]);

        return redirect()->back()->with('success', 'Imagen eliminada correctamente.');
    }

    /**
     * Update the price for a given item.
     */
    public function updatePrecio(Request $request, Articulo $articulo): RedirectResponse
    {
        abort_unless($request->user()->isAdmin(), 403, 'Solo los administradores pueden modificar precios.');

        $validated = $request->validate([
            'precio' => ['required', 'numeric', 'min:0'],
        ]);

        $articulo->update(['precio' => $validated['precio']]);

        return redirect()->back()->with('success', "Precio actualizado para \"{$articulo->descripcion}\".");
    }
}
