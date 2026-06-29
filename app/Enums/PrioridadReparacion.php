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
     * Determina la prioridad de reparación a partir del ítem más grave
     * (escala 1–5): 1–2 Baja, 3 Media, 4–5 Alta.
     */
    public static function fromMaximo(int $maximo): self
    {
        return match (true) {
            $maximo <= 2 => self::BAJA,
            $maximo === 3 => self::MEDIA,
            default => self::ALTA,
        };
    }
}
