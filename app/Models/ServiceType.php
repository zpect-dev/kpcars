<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceType extends Model
{
    protected $table = 'service_types';

    protected $fillable = [
        'name',
        'description',
        'required_slots',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'required_slots' => 'integer',
        ];
    }

    /**
     * Get the appointments scheduled for this service type.
     */
    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }
}
