import type { Column, RowData } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DataTableFeatures } from '@/components/app/data-table/features';
import { cn } from '@/lib/utils';

type Props<TData extends RowData, TValue> = {
    column: Column<DataTableFeatures, TData, TValue>;
    children: ReactNode;
    className?: string;
};

/**
 * Encabezado de columna ordenable. Si la columna no admite orden, devuelve el
 * texto pelado: no queremos un botón que no hace nada.
 */
export function DataTableColumnHeader<TData extends RowData, TValue>({
    column,
    children,
    className,
}: Props<TData, TValue>) {
    if (!column.getCanSort?.()) {
        return <span className={className}>{children}</span>;
    }

    const sorted = column.getIsSorted();
    const Icon =
        sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ChevronsUpDown;

    return (
        <button
            type="button"
            onClick={() => column.toggleSorting(sorted === 'asc')}
            aria-label={
                sorted === 'asc'
                    ? 'Ordenado de menor a mayor. Cambiar a mayor a menor.'
                    : sorted === 'desc'
                      ? 'Ordenado de mayor a menor. Quitar el orden.'
                      : 'Ordenar de menor a mayor'
            }
            className={cn(
                'group -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                sorted && 'text-foreground',
                className,
            )}
        >
            {children}
            <Icon
                aria-hidden="true"
                className={cn(
                    'size-3 shrink-0 transition-opacity',
                    sorted ? 'opacity-100' : 'opacity-40 group-hover:opacity-100',
                )}
            />
        </button>
    );
}
