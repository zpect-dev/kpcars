<?php

declare(strict_types=1);

namespace App\Enums;

enum UserRole: string
{
    case CHOFER = 'chofer';
    case MECANICO = 'mecanico';
    case ADMINISTRADOR = 'administrador';
    case ADMINISTRATIVO = 'administrativo';
    case INVERSOR = 'inversor';

    public function label(): string
    {
        return match ($this) {
            self::CHOFER => 'Chofer',
            self::MECANICO => 'Mecánico',
            self::ADMINISTRADOR => 'Administrador',
            self::ADMINISTRATIVO => 'Administrativo',
            self::INVERSOR => 'Inversor',
        };
    }

    public function pluralLabel(): string
    {
        return match ($this) {
            self::CHOFER => 'Choferes',
            self::MECANICO => 'Mecánicos',
            self::ADMINISTRADOR => 'Administradores',
            self::ADMINISTRATIVO => 'Administrativos',
            self::INVERSOR => 'Inversores',
        };
    }

    /**
     * Roles con acceso a la plataforma web (excluye CHOFER que solo usa la API móvil).
     *
     * @return array<int, self>
     */
    public static function webRoles(): array
    {
        return [
            self::ADMINISTRADOR,
            self::ADMINISTRATIVO,
            self::MECANICO,
            self::INVERSOR,
        ];
    }
}
