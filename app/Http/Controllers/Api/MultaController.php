<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Multa;
use App\Models\Scopes\TenantScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MultaController extends Controller
{
    /**
     * Multas imputadas al chofer autenticado, de la más reciente a la más antigua.
     *
     * El chofer ve el importe (base y saldo adeudado con el descuento CABA si
     * corresponde) y el PDF de la infracción. Eager loading del vehículo para
     * evitar N+1; la Multa es global, así que se ignora el TenantScope del vehículo.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $multas = Multa::query()
            ->where('conductor_id', $user->id)
            ->with([
                'vehiculo' => fn ($q) => $q->withoutGlobalScope(TenantScope::class)->select('id', 'patente', 'marca', 'modelo'),
            ])
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->get();

        $data = $multas->map(fn (Multa $m) => [
            'id' => $m->id,
            'fecha' => $m->fecha?->toDateString(),
            'fecha_vencimiento' => $m->fecha_vencimiento?->toDateString(),
            'descripcion' => $m->descripcion,
            'jurisdiccion' => $m->jurisdiccion,
            'punto_rojo' => $m->punto_rojo,
            'patente' => $m->vehiculo?->patente,
            'monto' => (float) $m->monto,
            'monto_adeudado' => $m->montoAdeudado(),
            'cobrado' => $m->cobrado,
            'pdf_url' => $m->pdf_path ? Storage::disk('public')->url($m->pdf_path) : null,
        ]);

        return response()->json([
            'multas' => $data,
            'total_adeudado' => round($data->sum('monto_adeudado'), 2),
        ]);
    }
}
