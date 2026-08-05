<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\SincronizarMultasAction;
use App\Models\Acta;
use App\Models\Scopes\TenantScope;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Módulo experimental de multas alimentado por el feed externo. Convive con el
 * MultaController (registro manual) mientras se valida la transición.
 */
class ActaController extends Controller
{
    public function index(): Response
    {
        Gate::authorize('view-multas');

        $actas = Acta::query()
            ->with([
                'vehiculo' => fn ($q) => $q
                    ->withoutGlobalScope(TenantScope::class)
                    ->select('id', 'patente', 'marca', 'modelo'),
                'conductor:id,name',
            ])
            ->orderBy('patente')
            ->orderByRaw('fecha_infraccion IS NULL, fecha_infraccion DESC')
            ->get()
            ->map(fn (Acta $a) => [
                'id' => $a->id,
                'patente' => $a->patente,
                'jurisdiccion' => $a->jurisdiccion,
                'acta' => $a->acta,
                'motivo' => $a->motivo,
                'monto' => $a->monto !== null ? (float) $a->monto : null,
                'fecha_infraccion' => $a->fecha_infraccion?->toDateString(),
                'fecha_vencimiento' => $a->fecha_vencimiento?->toDateString(),
                'estado' => $a->estado,
                'resuelta_en' => $a->resuelta_en?->toDateString(),
                'vista_primera_en' => $a->vista_primera_en?->toDateString(),
                'vehiculo' => $a->vehiculo
                    ? trim("{$a->vehiculo->marca} {$a->vehiculo->modelo}")
                    : null,
                'conductor_id' => $a->conductor_id,
                'conductor' => $a->conductor?->name,
            ]);

        $stats = [
            'vigentes' => Acta::vigente()->count(),
            'resueltas' => Acta::resuelta()->count(),
            'monto_vigente' => (float) Acta::vigente()->sum('monto'),
            'bsas' => Acta::vigente()->where('jurisdiccion', 'BSAS')->count(),
            'caba' => Acta::vigente()->where('jurisdiccion', 'CABA')->count(),
        ];

        return Inertia::render('Actas/Index', [
            'actas' => $actas,
            'stats' => $stats,
            'ultimoSnapshot' => Acta::max('snapshot_fecha'),
        ]);
    }

    /**
     * Dispara la sincronización manual desde la vista ("Sincronizar ahora").
     */
    public function sincronizar(SincronizarMultasAction $action): RedirectResponse
    {
        Gate::authorize('view-multas');

        try {
            $r = $action->fetch();
        } catch (\Throwable $e) {
            return back()->with('error', 'No se pudo sincronizar con el feed: '.$e->getMessage());
        }

        if ($r['snapshot'] === null) {
            return back()->with('error', 'El feed no devolvió datos válidos.');
        }

        return back()->with('success', sprintf(
            'Sincronizado (%s): %d nuevas, %d resueltas.',
            $r['snapshot'], $r['nuevas'], $r['resueltas'],
        ));
    }
}
