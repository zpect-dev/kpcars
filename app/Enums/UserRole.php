<?php

declare(strict_types=1);

namespace App\Enums;

enum UserRole: string
{
    case CHOFER = 'chofer';
    case MECANICO = 'mecanico';
    case ADMINISTRADOR = 'administrador';

    public function label(): string
    {
        return match($this) {
            self::CHOFER => 'Chofer',
            self::MECANICO => 'Mecánico',
            self::ADMINISTRADOR => 'Administrador',
        };
    }
}
