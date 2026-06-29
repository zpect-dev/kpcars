<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PrioridadReparacion;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Revisión mecánica de un vehículo: cada ítem del checklist recibe una gravedad
 * (1–5) y una descripción. El promedio de gravedad define la prioridad de
 * reparación (baja/media/alta). Es global (sin TenantScope): la flota se revisa
 * sin importar la empresa, igual que Revisiones.
 */
#[Fillable(['vehiculo_id', 'revisado_por', 'promedio', 'prioridad', 'items', 'observaciones'])]
class RevisionMecanica extends Model
{
    protected $table = 'revisiones_mecanicas';

    protected $casts = [
        'items' => 'array',
        'promedio' => 'decimal:2',
        'prioridad' => PrioridadReparacion::class,
    ];

    /**
     * Ítems del checklist mecánico (clave => etiqueta). Orden = orden de display.
     */
    public const ITEMS = [
        'tren_delantero' => 'Tren delantero',
        'tren_trasero' => 'Tren trasero',
        'frenos' => 'Frenos',
        'luces' => 'Luces',
        'motor_fluidos' => 'Motor / Fluidos',
        'suspension' => 'Suspensión',
        'neumaticos' => 'Neumáticos',
        'bateria' => 'Batería',
    ];

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function revisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revisado_por');
    }
}
