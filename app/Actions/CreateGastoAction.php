<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Gasto;
use App\Models\Inversion;
use App\Models\Scopes\TenantScope;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Support\Facades\DB;

class CreateGastoAction
{
    /**
     * Crea un gasto y calcula su distribución entre los inversores.
     *
     * @param  array{
     *     fecha: string,
     *     monto: float|string,
     *     user_id: int,
     *     recibio: string,
     *     metodo_pago: string,
     *     descripcion: ?string,
     *     tipo: string,
     *     vehiculo_id: ?int,
     * }  $data
     */
    public function execute(array $data): Gasto
    {
        return DB::transaction(function () use ($data) {
            $gasto = Gasto::create($data);

            // El reparto se congela en la propia fila del gasto (columnas JSON).
            // Así el histórico no cambia si luego varía el estado de los inversores
            // o la flota.
            $monto = (float) $gasto->monto;

            if (in_array($gasto->tipo, Gasto::TIPOS_GLOBALES, true)) {
                // Galpón / taller / oficina: reparto por empresa (según autos
                // alquilados) y, dentro de cada empresa, entre sus inversores.
                [$gasto->distribucion, $gasto->distribucion_empresas] = $this->distribuirGlobal($monto);
            } elseif (in_array($gasto->tipo, Gasto::TIPOS_INVERSOR_6, true)) {
                $gasto->distribucion = [Gasto::INVERSOR_6_ID => $monto];
            } elseif ($gasto->tipo === 'vehiculo' && $gasto->vehiculo_id) {
                $gasto->distribucion = $this->distribuirPorVehiculo($gasto->vehiculo_id, $monto);
            } else {
                $gasto->distribucion = [];
            }

            $gasto->save();

            return $gasto->load('vehiculo:id,patente,marca,modelo');
        });
    }

    /**
     * Gastos de galpón / taller / oficina: se reparten entre las empresas en
     * proporción a sus autos alquilados (vehículos con chofer asignado), y la
     * parte de cada empresa se divide en partes iguales entre los inversores de
     * esa empresa.
     *
     * El reparto por empresa refleja siempre los autos alquilados (todas las
     * empresas con autos participan). La parte de cada empresa se imputa a sus
     * inversores; si una empresa no tiene inversores, su parte aparece igual en
     * el reparto por empresa pero queda SIN IMPUTAR a nivel inversor (por eso la
     * suma de la distribución por inversor puede ser menor al total).
     *
     * Si no hay ningún auto alquilado en ninguna empresa, cae al reparto
     * equitativo entre todos los inversores activos.
     *
     * @return array{0: array<int, float>, 1: array<int, float>}
     *         [ user_id => monto , empresa_id => monto ]
     */
    protected function distribuirGlobal(float $monto): array
    {
        // Autos alquilados por empresa: con chofer asignado, sin el ficticio EXTERNO.
        $autosPorEmpresa = DB::table('vehiculos')
            ->whereNotNull('user_id')
            ->whereNotNull('empresa_id')
            ->where('patente', '!=', 'EXTERNO')
            ->selectRaw('empresa_id, COUNT(*) as total')
            ->groupBy('empresa_id')
            ->pluck('total', 'empresa_id');

        // Inversores activos de cada empresa (vía las inversiones de la empresa).
        $inversoresPorEmpresa = DB::table('inversion_user')
            ->join('users', 'users.id', '=', 'inversion_user.user_id')
            ->join('inversiones', 'inversiones.id', '=', 'inversion_user.inversion_id')
            ->where('users.inactivo', false)
            ->where('users.role', 'inversor')
            ->select('inversiones.empresa_id', 'inversion_user.user_id')
            ->distinct()
            ->get()
            ->groupBy('empresa_id')
            ->map(fn ($filas) => $filas->pluck('user_id')->map(fn ($id) => (int) $id)->unique()->values()->all());

        // Todas las empresas con autos alquilados participan en el reparto por
        // empresa (tengan o no inversores).
        $elegibles = [];
        $totalAutos = 0;
        foreach ($autosPorEmpresa as $empresaId => $cantidad) {
            if ($cantidad > 0) {
                $elegibles[] = [
                    'empresa_id' => (int) $empresaId,
                    'autos' => (int) $cantidad,
                    'inversores' => $inversoresPorEmpresa[$empresaId] ?? [],
                ];
                $totalAutos += (int) $cantidad;
            }
        }

        // Sin autos alquilados: reparto equitativo entre todos los inversores activos.
        if ($totalAutos === 0) {
            $userIds = DB::table('inversion_user')
                ->join('users', 'users.id', '=', 'inversion_user.user_id')
                ->where('users.inactivo', false)
                ->where('users.role', 'inversor')
                ->distinct()
                ->pluck('inversion_user.user_id')
                ->all();

            return [$this->splitEquitativo($userIds, $monto), []];
        }

        // Redondeo en dos niveles para que todo cuadre exacto:
        //  1) cada empresa recibe monto * autos / totalAutos (la última, el remanente);
        //  2) la parte de cada empresa se divide en partes iguales entre sus inversores.
        $porEmpresa = [];
        $porInversor = [];
        $acumulado = 0.0;
        $n = count($elegibles);

        foreach ($elegibles as $idx => $empresa) {
            if ($idx === $n - 1) {
                $parteEmpresa = round($monto - $acumulado, 2);
            } else {
                $parteEmpresa = round($monto * $empresa['autos'] / $totalAutos, 2);
                $acumulado += $parteEmpresa;
            }

            $porEmpresa[$empresa['empresa_id']] = $parteEmpresa;

            // Imputación a inversores solo si la empresa tiene; si no, su parte
            // queda sin imputar (figura en el reparto por empresa, no en el de
            // inversores).
            if ($empresa['inversores'] !== []) {
                foreach ($this->splitEquitativo($empresa['inversores'], $parteEmpresa) as $userId => $parte) {
                    $porInversor[$userId] = ($porInversor[$userId] ?? 0.0) + $parte;
                }
            }
        }

        return [$porInversor, $porEmpresa];
    }

