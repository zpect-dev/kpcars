<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CierreRevisionDetalle extends Model
{
    protected $table = 'cierres_revisiones_detalles';

    protected $fillable = [
        'cierre_revision_id',
        'vehiculo_id',
        'revision_id',
        'estado',
    ];

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(CierreRevision::class, 'cierre_revision_id');
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function revision(): BelongsTo
    {
        return $this->belongsTo(Revision::class);
    }
}
