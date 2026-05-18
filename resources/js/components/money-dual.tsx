import { cn } from '@/lib/utils';

export function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        currencyDisplay: 'code',
        minimumFractionDigits: 2,
    }).format(value);
}

export function formatUSD(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'code',
        minimumFractionDigits: 2,
    }).format(value);
}

interface Props {
    /** Monto en ARS */
    ars: number;
    /** Tasa de conversión (ARS por 1 USD). Si null/0, no se muestra USD. */
    tasa: number | null | undefined;
    /** Orientación del par: horizontal (default) o stacked (vertical) */
    orientation?: 'horizontal' | 'stacked';
    /** Tamaño base del monto ARS */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** Clases extra del contenedor */
    className?: string;
    /** Color del monto ARS (para overrides) */
    arsClassName?: string;
}

/**
 * Muestra un par ARS / USD. Si no hay tasa, sólo muestra ARS.
 */
export function MoneyDual({
    ars,
    tasa,
    orientation = 'horizontal',
    size = 'md',
    className,
    arsClassName,
}: Props) {
    const usd = tasa && tasa > 0 ? ars / tasa : null;

    const arsSize = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
        xl: 'text-2xl sm:text-3xl',
    }[size];

    const usdSize = {
        sm: 'text-[10px]',
        md: 'text-[11px]',
        lg: 'text-xs',
        xl: 'text-sm',
    }[size];

    if (orientation === 'stacked') {
        return (
            <div className={cn('flex flex-col leading-tight', className)}>
                <span className={cn('font-semibold', arsSize, arsClassName)}>
                    {formatARS(ars)}
                </span>
                {usd != null && (
                    <span className={cn('text-muted-foreground', usdSize)}>
                        {formatUSD(usd)}
                    </span>
                )}
            </div>
        );
    }

    return (
        <span className={cn('inline-flex items-baseline gap-1.5', className)}>
            <span className={cn('font-semibold', arsSize, arsClassName)}>
                {formatARS(ars)}
            </span>
            {usd != null && (
                <span className={cn('text-muted-foreground', usdSize)}>
                    {formatUSD(usd)}
                </span>
            )}
        </span>
    );
}
