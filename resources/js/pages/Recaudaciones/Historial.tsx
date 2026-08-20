import { Head, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { Calendar, Car, Lock, User } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable } from '@/components/app/data-table/data-table';
import { DataTableColumnHeader } from '@/components/app/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/components/app/data-table/features';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { formatARS, formatDate } from '@/components/recaudaciones-tabla';
import type { RecaudacionCierreResumen } from '@/types';

interface Props {
    cierres: RecaudacionCierreResumen[];
}

export default function RecaudacionesHistorial({ cierres }: Props) {
    const columns = useMemo<
        ColumnDef<DataTableFeatures, RecaudacionCierreResumen>[]
    >(
        () => [
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
                        <span className="font-medium text-foreground">
                            {formatDate(row.original.created_at)}
                        </span>
                    </div>
                ),
                meta: { label: 'Fecha', mobile: 'title' },
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
                id: 'vehiculos',
                accessorFn: (row) => row.vehiculos_count,
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Vehículos
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => (
                    <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
                        <Car aria-hidden="true" className="size-3.5" />
                        {row.original.vehiculos_count}
                    </span>
                ),
                meta: { label: 'Vehículos', mobile: 'field' },
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
                    <span className="font-semibold text-foreground">
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
        ],
        [],
    );

    return (
        <>
            <Head title="Historial de recaudaciones" />

            <PageContainer>
                <PageHeader
                    title="Historial de cierres"
                    count={{
                        value: cierres.length,
                        singular: 'cierre registrado',
                        plural: 'cierres registrados',
                    }}
                    onBack={() => router.get('/recaudaciones')}
                />

                <DataTable
                    columns={columns}
                    data={cierres}
                    getRowId={(row) => String(row.id)}
                    initialSorting={[{ id: 'fecha', desc: true }]}
                    onRowClick={(row) =>
                        router.get(`/recaudaciones/cierres/${row.id}`)
                    }
                    empty={{
                        icon: Lock,
                        title: 'Todavía no se hicieron cierres',
                        description:
                            'Al cerrar un período de recaudación, el resumen queda archivado acá.',
                    }}
                />
            </PageContainer>
        </>
    );
}

RecaudacionesHistorial.layout = {
    breadcrumbs: [
        { title: 'Recaudaciones', href: '/recaudaciones' },
        { title: 'Historial', href: '/recaudaciones/historial' },
    ],
};
