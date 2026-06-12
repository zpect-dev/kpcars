<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

#[Fillable(['patente', 'marca', 'modelo', 'anio', 'propietario', 'precio', 'estado_patente', 'user_id', 'inversion_id', 'empresa_id', 'fecha_vencimiento_vtv', 'fecha_vencimiento_gnc', 'seguro_vencimiento', 'cedula_pdf_path', 'cedula_frente_path', 'cedula_dorso_path', 'titulo_pdf_path', 'titulo_frente_path', 'titulo_dorso_path', 'seguro_path'])]
#[Hidden(['cedula_pdf_path', 'cedula_frente_path', 'cedula_dorso_path', 'titulo_pdf_path', 'titulo_frente_path', 'titulo_dorso_path', 'seguro_path'])]
#[ScopedBy([TenantScope::class])]
class Vehiculo extends Model
{
    use HasFactory;
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'precio' => 'decimal:2',
            'fecha_vencimiento_vtv' => 'date',
            'fecha_vencimiento_gnc' => 'date',
            'seguro_vencimiento' => 'date',
        ];
    }

    /**
     * URLs de los documentos del vehículo. Cédula y título se exponen como PDF
     * o frente/dorso (sólo una modalidad por documento). El seguro es un único
     * archivo (con flag es_pdf para saber cómo previsualizarlo) más su fecha de
     * vencimiento.
     *
     * No se agrega a $appends global: se materializa con ->append('documentos')
     * donde se necesita (dashboard de vehículos).
     */
    public function documentos(): Attribute
    {
        $url = fn (?string $path): ?string => $path ? Storage::url($path) : null;

        return Attribute::get(fn (): array => [
            'cedula' => [
                'pdf'    => $url($this->cedula_pdf_path),
                'frente' => $url($this->cedula_frente_path),
                'dorso'  => $url($this->cedula_dorso_path),
            ],
            'titulo' => [
                'pdf'    => $url($this->titulo_pdf_path),
                'frente' => $url($this->titulo_frente_path),
                'dorso'  => $url($this->titulo_dorso_path),
            ],
            'seguro' => [
                'archivo' => $url($this->seguro_path),
                'es_pdf'  => $this->seguro_path !== null && str_ends_with(strtolower($this->seguro_path), '.pdf'),
            ],
        ]);
    }

    /**
     * Get the user that is assigned to the vehicle.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the inversion that owns the vehicle.
     */
    public function inversion(): BelongsTo
    {
        return $this->belongsTo(Inversion::class);
    }

    /**
     * Get the empresa that owns the vehicle.
     */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * Get the assignment history for the vehicle.
     */
    public function asignaciones(): HasMany
    {
        return $this->hasMany(Asignacion::class)->orderByDesc('fecha_inicio');
    }

    /**
     * Get the revision history for the vehicle.
     */
    public function revisiones(): HasMany
    {
        return $this->hasMany(Revision::class)->orderByDesc('created_at');
    }

    public function latestRevision(): HasOne
    {
        return $this->hasOne(Revision::class)->latestOfMany();
    }

    /**
     * Get the service history for the vehicle (most recent first).
     */
    public function services(): HasMany
    {
        return $this->hasMany(Service::class)->orderByDesc('fecha')->orderByDesc('id');
    }

    /**
     * Get the most recent service for the vehicle.
     */
    public function latestService(): HasOne
    {
        return $this->hasOne(Service::class)->ofMany([
            'fecha' => 'max',
            'id' => 'max',
        ]);
    }

    /**
     * Get the manual odometer readings for the vehicle (most recent first).
     */
    public function lecturasKilometraje(): HasMany
    {
        return $this->hasMany(KilometrajeLectura::class)->orderByDesc('fecha')->orderByDesc('id');
    }

    /**
     * Get the recaudaciones for the vehicle.
     */
    public function recaudaciones(): HasMany
    {
        return $this->hasMany(Recaudacion::class);
    }

    /**
     * Get the open (current period) recaudacion for the vehicle.
     */
    public function recaudacionAbierta(): HasOne
    {
        return $this->hasOne(Recaudacion::class)->whereNull('cierre_id');
    }
}
