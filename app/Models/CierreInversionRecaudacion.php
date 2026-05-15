<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CierreInversionRecaudacion extends Model
{
    protected $table = 'cierres_inversion_recaudaciones';

    protected $fillable = [
        'cierre_id',
        'inversion_id',
        'monto',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
        ];
    }

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreInversion::class, 'cierre_id');
    }

    public function inversion(): BelongsTo
    {
        return $this->belongsTo(Inversion::class);
    }
}
