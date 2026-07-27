<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Actions\CalcularResumenAction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Filtros del Resumen financiero. Compartido por la vista Inertia y las
 * exportaciones PDF/Excel para que los tres endpoints validen y normalicen
 * exactamente igual (misma Action, mismas cifras).
 */
class ResumenFiltrosRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('view-resumen');
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date', 'after_or_equal:desde'],
            'empresa_id' => ['nullable', 'integer', 'exists:empresas,id'],
            'inversion_id' => ['nullable', 'integer', 'exists:inversiones,id'],
            'vehiculo_ids' => ['nullable', 'array'],
            'vehiculo_ids.*' => ['integer', 'exists:vehiculos,id'],
            'tipo' => ['nullable', Rule::in(array_keys(CalcularResumenAction::TIPO_LABELS))],
            'incluir_abierto' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Filtros normalizados para la Action. Sin rango explícito, el mes en
     * curso.
     *
     * @return array{
     *     desde: string,
     *     hasta: string,
     *     empresa_id: ?int,
     *     inversion_id: ?int,
     *     vehiculo_ids: array<int, int>,
     *     tipo: ?string,
     *     incluir_abierto: bool,
     * }
     */
    public function filtros(): array
    {
        $validated = $this->validated();

        return [
            'desde' => $validated['desde'] ?? now()->startOfMonth()->toDateString(),
            'hasta' => $validated['hasta'] ?? now()->toDateString(),
            'empresa_id' => isset($validated['empresa_id']) ? (int) $validated['empresa_id'] : null,
            'inversion_id' => isset($validated['inversion_id']) ? (int) $validated['inversion_id'] : null,
            'vehiculo_ids' => array_map('intval', $validated['vehiculo_ids'] ?? []),
            'tipo' => $validated['tipo'] ?? null,
            'incluir_abierto' => (bool) ($validated['incluir_abierto'] ?? false),
        ];
    }
}
