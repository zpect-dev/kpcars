import type { RowData } from '@tanstack/react-table';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';
import type { DataTableFeatures } from '@/components/app/data-table/features';
import { Button } from '@/components/ui/button';

type AnyTable = {
    getState?: () => unknown;
    getPageCount: () => number;
    getCanPreviousPage: () => boolean;
    getCanNextPage: () => boolean;
    setPageIndex: (index: number) => void;
    previousPage: () => void;
    nextPage: () => void;
    getRowCount: () => number;
    state: { pagination?: { pageIndex: number; pageSize: number } };
};

type Props<TData extends RowData> = {
    table: AnyTable & { _brand?: [DataTableFeatures, TData] };
    /**
     * Para paginación de servidor: avisa qué página pidió el usuario para que
     * la vista dispare la navegación de Inertia.
     */
    onPageChange?: (pageIndex: number) => void;
    /** Total de registros informado por el servidor. */
    rowCount?: number;
};

export function DataTablePagination<TData extends RowData>({
    table,
    onPageChange,
    rowCount: serverRowCount,
}: Props<TData>) {
    const pageCount = table.getPageCount();
    const pageIndex = table.state.pagination?.pageIndex ?? 0;
    const rowCount = serverRowCount ?? table.getRowCount();

    if (pageCount <= 1) {
        return null;
    }

    function goTo(index: number) {
        if (onPageChange) {
            onPageChange(index);

            return;
        }

        table.setPageIndex(index);
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm text-muted-foreground tabular-nums">
                Página {pageIndex + 1} de {pageCount}
                <span className="hidden sm:inline">
                    {' '}
                    · {rowCount} {rowCount === 1 ? 'registro' : 'registros'}
                </span>
            </p>

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className="hidden size-8 lg:inline-flex"
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => goTo(0)}
                    aria-label="Ir a la primera página"
                >
                    <ChevronsLeft className="size-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => goTo(pageIndex - 1)}
                    aria-label="Ir a la página anterior"
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={!table.getCanNextPage()}
                    onClick={() => goTo(pageIndex + 1)}
                    aria-label="Ir a la página siguiente"
                >
                    <ChevronRight className="size-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="hidden size-8 lg:inline-flex"
                    disabled={!table.getCanNextPage()}
                    onClick={() => goTo(pageCount - 1)}
                    aria-label="Ir a la última página"
                >
                    <ChevronsRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}
