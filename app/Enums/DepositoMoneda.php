<?php

declare(strict_types=1);

namespace App\Enums;

enum DepositoMoneda: string
{
    case USD = 'USD';
    case ARS = 'ARS';

    public function label(): string
    {
        return match ($this) {
            self::USD => 'Dólares (USD)',
            self::ARS => 'Pesos (ARS)',
        };
    }

    public function symbol(): string
    {
        return match ($this) {
            self::USD => 'US$',
            self::ARS => '$',
        };
    }
}
