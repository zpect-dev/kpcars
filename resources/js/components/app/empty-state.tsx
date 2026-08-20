import type { LucideIcon } from 'lucide-react';
import { FilterX, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
    /**
     * "empty" es que todavía no hay datos cargados; "filtered" es que los
     * filtros no encontraron nada. Son problemas distintos y la salida también:
     * uno se resuelve creando, el otro limpiando.
     */
    variant?: 'empty' | 'filtered';
    icon?: LucideIcon;
    title: string;
    description?: ReactNode;
    /** Acción sugerida: crear el primer registro, o limpiar los filtros. */
    action?: { label: string; onClick: () => void };
    className?: string;
};

export function EmptyState({
    variant = 'empty',
    icon,
    title,
    description,
    action,
    className,
}: Props) {
    const Icon = icon ?? (variant === 'filtered' ? FilterX : Inbox);

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
                className,
            )}
        >
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon aria-hidden="true" className="size-5" />
            </span>

            <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">{title}</p>
                {description && (
                    <p className="max-w-sm text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>

            {action && (
                <Button
                    type="button"
                    variant={variant === 'filtered' ? 'outline' : 'default'}
                    size="sm"
                    onClick={action.onClick}
                >
                    {action.label}
                </Button>
            )}
        </div>
    );
}

/**
 * El mismo estado vacío pero ocupando toda la fila de una tabla, que es donde
 * más se usa.
 */
export function EmptyStateRow({
    colSpan,
    ...props
}: Props & { colSpan: number }) {
    return (
        <tr>
            <td colSpan={colSpan} className="p-0">
                <EmptyState {...props} />
            </td>
        </tr>
    );
}
