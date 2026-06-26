<?php

declare(strict_types=1);

namespace App\Enums;

enum ChoferEventoTipo: string
{
    case ALTA = 'alta';
    case BAJA = 'baja';

    public function label(): string
    {
        return match ($this) {
            self::ALTA => 'Alta',
            self::BAJA => 'Baja',
        };
    }
}
