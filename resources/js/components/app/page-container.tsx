import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    children: ReactNode;
    className?: string;
};

/**
 * Envoltorio de una vista completa. Fija el padding y el espaciado exterior en
 * un solo lugar: antes cada página lo repetía y no todas coincidían, así que el
 * margen saltaba al cambiar de sección.
 */
export function PageContainer({ children, className }: Props) {
    return (
        <div className={cn('flex h-full flex-1 flex-col gap-4 p-4', className)}>
            {children}
        </div>
    );
}
