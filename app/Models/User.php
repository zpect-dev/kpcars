<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\DepositoMoneda;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'dni', 'password', 'inactivo', 'must_change_password', 'role', 'absoluto', 'empresa_acceso', 'correo', 'telefono', 'fecha_vencimiento_licencia', 'profile_photo_path', 'empresa_id', 'deposito', 'deposito_moneda'])]
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
            'absoluto' => 'boolean',
            'empresa_acceso' => 'integer',
            'must_change_password' => 'boolean',
            'two_factor_confirmed_at' => 'datetime',
            'role' => UserRole::class,
            'fecha_vencimiento_licencia' => 'date',
            'deposito' => 'decimal:2',
            'deposito_moneda' => DepositoMoneda::class,
        ];
    }

    public function profilePhotoUrl(): Attribute
    {
        return Attribute::get(function (): string {
            return $this->profile_photo_path
                    ? Storage::url($this->profile_photo_path)
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

    public function isAdminAbsoluto(): bool
    {
        return $this->isAdmin() && (bool) $this->absoluto;
    }

    /**
     * ID de empresa al que el usuario está restringido a ver, o null si no hay restricción.
     *
     * - Inversor: su empresa_id.
     * - Admin con empresa_acceso = 1 o 2: ese id de empresa.
     * - Admin con empresa_acceso = 0 (ambas) o null: sin restricción.
     * - Resto de roles: sin restricción.
     */
    public function restrictedEmpresaId(): ?int
    {
        if ($this->isInversor()) {
            return $this->empresa_id ? (int) $this->empresa_id : null;
        }

        if ($this->isAdmin() && in_array((int) $this->empresa_acceso, [1, 2], true)) {
            return (int) $this->empresa_acceso;
        }

        return null;
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
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function asignacionActiva(): HasOne
    {
        return $this->hasOne(Asignacion::class, 'conductor_id')
            ->whereNull('fecha_fin')
            ->latestOfMany('fecha_inicio');
    }

    /**
     * Inversiones en las que el usuario participa como inversor.
     */
    public function inversiones(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Inversion::class, 'inversion_user')
            ->withPivot(['tiene_deuda', 'es_financiador'])
            ->withTimestamps();
    }

    /**
     * Movimientos de deuda del usuario.
     */
    public function deudaMovimientos(): HasMany
    {
        return $this->hasMany(DeudaMovimiento::class);
    }
}
