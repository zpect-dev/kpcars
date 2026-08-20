import { Head, Link } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { Calendar, History, User } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable } from '@/components/app/data-table/data-table';
import { DataTableColumnHeader } from '@/components/app/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/components/app/data-table/features';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { index } from '@/routes/cobros';
import { show as historialShow } from '@/routes/cobros/historial';

interface CierreRow {
    id: number;
    user: { id: number; name: string } | null;
    total_cobros: number;
    total_gastos: number;
    total: number;
    created_at: string | null;
}

interface Props {
    cierres: CierreRow[];
}

function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

function formatDate(date: string | null): string {
    if (!date) {
        return '—';
    }

    return new Date(date).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CobrosHistorial({ cierres }: Props) {
    const columns = useMemo<ColumnDef<DataTableFeatures, CierreRow>[]>(
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
                    <span className="font-medium text-foreground tabular-nums">
                        #{row.original.id}
                    </span>
                ),
                meta: { label: 'Cierre', mobile: 'title' },
            },
            {
                id: 'fecha',
                accessorFn: (row) => row.created_at ?? '',
                sortingFn: 'datetime',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Fecha
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <Calendar
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-muted-foreground"
                        />
                        {formatDate(row.original.created_at)}
                    </div>
                ),
                meta: { label: 'Fecha', mobile: 'field' },
            },
            {
                id: 'usuario',
                accessorFn: (row) => row.user?.name ?? '',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Ejecutado por
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <User
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-muted-foreground"
                        />
                        {row.original.user?.name ?? 'N/A'}
                    </div>
                ),
                meta: { label: 'Ejecutado por', mobile: 'field' },
            },
            {
                id: 'cobros',
                accessorFn: (row) => Number(row.total_cobros),
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Cobros
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => formatARS(Number(row.original.total_cobros)),
                meta: {
                    label: 'Cobros',
                    mobile: 'field',
                    align: 'right',
                    cellClassName: 'tabular-nums',
                },
            },
            {
                id: 'gastos',
                accessorFn: (row) => Number(row.total_gastos),
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Gastos
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => formatARS(Number(row.original.total_gastos)),
                meta: {
                    label: 'Gastos',
                    mobile: 'field',
                    align: 'right',
                    cellClassName: 'tabular-nums',
                },
            },
            {
                id: 'total',
                accessorFn: (row) => Number(row.total),
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Total
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => (
                    <span className="font-medium text-foreground">
                        {formatARS(Number(row.original.total))}
                    </span>
                ),
                meta: {
                    label: 'Total',
                    mobile: 'field',
                    align: 'right',
                    cellClassName: 'tabular-nums',
                },
            },
            {
                id: 'detalle',
                enableSorting: false,
                enableHiding: false,
                header: '',
                cell: ({ row }) => (
                    <Button variant="outline" size="sm" asChild>
                        <Link href={historialShow.url(row.original.id)}>
                            Ver
                        </Link>
                    </Button>
                ),
                meta: { label: 'Detalle', mobile: 'badge', align: 'right' },
            },
        ],
        [],
    );

    return (
        <>
            <Head title="Historial de Caja" />

            <PageContainer>
                <PageHeader
                    title="Historial de Cierres"
                    count={{
                        value: cierres.length,
                        singular: 'cierre',
                        plural: 'cierres',
                    }}
                    description="Cada cierre abre una réplica de solo lectura de cómo se veía Caja en ese período."
                />

                <DataTable
                    columns={columns}
                    data={cierres}
                    getRowId={(row) => String(row.id)}
                    initialSorting={[{ id: 'fecha', desc: true }]}
                    empty={{
                        icon: History,
                        title: 'Todavía no hay cierres de caja',
                        description:
                            'Cuando se cierre un período de caja, queda archivado acá.',
                    }}
                />
            </PageContainer>
        </>
    );
}

CobrosHistorial.layout = {
    breadcrumbs: [
        { title: 'Caja', href: index.url() },
        { title: 'Historial', href: '/cobros/historial' },
    ],
};
