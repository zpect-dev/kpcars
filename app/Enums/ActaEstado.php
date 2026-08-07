<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Estado de una infracción del feed externo (tabla `actas`).
 *
 *  - Vigente:  sigue apareciendo en el último snapshot del feed.
 *  - Resuelta: dejó de aparecer estando su patente presente => pagada en origen.
 */
enum ActaEstado: string
{
    case Vigente = 'vigente';
    case Resuelta = 'resuelta';

    public function label(): string
    {
        return match ($this) {
            self::Vigente => 'Vigente',
            self::Resuelta => 'Pagada',
        };
    }
}
