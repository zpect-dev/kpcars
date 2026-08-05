<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Acta;
use App\Models\Asignacion;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Ingesta del feed externo de multas (resolvetusmultas).
 *
 * El feed es un JSON con snapshots diarios de la deuda por patente. Solo BSAS y
 * CABA traen el detalle de infracciones individuales; el resto de municipios son
 * totales agregados y se ignoran.
 *
 * Mecánica de "pagada": cada infracción se identifica por una clave única (nº de
 * acta en BSAS, hash sintético en CABA porque no trae acta). Si en el último
 * snapshot una patente sigue presente pero su clave ya no aparece, se asume que
 * se pagó en el organismo y el acta pasa a `resuelta`. Nunca se resuelven actas
 * de una patente que desapareció por completo del feed (búsqueda caída ese día).
 */
class SincronizarMultasAction
{
    /** Únicos municipios con detalle de infracciones individuales. */
    private const MUNICIPIOS = ['BSAS', 'CABA'];

    /**
     * Baja el feed desde la URL configurada y lo procesa.
     *
     * @return array{procesadas:int,nuevas:int,resueltas:int,reabiertas:int,snapshot:?string}
     */
    public function fetch(?string $url = null): array
    {
        $url ??= (string) config('services.resolvetusmultas.feed_url');

        $request = Http::timeout(30)->retry(2, 500);

        if (! (bool) config('services.resolvetusmultas.verify', true)) {
            $request = $request->withoutVerifying();
        }

        $response = $request->get($url);
        $response->throw();

        return $this->execute((array) $response->json());
    }

    /**
     * Procesa el array de snapshots ya decodificado (separado de fetch() para
     * poder testear sin red).
     *
     * @param  array<int,array<string,mixed>>  $snapshots
     * @return array{procesadas:int,nuevas:int,resueltas:int,reabiertas:int,snapshot:?string}
     */
    public function execute(array $snapshots): array
    {
        $snapshot = $this->snapshotMasReciente($snapshots);

        if ($snapshot === null) {
            return ['procesadas' => 0, 'nuevas' => 0, 'resueltas' => 0, 'reabiertas' => 0, 'snapshot' => null];
        }

        $snapFecha = $this->parseFecha($snapshot['fecha'] ?? null) ?? Carbon::today();

        // Mapa patente => vehiculo_id de toda la flota (cross-empresa).
        $vehiculos = Vehiculo::withoutGlobalScope(TenantScope::class)
            ->where('patente', '!=', 'EXTERNO')
            ->pluck('id', 'patente');

        // Asignaciones de esos vehículos, agrupadas para imputar el chofer en
        // memoria (sin una query por multa) según la fecha de la infracción.
        $asignaciones = Asignacion::query()
            ->whereIn('vehiculo_id', $vehiculos->values())
            ->get(['vehiculo_id', 'conductor_id', 'fecha_inicio', 'fecha_fin'])
            ->groupBy('vehiculo_id');

        $patentesPresentes = [];   // patentes que vinieron en este snapshot
        $clavesVistas = [];        // claves de infracción vistas en este snapshot
        $nuevas = 0;
        $reabiertas = 0;
        $procesadas = 0;

        DB::transaction(function () use (
            $snapshot, $snapFecha, $vehiculos, $asignaciones,
            &$patentesPresentes, &$clavesVistas, &$nuevas, &$reabiertas, &$procesadas,
        ) {
            foreach ($snapshot['busquedas'] ?? [] as $busqueda) {
                $patente = strtoupper(trim((string) ($busqueda['busqueda'] ?? '')));

                if ($patente === '') {
                    continue;
                }

                $patentesPresentes[$patente] = true;

                foreach ($busqueda['resultados'] ?? [] as $resultado) {
                    $juris = $this->jurisdiccion((string) ($resultado['municipio'] ?? ''));

                    if (! in_array($juris, self::MUNICIPIOS, true)) {
                        continue;
                    }

                    foreach ($resultado['detalle'] ?? [] as $item) {
                        $clave = $this->clave($juris, $patente, $item);

                        if ($clave === null) {
                            continue; // no se pudo identificar la infracción
                        }

                        $clavesVistas[$clave] = true;
                        $procesadas++;

                        $acta = Acta::firstOrNew(['clave' => $clave]);
                        $eraResuelta = $acta->exists && $acta->estado === 'resuelta';
                        $esNueva = ! $acta->exists;

                        $vehiculoId = $vehiculos[$patente] ?? null;
                        $fechaInfraccion = $this->parseFecha($item['fechaInfraccion'] ?? null);

                        // Chofer imputado: el asignado al vehículo en la fecha de
                        // la infracción (mismo criterio que las multas manuales).
                        $conductorId = $this->choferEnFecha(
                            $vehiculoId !== null ? $asignaciones->get($vehiculoId) : null,
                            $fechaInfraccion,
                        );

                        $acta->fill([
                            'vehiculo_id' => $vehiculoId,
                            'conductor_id' => $conductorId,
                            'patente' => $patente,
                            'jurisdiccion' => $juris,
                            'acta' => $juris === 'BSAS' ? (trim((string) ($item['acta'] ?? '')) ?: null) : null,
                            'motivo' => trim((string) ($item['motivo'] ?? '')) ?: null,
                            'monto' => $this->parseMonto($item['monto'] ?? null),
                            'fecha_infraccion' => $fechaInfraccion,
                            'fecha_emision' => $this->parseFecha($item['fechaEmision'] ?? null),
                            'fecha_vencimiento' => $this->parseFecha($item['fechaVencimiento'] ?? null),
                            'estado' => 'vigente',
                            'resuelta_en' => null,
                            'vista_ultima_en' => $snapFecha,
                            'snapshot_fecha' => $snapFecha,
                            'raw' => $item,
                        ]);

                        if ($esNueva) {
                            $acta->vista_primera_en = $snapFecha;
                            $nuevas++;
                        } elseif ($eraResuelta) {
                            // La infracción había desaparecido y volvió: se reabre.
                            $reabiertas++;
                        }

                        $acta->save();
                    }
                }
            }
        });

        // Marcar resueltas: actas vigentes cuya patente SÍ vino en el snapshot
        // pero cuya clave NO apareció. Si la patente no vino (búsqueda caída), sus
        // actas quedan intactas para no dar falsos pagos.
        $resueltas = 0;

        if ($patentesPresentes !== []) {
            $resueltas = Acta::query()
                ->where('estado', 'vigente')
                ->whereIn('patente', array_keys($patentesPresentes))
                ->when($clavesVistas !== [], fn ($q) => $q->whereNotIn('clave', array_keys($clavesVistas)))
                ->update([
                    'estado' => 'resuelta',
                    'resuelta_en' => $snapFecha,
                ]);
        }

        return [
            'procesadas' => $procesadas,
            'nuevas' => $nuevas,
            'resueltas' => $resueltas,
            'reabiertas' => $reabiertas,
            'snapshot' => $snapFecha->toDateString(),
        ];
    }

