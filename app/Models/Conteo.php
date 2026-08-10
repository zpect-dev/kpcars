<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conteo extends Model
{
    /** Zonas de inventario que se pueden contar (conteo cíclico). */
    public const ZONAS = ['repuestos', 'galpon'];

    protected $table = 'conteos';

    protected $fillable = [
        'user_id',
        'zona',
        'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * Líneas del conteo (una por artículo contado).
     */
    public function lineas(): HasMany
    {
        return $this->hasMany(ConteoLinea::class);
    }

    /**
     * Usuario que realizó el conteo.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
