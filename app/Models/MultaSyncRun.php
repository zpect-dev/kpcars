<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Bitácora de cada corrida de sincronización del feed de multas (manual o
 * programada). Deja rastro de qué trajo cada snapshot y, sobre todo, de los
 * fallos: si el feed cae varios días, las corridas fallidas quedan registradas
 * para detectarlo (la vista muestra la última).
 *
 * Cada corrida es además el reporte de ese movimiento: cuántas multas entraron y
 * por cuánta plata, cuántas se pagaron en el organismo y cómo quedó la deuda al
 * cierre. El detalle por acta se recupera por `sync_run_id` / `resuelta_run_id`.
 */
#[Fillable([
    'origen', 'ok', 'snapshot_fecha', 'procesadas', 'nuevas', 'resueltas',
    'reabiertas', 'duracion_ms', 'error', 'monto_nuevas', 'monto_resueltas',
    'deuda_vigente',
])]
class MultaSyncRun extends Model
{
    protected $table = 'multa_sync_runs';

    protected $casts = [
        'ok' => 'boolean',
        'snapshot_fecha' => 'date',
        'procesadas' => 'integer',
        'nuevas' => 'integer',
        'resueltas' => 'integer',
        'reabiertas' => 'integer',
        'duracion_ms' => 'integer',
        'monto_nuevas' => 'decimal:2',
        'monto_resueltas' => 'decimal:2',
        'deuda_vigente' => 'decimal:2',
    ];

    /** Actas que esta corrida dio de alta. */
    public function actasNuevas(): HasMany
    {
        return $this->hasMany(Acta::class, 'sync_run_id');
    }

    /** Actas que esta corrida marcó como pagadas en el organismo. */
    public function actasResueltas(): HasMany
    {
        return $this->hasMany(Acta::class, 'resuelta_run_id');
    }

    /** La corrida movió algo (o falló): tiene reporte que mostrar. */
    public function tieneReporte(): bool
    {
        return ! $this->ok || $this->nuevas > 0 || $this->resueltas > 0 || $this->reabiertas > 0;
    }
}
