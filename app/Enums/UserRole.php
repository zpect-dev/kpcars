<?php

declare(strict_types=1);

namespace App\Enums;

enum UserRole: string
{
    case CHOFER = 'chofer';
    case MECANICO = 'mecanico';
    case ADMINISTRADOR = 'administrador';
    case INVERSOR = 'inversor';

    public function label(): string
    {
        return match($this) {
            self::CHOFER => 'Chofer',
            self::MECANICO => 'Mecánico',
            self::ADMINISTRADOR => 'Administrador',
            self::INVERSOR => 'Inversor',
        };
    }

    public function pluralLabel(): string
    {
        return match($this) {
            self::CHOFER => 'Choferes',
            self::MECANICO => 'Mecánicos',
            self::ADMINISTRADOR => 'Administradores',
            self::INVERSOR => 'Inversores',
        };
    }
}
