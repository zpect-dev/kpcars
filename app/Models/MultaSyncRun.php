<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Bitácora de cada corrida de sincronización del feed de multas (manual o
 * programada). Deja rastro de qué trajo cada snapshot y, sobre todo, de los
 * fallos: si el feed cae varios días, las corridas fallidas quedan registradas
 * para detectarlo (la vista muestra la última).
 */
#[Fillable([
    'origen', 'ok', 'snapshot_fecha', 'procesadas', 'nuevas', 'resueltas',
    'reabiertas', 'duracion_ms', 'error',
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
    ];
}