    /**
     * Toma el snapshot con la fecha más reciente. El feed suele venir ordenado,
     * pero no lo damos por hecho.
     *
     * @param  array<int,array<string,mixed>>  $snapshots
     * @return array<string,mixed>|null
     */
    private function snapshotMasReciente(array $snapshots): ?array
    {
        $mejor = null;
        $mejorFecha = null;

        foreach ($snapshots as $snap) {
            if (! is_array($snap)) {
                continue;
            }

            $fecha = $this->parseFecha($snap['fecha'] ?? null);

            if ($fecha === null) {
                continue;
            }

            if ($mejorFecha === null || $fecha->greaterThan($mejorFecha)) {
                $mejor = $snap;
                $mejorFecha = $fecha;
            }
        }

        return $mejor;
    }

    /**
     * Clave única de la infracción. BSAS trae acta oficial; CABA no, así que se
     * fabrica un hash estable con patente + fecha + motivo + monto.
     *
     * @param  array<string,mixed>  $item
     */
    private function clave(string $jurisdiccion, string $patente, array $item): ?string
    {
        if ($jurisdiccion === 'BSAS') {
            $acta = trim((string) ($item['acta'] ?? ''));

            return $acta === '' ? null : 'BSAS:'.$acta;
        }

        // CABA: sin acta. Hash de los campos que identifican la infracción.
        $partes = [
            $patente,
            trim((string) ($item['fechaInfraccion'] ?? '')),
            trim((string) ($item['motivo'] ?? '')),
            trim((string) ($item['monto'] ?? '')),
        ];

        return 'CABA:'.sha1(implode('|', $partes));
    }

    /**
     * Chofer imputado a una infracción: el asignado al vehículo cuya asignación
     * estaba vigente en la fecha de la infracción (fecha_inicio <= fecha <=
     * fecha_fin, o sin cerrar). Mismo criterio que MultaController::store.
     *
     * @param  Collection<int,Asignacion>|null  $asignaciones
     */
    private function choferEnFecha(?Collection $asignaciones, ?CarbonInterface $fecha): ?int
    {
        if ($asignaciones === null || $fecha === null) {
            return null;
        }

        foreach ($asignaciones->sortByDesc('fecha_inicio') as $asig) {
            $inicio = $asig->fecha_inicio;
            $fin = $asig->fecha_fin;

            $empezoAntes = $inicio !== null && $inicio->startOfDay()->lessThanOrEqualTo($fecha);
            $noTerminoAntes = $fin === null || $fin->startOfDay()->greaterThanOrEqualTo($fecha);

            if ($empezoAntes && $noTerminoAntes) {
                return $asig->conductor_id;
            }
        }

        return null;
    }

    /** Nombre del municipio antes del " - NN%" (p. ej. "BSAS - 48%" => "BSAS"). */
    private function jurisdiccion(string $municipio): string
    {
        return strtoupper(trim(explode(' - ', $municipio)[0] ?? ''));
    }

    /** Fecha dd/mm/aaaa (a veces con espacios) => Carbon date, o null. */
    private function parseFecha(mixed $valor): ?CarbonInterface
    {
        $str = trim((string) ($valor ?? ''));

        if ($str === '') {
            return null;
        }

        try {
            return Carbon::createFromFormat('d/m/Y', $str)->startOfDay();
        } catch (\Exception) {
            return null;
        }
    }

    /** Monto como string ("341650", "71249.25") => float, o null si falta. */
    private function parseMonto(mixed $valor): ?float
    {
        $str = trim((string) ($valor ?? ''));

        if ($str === '' || ! is_numeric($str)) {
            return null;
        }

        return round((float) $str, 2);
    }
}
