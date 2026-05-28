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

#[Fillable(['name', 'dni', 'password', 'inactivo', 'must_change_password', 'role', 'empresa_default_id', 'correo', 'telefono', 'fecha_vencimiento_licencia', 'profile_photo_path', 'deposito', 'deposito_moneda'])]
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
            'empresa_default_id' => 'integer',
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

    public function isAdministrativo(): bool
    {
        return $this->role === UserRole::ADMINISTRATIVO;
    }

    /**
     * Administrador o Administrativo: ambos pueden cambiar de empresa y comparten
     * varios privilegios de gestión (vehículos, inventario, turnos, revisiones, personal).
     */
    public function isAdminOrAdministrativo(): bool
    {
        return $this->isAdmin() || $this->isAdministrativo();
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
     * Vehículo actualmente asignado al chofer, según vehiculos.user_id —
     * la MISMA fuente de verdad que usa el dashboard de vehículos. Se usa en
     * Personal para que ambas vistas no diverjan (la tabla Asignacion puede
     * quedar desincronizada si se editó el conductor sin cerrar la asignación).
     */
    public function vehiculoAsignado(): HasOne
    {
        return $this->hasOne(Vehiculo::class, 'user_id');
    }

    /**
     * Empresas a las que el usuario pertenece (pivot empresa_user).
     *
     * Aplica principalmente a inversores: declaran a qué empresas participan.
     * Para admin/administrativo la pivot no se usa — ellos pueden ver todas
     * las empresas y switchear vía el Gate switch-empresa.
     */
    public function empresas(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Empresa::class, 'empresa_user')->withTimestamps();
    }

    /**
     * IDs de las empresas a las que el usuario pertenece, cacheado en memoria
     * para evitar repetir la query en el mismo request.
     *
     * @return array<int, int>
     */
    public function empresaIds(): array
    {
        return $this->relationLoaded('empresas')
            ? $this->empresas->pluck('id')->all()
            : $this->empresas()->pluck('empresas.id')->all();
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
