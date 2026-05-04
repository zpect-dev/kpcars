<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CierreDetalle extends Model
{
    protected $table = 'cierre_detalles';

    protected $fillable = [
        'cierre_id',
        'inversion_id',
        'empresa_id',
        'total',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
        ];
    }

    /**
     * Get the cierre this detail belongs to.
     */
    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreCaja::class, 'cierre_id');
    }

    /**
     * Get the inversion this detail belongs to.
     */
    public function inversion(): BelongsTo
    {
        return $this->belongsTo(Inversion::class);
    }

    /**
     * Get the empresa this detail belongs to.
     */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }
}