    /**
     * Reparte entre los inversores de la inversión del vehículo que están
     * pagando actualmente (no deudor en la inversión actual,
     * o deudor actual y no deudor en la previa por orden natural).
     *
     * @return array<int, float>
     */
    protected function distribuirPorVehiculo(int $vehiculoId, float $monto): array
    {
        // El combobox de gastos es global: el vehículo puede pertenecer a una
        // empresa distinta de la activa, así que ignoramos el TenantScope para
        // resolver el vehículo y sus inversiones.
        $vehiculo = Vehiculo::withoutGlobalScope(TenantScope::class)->find($vehiculoId);
        if (! $vehiculo || ! $vehiculo->inversion_id) {
            return [];
        }

        $inversionActual = Inversion::withoutGlobalScope(TenantScope::class)
            ->with('inversores')
            ->find($vehiculo->inversion_id);
        if (! $inversionActual) {
            return [];
        }

        // Inversión previa por orden natural dentro de la misma empresa.
        $inversionPrevia = Inversion::withoutGlobalScope(TenantScope::class)
            ->with('inversores')
            ->where('empresa_id', $inversionActual->empresa_id)
            ->where('id', '!=', $inversionActual->id)
            ->get()
            ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
            ->filter(fn ($i) => strnatcasecmp($i->nombre, $inversionActual->nombre) < 0)
            ->last();

        $deudaPrevia = [];
        if ($inversionPrevia) {
            foreach ($inversionPrevia->inversores as $inv) {
                $deudaPrevia[$inv->id] = (bool) $inv->pivot->tiene_deuda;
            }
        }

        $elegibles = [];
        foreach ($inversionActual->inversores as $inv) {
            $tieneDeudaActual = (bool) $inv->pivot->tiene_deuda;

            if (! $tieneDeudaActual) {
                // No-deudor actual: ya pagó esta inversión → incluido.
                $elegibles[] = $inv->id;
                continue;
            }

            // Deudor actual: incluido sólo si en la previa no era deudor
            // (= está pagando esta inversión actualmente).
            // Si no hay previa, todos los deudores se consideran pagando.
            if (! $inversionPrevia || ($deudaPrevia[$inv->id] ?? false) === false) {
                $elegibles[] = $inv->id;
            }
        }

        return $this->splitEquitativo($elegibles, $monto);
    }

    /**
     * Divide el monto en partes iguales, ajustando centavos al último elemento.
     *
     * @param  array<int, int>  $userIds
     * @return array<int, float>
     */
    protected function splitEquitativo(array $userIds, float $monto): array
    {
        $userIds = array_values(array_unique($userIds));
        $count = count($userIds);

        if ($count === 0) {
            return [];
        }

        $parte = round($monto / $count, 2);
        $result = [];
        $acumulado = 0.0;

        foreach ($userIds as $idx => $userId) {
            if ($idx === $count - 1) {
                // Último recibe el remanente para evitar pérdida por redondeo.
                $result[$userId] = round($monto - $acumulado, 2);
            } else {
                $result[$userId] = $parte;
                $acumulado += $parte;
            }
        }

        return $result;
    }
}
