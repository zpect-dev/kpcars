import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    /** Muestra la flecha de volver a la izquierda del título. */
    onBack?: () => void;
    /**
     * Contador al lado del título. Pasar el singular y el plural evita el
     * "1 vehículos" y el "(s)".
     */
    count?: { value: number; singular: string; plural: string };
    description?: ReactNode;
    /** Botones de la derecha: exportar, crear, filtros globales. */
    actions?: ReactNode;
    /** Contenido extra pegado al título, como el resumen de alertas. */
    meta?: ReactNode;
    className?: string;
};

/**
 * Encabezado de vista. Reemplaza a los siete tratamientos distintos de h1 que
 * convivían en la aplicación.
 */
export function PageHeader({
    title,
    onBack,
    count,
    description,
    actions,
    meta,
    className,
}: Props) {
    return (
        <div
            className={cn(
                'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
                className,
            )}
        >
            <div className="flex min-w-0 items-center gap-3">
                {onBack && (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={onBack}
                        aria-label="Volver"
                    >
                        <ArrowLeft className="size-4" />
                    </Button>
                )}

                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                        {title}
                    </h1>

                    {count && (
                        <span className="inline-flex items-center rounded-md border border-border/50 bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                            {count.value}{' '}
                            {count.value === 1 ? count.singular : count.plural}
                        </span>
                    )}

                    {meta}
                </div>

                {description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
                </div>
            </div>

            {actions && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}
