<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\PrioridadReparacion;
use App\Models\RevisionMecanica;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class RevisionMecanicaController extends Controller
{
    /**
     * Dashboard de revisión mecánica: todos los vehículos con chofer asignado y
     * su última revisión (prioridad de reparación). Global a todas las empresas.
     */
    public function index(Request $request): Response
    {
        $this->authorize('view-revision-mecanica');

        return Inertia::render('RevisionMecanica/Index', [
            'filas' => $this->filas(),
            'items' => collect(RevisionMecanica::ITEMS)
                ->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])
                ->values(),
        ]);
    }

    /**
     * Filas del dashboard: cada vehículo con chofer + su última revisión mecánica.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function filas(): Collection
    {
        $vehiculos = Vehiculo::withoutGlobalScope(TenantScope::class)
            ->with(['user:id,name', 'inversion:id,nombre'])
            ->where('patente', '!=', 'EXTERNO')
            ->whereNotNull('user_id')
            ->orderBy('patente')
            ->get();

        // Última revisión mecánica por vehículo (una sola query).
        $ultimas = RevisionMecanica::with('revisor:id,name')
            ->whereIn('vehiculo_id', $vehiculos->pluck('id'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('vehiculo_id');

        return $vehiculos->map(function (Vehiculo $v) use ($ultimas) {
            $r = $ultimas->get($v->id)?->first();

            return [
                'vehiculo_id' => $v->id,
                'patente' => $v->patente,
                'marca' => $v->marca,
                'modelo' => $v->modelo,
                'chofer' => $v->user?->name ?? 'N/A',
                'inversion' => $v->inversion?->nombre,
                'revision' => $r ? [
                    'promedio' => (float) $r->promedio,
                    'prioridad' => $r->prioridad->value,
                    'items' => $r->items,
                    'observaciones' => $r->observaciones,
                    'revisor' => $r->revisor?->name,
                    'fecha' => $r->created_at?->toISOString(),
                ] : null,
            ];
        })->values();
    }

    /**
     * Exporta a PDF el listado de vehículos en revisión mecánica, respetando los
     * filtros de la vista (búsqueda por patente/chofer y prioridad).
     */
    public function pdf(Request $request): \Illuminate\Http\Response
    {
        $this->authorize('view-revision-mecanica');

        $q = trim((string) $request->query('q', ''));
        $prioridad = $request->query('prioridad'); // alta | media | baja | pendiente | null

        $pesos = ['alta' => 3, 'media' => 2, 'baja' => 1];

        $filas = $this->filas()
            ->filter(function (array $f) use ($q, $prioridad) {
                if ($prioridad === 'pendiente' && $f['revision'] !== null) {
                    return false;
                }
                if (in_array($prioridad, ['alta', 'media', 'baja'], true)
                    && ($f['revision']['prioridad'] ?? null) !== $prioridad) {
                    return false;
                }
                if ($q !== '') {
                    $needle = mb_strtolower($q);
                    if (! str_contains(mb_strtolower($f['patente']), $needle)
                        && ! str_contains(mb_strtolower($f['chofer']), $needle)) {
                        return false;
                    }
                }

                return true;
            })
            // Prioridad desc (alta > media > baja > sin revisión), luego patente.
            ->sort(function (array $a, array $b) use ($pesos) {
                $pa = $a['revision'] ? $pesos[$a['revision']['prioridad']] : 0;
                $pb = $b['revision'] ? $pesos[$b['revision']['prioridad']] : 0;

                return $pb <=> $pa ?: strnatcasecmp($a['patente'], $b['patente']);
            })
            ->values();

        $titulos = [
            'alta' => 'Prioridad alta',
            'media' => 'Prioridad media',
            'baja' => 'Prioridad baja',
            'pendiente' => 'Pendientes (sin revisión)',
        ];
        $titulo = $titulos[$prioridad] ?? 'Todos';

        $pdf = Pdf::loadView('pdf.revision-mecanica', [
            'filas' => $filas,
            'titulo' => $titulo,
            'busqueda' => $q,
        ]);
        $pdf->setPaper('a4', 'landscape');

        return $pdf->download('revision-mecanica-'.now()->format('Ymd').'.pdf');
    }

    /**
     * Registra una nueva revisión mecánica para un vehículo, calculando el
     * promedio de gravedad y la prioridad de reparación resultante.
     */
    public function store(Request $request, int $vehiculo): RedirectResponse
    {
        $this->authorize('manage-revision-mecanica');

        $veh = Vehiculo::withoutGlobalScope(TenantScope::class)->findOrFail($vehiculo);

        $keys = array_keys(RevisionMecanica::ITEMS);

        $rules = [
            'items' => ['required', 'array'],
            'observaciones' => ['nullable', 'string', 'max:2000'],
        ];
        foreach ($keys as $k) {
            $rules["items.{$k}.gravedad"] = ['required', 'integer', 'min:1', 'max:5'];
            $rules["items.{$k}.descripcion"] = ['nullable', 'string', 'max:1000'];
        }

        $validated = $request->validate($rules);

        $items = [];
        $suma = 0;
        $maximo = 1;
        foreach ($keys as $k) {
            $gravedad = (int) $validated['items'][$k]['gravedad'];
            $items[$k] = [
                'gravedad' => $gravedad,
                'descripcion' => $validated['items'][$k]['descripcion'] ?? null,
            ];
            $suma += $gravedad;
            if ($gravedad > $maximo) $maximo = $gravedad;
        }

        $promedio = round($suma / count($keys), 2);
        $prioridad = PrioridadReparacion::fromMaximo($maximo);

        RevisionMecanica::create([
            'vehiculo_id' => $veh->id,
            'revisado_por' => $request->user()->id,
            'promedio' => $promedio,
            'prioridad' => $prioridad,
            'items' => $items,
            'observaciones' => $validated['observaciones'] ?? null,
        ]);

        return redirect()->back()->with('success', "Revisión mecánica registrada para {$veh->patente} (prioridad {$prioridad->label()}).");
    }
}
