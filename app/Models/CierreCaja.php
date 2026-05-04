<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CierreCaja extends Model
{
    protected $table = 'cierres_caja';

    protected $fillable = [
        'user_id',
    ];

    /**
     * Get the user who executed the closing.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the detail snapshots for this closing.
     */
    public function detalles(): HasMany
    {
        return $this->hasMany(CierreDetalle::class, 'cierre_id');
    }
}
