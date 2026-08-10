<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\GeneradorCodigoArticulo;
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
     * Todo artículo nace con un código corto y único: si no se especificó uno,
     * se autogenera (familia + correlativo). Así ningún alta puede quedar sin
     * código, venga del panel, de un seeder o de un comando.
     */
    protected static function booted(): void
    {
        static::creating(function (Articulo $articulo) {
            $codigo = strtoupper(trim((string) $articulo->codigo));

            $articulo->codigo = $codigo !== ''
                ? $codigo
                : self::generarCodigo((string) $articulo->descripcion);
        });
    }

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
     * Código corto y único para un artículo nuevo: familia + correlativo
     * (AMO-01, FIL-03). Debe llamarse dentro de una transacción con lock para
     * que dos altas simultáneas no reciban el mismo.
     */
    public static function generarCodigo(string $descripcion): string
    {
        return GeneradorCodigoArticulo::corto(
            $descripcion,
            fn (string $codigo) => self::where('codigo', $codigo)->exists(),
        );
    }

    /**
     * Get the transactions for the item.
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaccion::class);
    }
}
