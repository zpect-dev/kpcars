import type {
    ColumnDef,
    ColumnVisibilityState,
    PaginationState,
    Row,
    RowData,
    RowSelectionState,
    SortingState,
} from '@tanstack/react-table';
import { useTable } from '@tanstack/react-table';
import type { LucideIcon } from 'lucide-react';
import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { DataTablePagination } from '@/components/app/data-table/data-table-pagination';
import { DataTableSkeleton } from '@/components/app/data-table/data-table-skeleton';
import {
    columnMeta,
    tableFeaturesSet
    
} from '@/components/app/data-table/features';
import type {DataTableFeatures} from '@/components/app/data-table/features';
import { EmptyState } from '@/components/app/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Paginación resuelta por el servidor. Sin esto la tabla pagina en memoria.
 *
 * Va con `pageCount` y no con el total de filas porque es lo que devuelve el
 * paginador de Laravel: `current_page - 1` y `last_page`, sin tener que
 * adivinar cuántas filas hay en total.
 */
type ServerPagination = {
    pageIndex: number;
    pageCount: number;
    /** Total de registros, si el servidor lo manda. Sólo se muestra. */
    rowCount?: number;
    onPageChange: (pageIndex: number) => void;
};

type Props<TData extends RowData> = {
    columns: ColumnDef<DataTableFeatures, TData>[];
    data: TData[];
    getRowId?: (row: TData) => string;
    /** Muestra filas fantasma en vez de los datos. */
    loading?: boolean;
    empty?: {
        variant?: 'empty' | 'filtered';
        icon?: LucideIcon;
        title: string;
        description?: ReactNode;
        action?: { label: string; onClick: () => void };
    };
    onRowClick?: (row: TData) => void;
    /** Contenido a la izquierda de la barra de la tabla. */
    toolbar?: ReactNode;
    enableColumnVisibility?: boolean;
    enableSelection?: boolean;
    /** Acciones sobre las filas tildadas. Recibe las filas, no los ids. */
    bulkActions?: (rows: TData[]) => ReactNode;
    initialSorting?: SortingState;
    pageSize?: number;
    serverPagination?: ServerPagination;
    className?: string;
};

const SELECTION_COLUMN_ID = 'seleccion';

