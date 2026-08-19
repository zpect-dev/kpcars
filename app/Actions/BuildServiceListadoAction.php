<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\KilometrajeLectura;
use App\Models\Revision;
use App\Models\Scopes\TenantScope;
use App\Models\Service;
use App\Models\Vehiculo;
use Illuminate\Support\Collection;

/**
 * Arma el listado del panel de Service: cada vehículo con su kilometraje
 * actual y su último service. La usan la pantalla y las exportaciones, para
 * que el PDF y el Excel no puedan mostrar cifras distintas a la tabla.
 */
class BuildServiceListadoAction
{
    /** Orden de urgencia: vencido primero, sin datos al final. */
    private const PRIORIDAD = [
        'vencido' => 0,
        'sin_service' => 1,
        'al_dia' => 2,
        'sin_km' => 3,
    ];

    /**
     * @param  array{q?: ?string, estado?: ?string}  $filtros
     * @return Collection<int, array<string, mixed>>
     */
    public function execute(array $filtros = []): Collection
    {
        // Service es global: todos los carros de todas las empresas.
        // Se excluye el vehículo sintético "EXTERNO" (no es un carro real).
        $vehiculos = Vehiculo::withoutGlobalScope(TenantScope::class)
            ->with(['user:id,name', 'inversion:id,nombre', 'empresa:id,nombre', 'services.realizadoPor:id,name'])
            ->where('patente', '!=', 'EXTERNO')
            ->orderBy('patente')
            ->get();

        $vehiculoIds = $vehiculos->pluck('id');

        // Km más reciente de las revisiones por vehículo (cerrada o no).
        $ultimaRevision = Revision::select('vehiculo_id', 'kilometraje', 'created_at')
            ->whereIn('vehiculo_id', $vehiculoIds)
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('vehiculo_id');

        // Última lectura de kilometraje cargada manualmente por vehículo.
        $ultimaLectura = KilometrajeLectura::select('vehiculo_id', 'kilometraje', 'fecha')
            ->whereIn('vehiculo_id', $vehiculoIds)
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->get()
            ->groupBy('vehiculo_id');

        $filas = $vehiculos->map(function (Vehiculo $vehiculo) use ($ultimaRevision, $ultimaLectura): array {
            // Km actual = la lectura más reciente por fecha entre la última
            // revisión y la última carga manual. En empate de fecha, el mayor km.
            $candidatos = [];
            if ($rev = $ultimaRevision->get($vehiculo->id)?->first()) {
                $candidatos[] = ['fecha' => $rev->created_at->toDateString(), 'km' => (int) $rev->kilometraje];
            }
            if ($lec = $ultimaLectura->get($vehiculo->id)?->first()) {
                $candidatos[] = ['fecha' => $lec->fecha->toDateString(), 'km' => (int) $lec->kilometraje];
            }

            usort($candidatos, fn ($a, $b) => $a['fecha'] <=> $b['fecha'] ?: $a['km'] <=> $b['km']);
            $kmActual = $candidatos ? end($candidatos)['km'] : null;

            $ultimoService = $vehiculo->services->first(); // ya ordenado desc por la relación

            $kmRecorridos = null;
            $kmRestantes = null;
            $estado = 'sin_km';

            if ($kmActual === null) {
                $estado = 'sin_km';
            } elseif ($ultimoService === null) {
                $estado = 'sin_service';
            } else {
                $kmRecorridos = max(0, $kmActual - $ultimoService->kilometraje);
                $kmRestantes = max(0, Service::INTERVALO_KM - $kmRecorridos);
                $estado = $kmRecorridos >= Service::INTERVALO_KM ? 'vencido' : 'al_dia';
            }

            return [
                'id' => $vehiculo->id,
                'patente' => $vehiculo->patente,
                'marca' => $vehiculo->marca,
                'modelo' => $vehiculo->modelo,
                'anio' => $vehiculo->anio,
                'empresa' => $vehiculo->empresa?->nombre,
                'inversion' => $vehiculo->inversion?->nombre,
                'conductor' => $vehiculo->user?->name,
                'km_actual' => $kmActual,
                'ultimo_service' => $ultimoService ? [
                    'kilometraje' => $ultimoService->kilometraje,
                    'fecha' => $ultimoService->fecha->toDateString(),
                    'realizado_por' => $ultimoService->realizadoPor?->name,
                ] : null,
                'km_recorridos' => $kmRecorridos,
                'km_restantes' => $kmRestantes,
                'estado' => $estado,
                'historial' => $vehiculo->services->map(fn (Service $s) => [
                    'id' => $s->id,
                    'kilometraje' => $s->kilometraje,
                    'fecha' => $s->fecha->toDateString(),
                    'realizado_por' => $s->realizadoPor?->name,
                ])->values(),
            ];
        });

        return $this->ordenar($this->filtrar($filas, $filtros));
    }

    /**
     * Mismos filtros que la pantalla: búsqueda libre y estado.
     *
     * @param  Collection<int, array<string, mixed>>  $filas
     * @param  array{q?: ?string, estado?: ?string}  $filtros
     * @return Collection<int, array<string, mixed>>
     */
    private function filtrar(Collection $filas, array $filtros): Collection
    {
        $q = mb_strtolower(trim((string) ($filtros['q'] ?? '')));
        $estado = $filtros['estado'] ?? null;

        if ($estado !== null && ! array_key_exists($estado, self::PRIORIDAD)) {
            $estado = null;
        }

        return $filas->filter(function (array $fila) use ($q, $estado): bool {
            if ($estado !== null && $fila['estado'] !== $estado) {
                return false;
            }

            if ($q === '') {
                return true;
            }

            foreach (['patente', 'marca', 'modelo', 'conductor'] as $campo) {
                if (str_contains(mb_strtolower((string) $fila[$campo]), $q)) {
                    return true;
                }
            }

            return false;
        })->values();
    }

    /**
     * Mismo orden que la pantalla: vencidos por mayor excedido, al día por
     * menor restante, el resto por patente.
     *
     * @param  Collection<int, array<string, mixed>>  $filas
     * @return Collection<int, array<string, mixed>>
     */
    private function ordenar(Collection $filas): Collection
    {
        return $filas->sort(function (array $a, array $b): int {
            $prioridad = self::PRIORIDAD[$a['estado']] <=> self::PRIORIDAD[$b['estado']];

            if ($prioridad !== 0) {
                return $prioridad;
            }

            if ($a['estado'] === 'vencido') {
                return ($b['km_recorridos'] ?? 0) <=> ($a['km_recorridos'] ?? 0);
            }

            if ($a['estado'] === 'al_dia') {
                return ($a['km_restantes'] ?? 0) <=> ($b['km_restantes'] ?? 0);
            }

            return strnatcasecmp($a['patente'], $b['patente']);
        })->values();
    }
}
