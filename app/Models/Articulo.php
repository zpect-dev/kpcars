<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Articulo extends Model
{
    protected $table = 'articulos';

    protected $fillable = [
        'descripcion',
        'stock',
        'min_stock',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stock' => 'integer',
            'min_stock' => 'integer',
        ];
    }

    /**
     * Get the transactions for the item.
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaccion::class);
    }
}
