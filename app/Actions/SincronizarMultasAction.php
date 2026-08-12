<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\ActaEstado;
use App\Models\Acta;
use App\Models\Asignacion;
use App\Models\MultaSyncRun;
use App\Models\Scopes\TenantScope;
use App\Models\Vehiculo;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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
     * Toma un lock para que dos corridas (manual + programada, o dos clicks) no
     * se pisen, deja registro en `multa_sync_runs` del resultado o del error, y
     * relanza la excepción para que el llamador la muestre.
     *
     * La fila de la corrida se crea ANTES de procesar (en estado no-ok) porque
     * cada acta guarda de qué corrida vino: recién con el id a mano se puede
     * sellar el alta. Al terminar se completa con los totales del reporte.
     *
     * @return array{procesadas:int,nuevas:int,resueltas:int,reabiertas:int,monto_nuevas:float,monto_resueltas:float,deuda_vigente:float,snapshot:?string,locked:bool,run_id:?int}
     */
    public function fetch(?string $url = null, string $origen = 'manual'): array
    {
        $url ??= (string) config('services.resolvetusmultas.feed_url');

        $lock = Cache::lock('multas:sincronizar', 120);

        if (! $lock->get()) {
            return [
                'procesadas' => 0, 'nuevas' => 0, 'resueltas' => 0, 'reabiertas' => 0,
                'monto_nuevas' => 0.0, 'monto_resueltas' => 0.0, 'deuda_vigente' => 0.0,
                'snapshot' => null, 'locked' => true, 'run_id' => null,
            ];
        }

        $inicio = hrtime(true);

        $run = MultaSyncRun::create(['origen' => $origen, 'ok' => false]);

        try {
            $request = Http::timeout(30)->retry(2, 500);

            if (! (bool) config('services.resolvetusmultas.verify', true)) {
                $request = $request->withoutVerifying();
            }

            $response = $request->get($url);
            $response->throw();

            $r = $this->execute((array) $response->json(), $run->id);

            $run->update([
                'ok' => true,
                'snapshot_fecha' => $r['snapshot'],
                'procesadas' => $r['procesadas'],
                'nuevas' => $r['nuevas'],
                'resueltas' => $r['resueltas'],
                'reabiertas' => $r['reabiertas'],
                'monto_nuevas' => $r['monto_nuevas'],
                'monto_resueltas' => $r['monto_resueltas'],
                'deuda_vigente' => $r['deuda_vigente'],
                'duracion_ms' => $this->transcurridoMs($inicio),
            ]);

            return $r + ['locked' => false, 'run_id' => $run->id];
        } catch (\Throwable $e) {
            $run->update([
                'ok' => false,
                'duracion_ms' => $this->transcurridoMs($inicio),
                'error' => mb_substr($e->getMessage(), 0, 1000),
            ]);

            Log::error('Sincronización de multas falló', ['origen' => $origen, 'error' => $e->getMessage()]);

            throw $e;
        } finally {
            $lock->release();
        }
    }

    /** Milisegundos transcurridos desde un instante de hrtime(true). */
    private function transcurridoMs(float $inicio): int
    {
        return (int) round((hrtime(true) - $inicio) / 1_000_000);
    }

    /**
     * Procesa el array de snapshots ya decodificado (separado de fetch() para
     * poder testear sin red).
     *
     * @param  array<int,array<string,mixed>>  $snapshots
     * @param  int|null  $runId  Corrida a la que se imputan las altas y las resoluciones.
     * @return array{procesadas:int,nuevas:int,resueltas:int,reabiertas:int,monto_nuevas:float,monto_resueltas:float,deuda_vigente:float,snapshot:?string}
     */
    public function execute(array $snapshots, ?int $runId = null): array
    {
        $snapshot = $this->snapshotMasReciente($snapshots);

        if ($snapshot === null) {
            return [
                'procesadas' => 0, 'nuevas' => 0, 'resueltas' => 0, 'reabiertas' => 0,
                'monto_nuevas' => 0.0, 'monto_resueltas' => 0.0,
                'deuda_vigente' => $this->deudaVigente(), 'snapshot' => null,
            ];
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

        // Patentes que vinieron en este snapshot (primer pase liviano: solo las
        // patentes, para poder precargar sus actas de una sola query).
        $patentesPresentes = [];

        foreach ($snapshot['busquedas'] ?? [] as $busqueda) {
            $patente = strtoupper(trim((string) ($busqueda['busqueda'] ?? '')));

            if ($patente !== '') {
                $patentesPresentes[$patente] = true;
            }
        }

        // Precarga de las actas ya existentes de esas patentes, indexadas por
        // clave. Evita un SELECT por infracción (el viejo firstOrNew): ahora es
        // una sola query y el match se resuelve en memoria.
        $existentes = Acta::query()
            ->whereIn('patente', array_keys($patentesPresentes))
            ->get()
            ->keyBy('clave');

        // Todo en una transacción: ingesta + marcado de resueltas. Si algo falla,
        // no queda a medias (nuevas commiteadas sin resolver las que se pagaron).
        return DB::transaction(function () use (
            $snapshot, $snapFecha, $vehiculos, $asignaciones, $patentesPresentes, $existentes, $runId,
        ) {
            $clavesVistas = [];   // claves de infracción vistas en este snapshot
            $nuevas = 0;
            $reabiertas = 0;
            $procesadas = 0;
            $montoNuevas = 0.0;   // plata que suman las altas de esta corrida

            foreach ($snapshot['busquedas'] ?? [] as $busqueda) {
                $patente = strtoupper(trim((string) ($busqueda['busqueda'] ?? '')));

                if ($patente === '') {
                    continue;
                }

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

                        $acta = $existentes->get($clave) ?? new Acta(['clave' => $clave]);
                        $eraResuelta = $acta->exists && $acta->estado === ActaEstado::Resuelta;
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
                            'estado' => ActaEstado::Vigente->value,
                            'resuelta_en' => null,
                            // Se reabre: deja de pertenecer al reporte que la dio
                            // por pagada.
                            'resuelta_run_id' => null,
                            'vista_ultima_en' => $snapFecha,
                            'snapshot_fecha' => $snapFecha,
                            'raw' => $item,
                        ]);

                        if ($esNueva) {
                            $acta->vista_primera_en = $snapFecha;
                            // Corrida del alta: no cambia si después se reabre.
                            $acta->sync_run_id = $runId;
                            $nuevas++;
                            $montoNuevas += (float) ($acta->monto ?? 0);
                        } elseif ($eraResuelta) {
                            // La infracción había desaparecido y volvió: se reabre.
                            $reabiertas++;
                        }

                        $acta->save();

                        // Refleja el alta en el mapa para que una clave repetida
                        // dentro del mismo snapshot no se cuente como nueva otra vez.
                        $existentes->put($clave, $acta);
                    }
                }
            }

            // Marcar resueltas: actas vigentes cuya patente SÍ vino en el snapshot
            // pero cuya clave NO apareció. Si la patente no vino (búsqueda caída),
            // sus actas quedan intactas para no dar falsos pagos.
            $resueltas = 0;
            $montoResueltas = 0.0;

            if ($patentesPresentes !== []) {
                $porResolver = fn () => Acta::query()
                    ->where('estado', ActaEstado::Vigente->value)
                    ->whereIn('patente', array_keys($patentesPresentes))
                    ->when($clavesVistas !== [], fn ($q) => $q->whereNotIn('clave', array_keys($clavesVistas)));

                // El monto se suma ANTES del update: después ya no se distinguen
                // de las resueltas de corridas anteriores.
                $montoResueltas = (float) $porResolver()->sum('monto');

                $resueltas = $porResolver()->update([
                    'estado' => ActaEstado::Resuelta->value,
                    'resuelta_en' => $snapFecha,
                    'resuelta_run_id' => $runId,
                ]);
            }

            return [
                'procesadas' => $procesadas,
                'nuevas' => $nuevas,
                'resueltas' => $resueltas,
                'reabiertas' => $reabiertas,
                'monto_nuevas' => round($montoNuevas, 2),
                'monto_resueltas' => round($montoResueltas, 2),
                'deuda_vigente' => $this->deudaVigente(),
                'snapshot' => $snapFecha->toDateString(),
            ];
        });
    }

    /** Deuda total de las actas vigentes (mismo total que muestra la vista). */
    private function deudaVigente(): float
    {
        return round((float) Acta::query()->where('estado', ActaEstado::Vigente->value)->sum('monto'), 2);
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
     * fabrica un hash estable con patente + fecha + motivo.
     *
     * El monto queda FUERA del hash a propósito: CABA actualiza el importe
     * (intereses) sobre la misma infracción, y si el monto entrara al hash, un
     * cambio de importe rompería la identidad — la infracción se marcaría
     * "pagada" y reaparecería como "nueva". Con patente+fecha+motivo la
     * identidad es estable frente a esos reajustes.
     *
     * @param  array<string,mixed>  $item
     */
    private function clave(string $jurisdiccion, string $patente, array $item): ?string
    {
        if ($jurisdiccion === 'BSAS') {
            $acta = trim((string) ($item['acta'] ?? ''));

            return $acta === '' ? null : 'BSAS:'.$acta;
        }

        // CABA: sin acta. Hash de los campos estables que identifican la infracción.
        $partes = [
            $patente,
            trim((string) ($item['fechaInfraccion'] ?? '')),
            trim((string) ($item['motivo'] ?? '')),
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
