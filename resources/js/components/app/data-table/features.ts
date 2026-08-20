import {
    columnVisibilityFeature,
    createPaginatedRowModel,
    createSortedRowModel,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_datetime,
    sortFn_text,
    tableFeatures,
} from '@tanstack/react-table';

/**
 * Funcionalidades que usan las tablas de la aplicación. En la versión 9 de
 * TanStack hay que declararlas: lo que no se registra acá no entra al bundle.
 *
 * El filtrado no está: las vistas filtran con su propia FilterBar, contra el
 * servidor o en memoria, y el resultado ya llega filtrado a la tabla.
 */
export const tableFeaturesSet = tableFeatures({
    columnVisibilityFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    paginatedRowModel: createPaginatedRowModel(),
    sortedRowModel: createSortedRowModel(),
    sortFns: {
        alphanumeric: sortFn_alphanumeric,
        text: sortFn_text,
        datetime: sortFn_datetime,
    },
});

export type DataTableFeatures = typeof tableFeaturesSet;

/**
 * Datos extra por columna. `mobile` es lo que permite que una sola definición
 * de columnas sirva para la tabla de escritorio y para la tarjeta de teléfono,
 * en vez de mantener dos markups del mismo dato.
 */
export type DataTableColumnMeta = {
    /** Rótulo legible. Lo usan el selector de columnas y las tarjetas. */
    label?: string;
    /**
     * Rol en la tarjeta de teléfono:
     * - `title`: encabeza la tarjeta.
     * - `badge`: va arriba a la derecha, para el estado.
     * - `field`: par rótulo/valor en el cuerpo (por defecto).
     * - `hidden`: no aparece.
     */
    mobile?: 'title' | 'badge' | 'field' | 'hidden';
    align?: 'left' | 'right';
    /** Clases extra para la celda, tanto en `th` como en `td`. */
    cellClassName?: string;
};

export function columnMeta(meta: unknown): DataTableColumnMeta {
    return (meta ?? {}) as DataTableColumnMeta;
}
