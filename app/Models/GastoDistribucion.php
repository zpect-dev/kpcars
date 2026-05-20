<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GastoDistribucion extends Model
{
    protected $table = 'gasto_distribuciones';

    protected $fillable = [
        'gasto_id',
        'user_id',
        'monto',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
        ];
    }

    public function gasto(): BelongsTo
    {
        return $this->belongsTo(Gasto::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
