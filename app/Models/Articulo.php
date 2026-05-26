<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Articulo extends Model
{
    protected $table = 'articulos';

    protected $fillable = [
        'descripcion',
        'codigo',
        'repuestos',
        'stock',
        'min_stock',
        'precio',
        'imagen',
    ];

    protected $appends = ['imagen_url'];

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
            'precio' => 'decimal:2',
            'repuestos' => 'boolean',
        ];
    }

    /**
     * Public URL for the article's image (null when no image).
     */
    protected function imagenUrl(): Attribute
    {
        return Attribute::get(function (): ?string {
            if (! $this->imagen) {
                return null;
            }

            return Storage::disk('public')->url($this->imagen);
        });
    }

    /**
     * Get the transactions for the item.
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaccion::class);
    }
}
