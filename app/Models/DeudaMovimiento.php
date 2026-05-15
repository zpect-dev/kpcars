<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class DeudaMovimiento extends Model
{
    protected $table = 'deuda_movimientos';

    protected $fillable = [
        'inversion_id',
        'user_id',
        'tipo',
        'monto',
        'descripcion',
        'registrado_por',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
        ];
    }

    public function inversion(): BelongsTo
    {
        return $this->belongsTo(Inversion::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    protected static function booted(): void
    {
        // Después de crear un movimiento, si el saldo del inversor en esa inversión
        // llega a 0 o menos, se desmarca tiene_deuda automáticamente.
        static::created(function (DeudaMovimiento $mov) {
            $saldo = (float) static::query()
                ->where('inversion_id', $mov->inversion_id)
                ->where('user_id', $mov->user_id)
                ->selectRaw("SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE -monto END) as saldo")
                ->value('saldo');

            if ($saldo <= 0) {
                DB::table('inversion_user')
                    ->where('inversion_id', $mov->inversion_id)
                    ->where('user_id', $mov->user_id)
                    ->update(['tiene_deuda' => false, 'updated_at' => now()]);
            }
        });
    }
}
