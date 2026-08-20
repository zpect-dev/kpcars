import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tono semántico del estado. Nunca se pide un color: se pide qué significa, y
 * el tono ya trae su equivalente en tema claro y oscuro.
 */
export type StatusTone =
    | 'success'
    | 'warning'
    | 'destructive'
    | 'info'
    | 'neutral';

const TONE_CLASSES: Record<
    StatusTone,
    { soft: string; solid: string; dot: string }
> = {
    success: {
        soft: 'bg-success-soft text-success-soft-foreground',
        solid: 'bg-success text-success-foreground',
        dot: 'bg-success',
    },
    warning: {
        soft: 'bg-warning-soft text-warning-soft-foreground',
        solid: 'bg-warning text-warning-foreground',
        dot: 'bg-warning',
    },
    destructive: {
        soft: 'bg-destructive-soft text-destructive-soft-foreground',
        solid: 'bg-destructive text-white dark:text-background',
        dot: 'bg-destructive',
    },
    info: {
        soft: 'bg-info-soft text-info-soft-foreground',
        solid: 'bg-info text-info-foreground',
        dot: 'bg-info',
    },
    neutral: {
        soft: 'bg-muted text-muted-foreground',
        solid: 'bg-muted-foreground text-background',
        dot: 'bg-muted-foreground/50',
    },
};

type Props = {
    tone: StatusTone;
    /**
     * `soft` es el fondo sutil de siempre. `solid` sube el peso visual y sirve
     * para el escalón más alto de una escala, cuando el tono solo no alcanza
     * para distinguirlo del anterior.
     */
    variant?: 'soft' | 'solid';
    children: ReactNode;
    /** Punto de color a la izquierda. El texto sigue siendo lo que informa. */
    dot?: boolean;
    icon?: LucideIcon;
    size?: 'sm' | 'md';
    className?: string;
};

/**
 * Etiqueta de estado. El significado viaja siempre en el texto: el color
 * acompaña, nunca es el único portador de la información.
 */
export function StatusBadge({
    tone,
    variant = 'soft',
    children,
    dot = false,
    icon: Icon,
    size = 'md',
    className,
}: Props) {
    const styles = TONE_CLASSES[tone];

    return (
        <span
            className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-md font-medium whitespace-nowrap',
                size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs',
                variant === 'solid' ? styles.solid : styles.soft,
                className,
            )}
        >
            {dot && (
                <span
                    aria-hidden="true"
                    className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        variant === 'solid'
                            ? 'bg-current opacity-70'
                            : styles.dot,
                    )}
                />
            )}
            {Icon && <Icon aria-hidden="true" className="size-3 shrink-0" />}
            {children}
        </span>
    );
}
