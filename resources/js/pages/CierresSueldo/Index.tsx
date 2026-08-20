import { Head, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { Calendar, Lock } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable } from '@/components/app/data-table/data-table';
import { DataTableColumnHeader } from '@/components/app/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/components/app/data-table/features';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { MoneyDual } from '@/components/money-dual';

interface Cierre {
    id: number;
    fecha: string | null;
    tasa: number;
    ejecutado_por: { id: number; name: string } | null;
    total_pagado: number;
    total_abonado: number;
}

interface Paginator {
    data: Cierre[];
    current_page: number;
    last_page: number;
    next_page_url: string | null;
    prev_page_url: string | null;
    total?: number;
}

interface Props {
    cierres: Paginator;
}

function formatFecha(d: string | null): string {
    if (!d) {
        return '—';
    }

    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export default function CierresSueldoIndex({ cierres }: Props) {
    const columns = useMemo<ColumnDef<DataTableFeatures, Cierre>[]>(
        () => [
            {
                id: 'cierre',
                accessorFn: (row) => row.id,
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Cierre
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => (
                    <div className="flex items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                        >
                            <Calendar className="size-4" />
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">
                            #{row.original.id}
                        </span>
                    </div>
                ),
                meta: { label: 'Cierre', mobile: 'title' },
            },
            {
                id: 'fecha',
                accessorFn: (row) => row.fecha ?? '',
                sortingFn: 'datetime',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Fecha
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => formatFecha(row.original.fecha),
                meta: { label: 'Fecha', mobile: 'field' },
            },
            {
                id: 'ejecutado_por',
                accessorFn: (row) => row.ejecutado_por?.name ?? '—',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Ejecutado por
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => row.original.ejecutado_por?.name ?? '—',
                meta: { label: 'Ejecutado por', mobile: 'field' },
            },
            {
                id: 'abonos',
                accessorFn: (row) => Number(row.total_abonado),
                enableSorting: false,
                header: 'Abonos',
                cell: ({ row }) =>
                    row.original.total_abonado > 0 ? (
                        <StatusBadge tone="info" size="sm">
                            Con abonos de deuda
                        </StatusBadge>
                    ) : null,
                meta: { label: 'Abonos', mobile: 'badge' },
            },
            {
                id: 'total',
                accessorFn: (row) => Number(row.total_pagado),
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Total pagado
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => (
                    <MoneyDual
                        ars={Number(row.original.total_pagado)}
                        tasa={row.original.tasa ? Number(row.original.tasa) : null}
                        orientation="stacked"
                        size="sm"
                        className="items-end"
                    />
                ),
                meta: { label: 'Total pagado', mobile: 'field', align: 'right' },
            },
        ],
        [],
    );

    return (
        <>
            <Head title="Cierres de Sueldo" />

            <PageContainer>
                <PageHeader
                    title="Cierres de Sueldo"
                    description="Cada cierre se genera automáticamente al cerrar la recaudación de las dos empresas."
                />

                <DataTable
                    columns={columns}
                    data={cierres.data}
                    getRowId={(row) => String(row.id)}
                    onRowClick={(row) =>
                        router.get(`/cierres-sueldo/${row.id}`)
                    }
                    serverPagination={{
                        pageIndex: cierres.current_page - 1,
                        pageCount: cierres.last_page,
                        rowCount: cierres.total,
                        onPageChange: (pageIndex) =>
                            router.get(
                                '/cierres-sueldo',
                                { page: pageIndex + 1 },
                                { preserveScroll: true, preserveState: true },
                            ),
                    }}
                    empty={{
                        icon: Lock,
                        title: 'Sin cierres',
                        description:
                            'Los cierres aparecen acá cuando ejecutás el cierre unificado desde Recaudaciones.',
                    }}
                />
            </PageContainer>
        </>
    );
}

CierresSueldoIndex.layout = {
    breadcrumbs: [{ title: 'Cierres de Sueldo', href: '/cierres-sueldo' }],
};
