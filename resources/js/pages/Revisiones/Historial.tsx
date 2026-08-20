import { Head, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarClock } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable } from '@/components/app/data-table/data-table';
import { DataTableColumnHeader } from '@/components/app/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/components/app/data-table/features';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';

interface Cierre {
    id: number;
    periodo_inicio: string;
    periodo_fin: string;
    user: { id: number; name: string };
    created_at: string;
}

interface Props {
    /**
     * Paginador de Laravel. Los campos de página son opcionales porque la vista
     * también funciona si el controlador manda la colección entera.
     */
    cierres: {
        data: Cierre[];
        current_page?: number;
        last_page?: number;
        total?: number;
    };
}

function formatDateRange(inicioStr: string, finStr: string) {
    const inicio = new Date(inicioStr + 'T00:00:00');
    const fin = new Date(finStr + 'T00:00:00');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    return `Del ${inicio.getDate()} de ${meses[inicio.getMonth()]} al ${fin.getDate()} de ${meses[fin.getMonth()]}, ${fin.getFullYear()}`;
}

export default function Historial({ cierres }: Props) {
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
                    <span className="font-semibold text-foreground tabular-nums">
                        #{row.original.id}
                    </span>
                ),
                meta: { label: 'Cierre', mobile: 'title' },
            },
            {
                id: 'periodo',
                accessorFn: (row) => row.periodo_inicio,
                sortingFn: 'datetime',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Período
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) =>
                    formatDateRange(
                        row.original.periodo_inicio,
                        row.original.periodo_fin,
                    ),
                meta: { label: 'Período', mobile: 'field' },
            },
            {
                id: 'cerrado_por',
                accessorFn: (row) => row.user?.name ?? '—',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Cerrado por
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => (
                    <span className="font-medium text-foreground">
                        {row.original.user?.name ?? '—'}
                    </span>
                ),
                meta: { label: 'Cerrado por', mobile: 'field' },
            },
        ],
        [],
    );

    const paginaServidor =
        cierres.current_page != null && cierres.last_page != null
            ? {
                  pageIndex: cierres.current_page - 1,
                  pageCount: cierres.last_page,
                  rowCount: cierres.total,
                  onPageChange: (pageIndex: number) =>
                      router.get(
                          '/revisiones/historial',
                          { page: pageIndex + 1 },
                          { preserveScroll: true, preserveState: true },
                      ),
              }
            : undefined;

    return (
        <>
            <Head title="Historial de Revisiones" />

            <PageContainer>
                <PageHeader
                    title="Historial de Revisiones"
                    description="Registro de todos los períodos cerrados de revisiones"
                />

                <DataTable
                    columns={columns}
                    data={cierres.data}
                    getRowId={(row) => String(row.id)}
                    initialSorting={[{ id: 'periodo', desc: true }]}
                    onRowClick={(row) =>
                        router.get(`/revisiones/historial/${row.id}`)
                    }
                    serverPagination={paginaServidor}
                    empty={{
                        icon: CalendarClock,
                        title: 'No hay cierres registrados',
                        description:
                            'Al cerrar un período de revisiones, el resumen queda archivado acá.',
                    }}
                />
            </PageContainer>
        </>
    );
}

Historial.layout = {
    breadcrumbs: [
        { title: 'Revisiones', href: '/revisiones' },
        { title: 'Historial', href: '/revisiones/historial' }
    ],
};
