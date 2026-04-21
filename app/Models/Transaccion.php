<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaccion extends Model
{
    protected $table = 'transacciones';

    protected $fillable = [
        'articulo_id',
        'user_id',
        'vehiculo_id',
        'solicitante',
        'tipo',
        'cantidad',
        'descripcion',
        'inactiva',
    ];

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::addGlobalScope('activa', function (Builder $builder) {
            $builder->where('inactiva', false);
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
            'cantidad' => 'integer',
            'inactiva' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * Get the article associated with the transaction.
     */
    public function articulo(): BelongsTo
    {
        return $this->belongsTo(Articulo::class);
    }

    /**
     * Get the user who registered the transaction.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the vehicle destination for the transaction.
     */
    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    /**
     * Scope a query to filter transactions by vehicle description.
     */
    public function scopeSearchByVehicle(Builder $query, ?string $search): Builder
    {
        return $query->when($search, function (Builder $q, string $search) {
            $q->whereHas('vehiculo', function (Builder $q2) use ($search) {
                $q2->where('marca', 'like', "%{$search}%")
                   ->orWhere('modelo', 'like', "%{$search}%");
            });
        });
    }

    /**
     * Scope a query to filter transactions by vehicle license plate.
     */
    public function scopeSearchByPlate(Builder $query, ?string $plate): Builder
    {
        return $query->when($plate, function (Builder $q, string $plate) {
            $q->whereHas('vehiculo', function (Builder $q2) use ($plate) {
                $q2->where('patente', 'like', "%{$plate}%");
            });
        });
    }

    /**
     * Scope a query to filter transactions by applicant name.
     */
    public function scopeSearchByApplicant(Builder $query, ?string $name): Builder
    {
        return $query->when($name, function (Builder $q, string $name) {
            $q->where('solicitante', 'like', "%{$name}%");
        });
    }

    /**
     * Scope a query to filter transactions by item ID.
     */
    public function scopeFilterByItem(Builder $query, ?int $itemId): Builder
    {
        return $query->when($itemId, function (Builder $q, int $itemId) {
            $q->where('articulo_id', $itemId);
        });
    }

    /**
     * Scope a query to filter transactions by creation date.
     */
    /**
     * Scope a query to filter transactions by creation date range.
     */
    public function scopeFilterByDate(Builder $query, ?string $from, ?string $to = null): Builder
    {
        return $query->when($from, fn($q) => $q->whereDate('created_at', '>=', $from))
                     ->when($to, fn($q) => $q->whereDate('created_at', '<=', $to));
    }
}
