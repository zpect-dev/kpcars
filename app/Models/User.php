<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Enums\UserRole;

#[Fillable(['name', 'dni', 'password', 'inactivo', 'must_change_password', 'role', 'correo', 'telefono', 'fecha_vencimiento_licencia', 'profile_photo_path'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'inactivo' => 'boolean',
            'must_change_password' => 'boolean',
            'two_factor_confirmed_at' => 'datetime',
            'role' => UserRole::class,
            'fecha_vencimiento_licencia' => 'date',
        ];
    }

    public function profilePhotoUrl(): \Illuminate\Database\Eloquent\Casts\Attribute
    {
        return \Illuminate\Database\Eloquent\Casts\Attribute::get(function (): string {
            return $this->profile_photo_path
                    ? \Illuminate\Support\Facades\Storage::url($this->profile_photo_path)
                    : 'https://ui-avatars.com/api/?name='.urlencode($this->name).'&color=7F9CF5&background=EBF4FF';
        });
    }

    protected $appends = [
        'profile_photo_url',
    ];

    public function isAdmin(): bool
    {
        return $this->role === UserRole::ADMINISTRADOR;
    }

    public function isMechanic(): bool
    {
        return $this->role === UserRole::MECANICO;
    }

    public function isChofer(): bool
    {
        return $this->role === UserRole::CHOFER;
    }

    public function isInversor(): bool
    {
        return $this->role === UserRole::INVERSOR;
    }

    /**
     * Get all of the vehiculos for the User.
     */
    public function vehiculos(): HasMany
    {
        return $this->hasMany(Vehiculo::class);
    }

    /**
     * Get the current active vehicle assignment for the User (conductor).
     */
    public function asignacionActiva(): HasOne
    {
        return $this->hasOne(Asignacion::class, 'conductor_id')
            ->whereNull('fecha_fin')
            ->latestOfMany('fecha_inicio');
    }
}
