<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConteoLinea extends Model
{
    /** Categorías de motivo de un ajuste de conteo. */
    public const MOTIVOS = [
        'perdida_no_explicada',
        'rotura',
        'error_carga',
        'devolucion',
        'otro',
    ];

    /** Etiquetas legibles de cada motivo (compartidas con el historial y PDF). */
    public const MOTIVO_LABELS = [
        'perdida_no_explicada' => 'Pérdida no explicada',
        'rotura' => 'Rotura',
        'error_carga' => 'Error de carga',
        'devolucion' => 'Devolución',
        'otro' => 'Otro',
    ];

    protected $table = 'conteo_lineas';

    protected $fillable = [
        'conteo_id',
        'articulo_id',
        'stock_esperado',
        'stock_fisico',
        'diferencia',
        'motivo',
        'nota',
        'transaccion_id',
    ];

    protected function casts(): array
    {
        return [
            'stock_esperado' => 'integer',
            'stock_fisico' => 'integer',
            'diferencia' => 'integer',
        ];
    }

    public function conteo(): BelongsTo
    {
        return $this->belongsTo(Conteo::class);
    }

    public function articulo(): BelongsTo
    {
        return $this->belongsTo(Articulo::class);
    }

    public function transaccion(): BelongsTo
    {
        return $this->belongsTo(Transaccion::class);
    }
}
