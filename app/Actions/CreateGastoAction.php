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

            // El reparto entre inversores se congela en la propia fila del gasto
            // (columna JSON). Así el histórico no cambia si luego varía el estado
            // de deuda de los inversores.
            $gasto->distribucion = $this->calcularDistribuciones($gasto);
            $gasto->save();

            return $gasto->load('vehiculo:id,patente,marca,modelo');
        });
    }

    /**
     * @return array<int, float> user_id => monto
     */
    protected function calcularDistribuciones(Gasto $gasto): array
    {
        $monto = (float) $gasto->monto;

        if (in_array($gasto->tipo, Gasto::TIPOS_GLOBALES, true)) {
            return $this->distribuirGlobal($monto);
        }

        if (in_array($gasto->tipo, Gasto::TIPOS_INVERSOR_6, true)) {
            return [Gasto::INVERSOR_6_ID => $monto];
        }

        if ($gasto->tipo === 'vehiculo' && $gasto->vehiculo_id) {
            return $this->distribuirPorVehiculo($gasto->vehiculo_id, $monto);
        }

        return [];
    }

    /**
     * Reparte entre todos los inversores que participan en al menos una inversión.
     *
     * @return array<int, float>
     */
    protected function distribuirGlobal(float $monto): array
    {
        $userIds = DB::table('inversion_user')
            ->join('users', 'users.id', '=', 'inversion_user.user_id')
            ->where('users.inactivo', false)
            ->where('users.role', 'inversor')
            ->distinct()
            ->pluck('inversion_user.user_id')
            ->all();

        return $this->splitEquitativo($userIds, $monto);
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
