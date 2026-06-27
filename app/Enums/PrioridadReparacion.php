<?php

declare(strict_types=1);

namespace App\Enums;

enum PrioridadReparacion: string
{
    case BAJA = 'baja';
    case MEDIA = 'media';
    case ALTA = 'alta';

    public function label(): string
    {
        return match ($this) {
            self::BAJA => 'Baja',
            self::MEDIA => 'Media',
            self::ALTA => 'Alta',
        };
    }

    /**
     * Peso para ordenar (alta primero).
     */
    public function peso(): int
    {
        return match ($this) {
            self::ALTA => 3,
            self::MEDIA => 2,
            self::BAJA => 1,
        };
    }

    /**
     * Determina la prioridad de reparación a partir del promedio de gravedad
     * (escala 1–5): <2 Baja, 2–3.5 Media, >3.5 Alta.
     */
    public static function fromPromedio(float $promedio): self
    {
        return match (true) {
            $promedio < 2.0 => self::BAJA,
            $promedio <= 3.5 => self::MEDIA,
            default => self::ALTA,
        };
    }
}
