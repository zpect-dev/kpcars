<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CierreRevision extends Model
{
    protected $table = 'cierres_revisiones';

    protected $fillable = [
        'user_id',
        'periodo_inicio',
        'periodo_fin',
    ];

    protected function casts(): array
    {
        return [
            'periodo_inicio' => 'date',
            'periodo_fin' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(CierreRevisionDetalle::class, 'cierre_revision_id');
    }
}
