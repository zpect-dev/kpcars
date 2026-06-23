<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Articulo extends Model
{
    /**
     * Markup de venta aplicado sobre el costo: precio = costo * 1.45.
     */
    public const MARKUP = 1.45;

    protected $table = 'articulos';

    protected $fillable = [
        'descripcion',
        'codigo',
        'repuestos',
        'stock',
        'min_stock',
        'costo',
        'precio',
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
            'costo' => 'decimal:2',
            'precio' => 'decimal:2',
            'repuestos' => 'boolean',
        ];
    }

    /**
     * Precio de venta calculado a partir de un costo aplicando el markup.
     */
    public static function precioDesdeCosto(float $costo): float
    {
        return round($costo * self::MARKUP, 2);
    }

    /**
     * Get the transactions for the item.
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaccion::class);
    }
}
