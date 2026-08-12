<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\AperturaCaja;
use App\Models\PeriodoCajaChica;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class AbrirCajaAction
{
    /**
     * Abre un nuevo período de caja para la empresa activa. El período cubre los
     * cobros de inventario y los gastos hasta que se ejecute el cierre unificado.
     *
     * @throws RuntimeException Si ya hay un período abierto en la empresa activa.
     */
    public function execute(User $user): AperturaCaja
    {
        // El TenantScope acota a la empresa activa: no puede haber dos aperturas
        // abiertas a la vez en la misma empresa.
        if (AperturaCaja::abierta()->exists()) {
            throw new RuntimeException('Ya hay un período de caja abierto.');
        }

        return DB::transaction(function () use ($user) {
            $apertura = AperturaCaja::create([
                'empresa_id' => session('active_company_id'),
                'user_id' => $user->id,
            ]);

            // La caja chica es una sola para todas las empresas: la abre la
            // primera apertura de la ronda y las siguientes la reusan.
            PeriodoCajaChica::actualOAbrir($user->id);

            return $apertura;
        });
    }
}