export function DataTable<TData extends RowData>({
    columns,
    data,
    getRowId,
    loading = false,
    empty,
    onRowClick,
    toolbar,
    enableColumnVisibility = true,
    enableSelection = false,
    bulkActions,
    initialSorting = [],
    pageSize = 25,
    serverPagination,
    className,
}: Props<TData>) {
    const [sorting, setSorting] = useState<SortingState>(initialSorting);
    const [columnVisibility, setColumnVisibility] =
        useState<ColumnVisibilityState>({});
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize,
    });

    const allColumns = useMemo(() => {
        if (!enableSelection) {
            return columns;
        }

        const selectionColumn: ColumnDef<DataTableFeatures, TData> = {
            id: SELECTION_COLUMN_ID,
            enableSorting: false,
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && 'indeterminate')
                    }
                    onCheckedChange={(value) =>
                        table.toggleAllPageRowsSelected(!!value)
                    }
                    aria-label="Seleccionar todas las filas de esta página"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label="Seleccionar fila"
                />
            ),
            meta: { mobile: 'hidden', cellClassName: 'w-10' },
        };

        return [selectionColumn, ...columns];
    }, [columns, enableSelection]);

    const table = useTable<DataTableFeatures, TData>({
        features: tableFeaturesSet,
        data,
        columns: allColumns,
        getRowId: getRowId
            ? (row: TData) => getRowId(row)
            : undefined,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            pagination: serverPagination
                ? {
                      pageIndex: serverPagination.pageIndex,
                      pageSize: data.length || pageSize,
                  }
                : pagination,
        },
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: setPagination,
        manualPagination: Boolean(serverPagination),
        pageCount: serverPagination?.pageCount,
        rowCount: serverPagination?.rowCount,
        enableRowSelection: enableSelection,
    });

    const rows = table.getRowModel().rows;
    const visibleColumnCount = table.getVisibleLeafColumns().length;
    const selectedRows = enableSelection
        ? table.getSelectedRowModel().rows.map((row: Row<DataTableFeatures, TData>) => row.original)
        : [];

    const hideableColumns = table
        .getAllLeafColumns()
        .filter((column) => column.getCanHide?.());

    const showToolbar =
        Boolean(toolbar) ||
        (enableColumnVisibility && hideableColumns.length > 0) ||
        selectedRows.length > 0;

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            {showToolbar && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {toolbar}
                        {selectedRows.length > 0 && (
                            <>
                                <span
                                    aria-live="polite"
                                    className="text-sm text-muted-foreground tabular-nums"
                                >
                                    {selectedRows.length}{' '}
                                    {selectedRows.length === 1
                                        ? 'seleccionada'
                                        : 'seleccionadas'}
                                </span>
                                {bulkActions?.(selectedRows)}
                            </>
                        )}
                    </div>

                    {enableColumnVisibility && hideableColumns.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <SlidersHorizontal className="size-4" />
                                    <span className="hidden sm:inline">
                                        Columnas
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel>
                                    Mostrar columnas
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {hideableColumns.map((column) => (
                                    <DropdownMenuItem
                                        key={column.id}
                                        onSelect={(event) => {
                                            event.preventDefault();
                                            column.toggleVisibility(
                                                !column.getIsVisible(),
                                            );
                                        }}
                                        className="gap-2"
                                    >
                                        <Checkbox
                                            checked={column.getIsVisible()}
                                            tabIndex={-1}
                                            aria-hidden="true"
                                        />
                                        {columnMeta(column.columnDef.meta)
                                            .label ?? column.id}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}

            <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {/* Escritorio */}
                <div className="hidden md:block">
                    <Table className="text-muted-foreground">
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        const meta = columnMeta(
                                            header.column.columnDef.meta,
                                        );

                                        return (
                                            <TableHead
                                                key={header.id}
                                                className={cn(
                                                    meta.align === 'right' &&
                                                        'text-right',
                                                    meta.cellClassName,
                                                )}
                                            >
                                                {header.isPlaceholder ? null : (
                                                    <table.FlexRender
                                                        header={header}
                                                    />
                                                )}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <DataTableSkeleton
                                    columns={visibleColumnCount}
                                />
                            ) : rows.length === 0 ? (
                                <TableRow className="hover:bg-card">
                                    <TableCell
                                        colSpan={visibleColumnCount}
                                        className="p-0"
                                    >
                                        <EmptyState
                                            variant={empty?.variant}
                                            icon={empty?.icon}
                                            title={
                                                empty?.title ?? 'Sin resultados'
                                            }
                                            description={empty?.description}
                                            action={empty?.action}
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={
                                            row.getIsSelected()
                                                ? 'selected'
                                                : undefined
                                        }
                                        onClick={
                                            onRowClick
                                                ? () => onRowClick(row.original)
                                                : undefined
                                        }
                                        className={cn(
                                            onRowClick && 'cursor-pointer',
                                        )}
                                    >
                                        {row.getVisibleCells().map((cell) => {
                                            const meta = columnMeta(
                                                cell.column.columnDef.meta,
                                            );

                                            return (
                                                <TableCell
                                                    key={cell.id}
                                                    className={cn(
                                                        meta.align ===
                                                            'right' &&
                                                            'text-right',
                                                        meta.cellClassName,
                                                    )}
                                                >
                                                    <table.FlexRender
                                                        cell={cell}
                                                    />
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Teléfono: la misma definición de columnas, colapsada a tarjeta */}
                <ul className="divide-y divide-border md:hidden">
                    {loading ? (
                        <li className="flex flex-col gap-3 p-4">
                            <DataTableMobileSkeleton />
                        </li>
                    ) : rows.length === 0 ? (
                        <li>
                            <EmptyState
                                variant={empty?.variant}
                                icon={empty?.icon}
                                title={empty?.title ?? 'Sin resultados'}
                                description={empty?.description}
                                action={empty?.action}
                            />
                        </li>
                    ) : (
                        rows.map((row) => (
                            <DataTableMobileRow
                                key={row.id}
                                row={row}
                                table={table}
                                onClick={
                                    onRowClick
                                        ? () => onRowClick(row.original)
                                        : undefined
                                }
                            />
                        ))
                    )}
                </ul>
            </div>

            {!loading && rows.length > 0 && (
                <DataTablePagination
                    table={table}
                    onPageChange={serverPagination?.onPageChange}
                    rowCount={serverPagination?.rowCount}
                />
            )}
        </div>
    );
}

function DataTableMobileSkeleton() {
    return (
        <>
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </>
    );
}

function DataTableMobileRow<TData extends RowData>({
    row,
    table,
    onClick,
}: {
    row: Row<DataTableFeatures, TData>;
    table: ReturnType<typeof useTable<DataTableFeatures, TData>>;
    onClick?: () => void;
}) {
    const cells = row.getVisibleCells();
    const titles = cells.filter(
        (cell) => columnMeta(cell.column.columnDef.meta).mobile === 'title',
    );
    const badges = cells.filter(
        (cell) => columnMeta(cell.column.columnDef.meta).mobile === 'badge',
    );
    const fields = cells.filter((cell) => {
        const mobile = columnMeta(cell.column.columnDef.meta).mobile;

        return mobile === undefined || mobile === 'field';
    });

    const content = (
        <>
            {(titles.length > 0 || badges.length > 0) && (
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5 text-sm font-medium text-foreground">
                        {titles.map((cell) => (
                            <table.FlexRender key={cell.id} cell={cell} />
                        ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {badges.map((cell) => (
                            <table.FlexRender key={cell.id} cell={cell} />
                        ))}
                    </div>
                </div>
            )}

            {fields.length > 0 && (
                <dl className="flex flex-col gap-1 text-sm">
                    {fields.map((cell) => (
                        <div
                            key={cell.id}
                            className="flex items-baseline justify-between gap-3"
                        >
                            <dt className="shrink-0 text-xs text-muted-foreground">
                                {columnMeta(cell.column.columnDef.meta).label ??
                                    cell.column.id}
                            </dt>
                            <dd className="min-w-0 text-right text-foreground">
                                <table.FlexRender cell={cell} />
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
        </>
    );

    if (!onClick) {
        return <li className="flex flex-col gap-2 p-4">{content}</li>;
    }

    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className="flex w-full flex-col gap-2 p-4 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
                {content}
            </button>
        </li>
    );
}
