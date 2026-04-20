<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    protected $table = 'appointments';

    protected $fillable = [
        'service',
        'type',
        'license_plate',
        'applicant',
        'scheduled_date',
        'status',
        'completed_by',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'service' => 'string',
            'type' => 'string',
            'scheduled_date' => 'date',
            'status' => 'string',
            'completed_by' => 'integer',
        ];
    }

    /**
     * Scope: turnos normales activos (no completados) en una fecha dada.
     * Usado para validar el límite de cupos diarios.
     */
    public function scopeNormalOnDate(Builder $query, string $date): Builder
    {
        return $query->where('type', 'normal')
            ->whereDate('scheduled_date', $date)
            ->whereIn('status', ['agendado', 'en_proceso']);
    }

    public function completedBy()
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
