import { Head, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { Car, CarFront, FileDown } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable } from '@/components/app/data-table/data-table';
import { DataTableColumnHeader } from '@/components/app/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/components/app/data-table/features';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { Button } from '@/components/ui/button';

interface Vehiculo {
    id: number;
    patente: string;
    marca: string;
    modelo: string;
    anio: string;
}

interface Asignacion {
    id: number;
    vehiculo: Vehiculo | null;
    asignado_por: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
}

interface UserInfo {
    id: number;
    name: string;
    dni: string;
    role: string;
}

interface Props {
    user: UserInfo;
    asignaciones: Asignacion[];
}

function formatDate(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    return new Date(iso).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function UserAsignaciones({ user, asignaciones }: Props) {
    const columns = useMemo<ColumnDef<DataTableFeatures, Asignacion>[]>(
        () => [
            {
                id: 'vehiculo',
                accessorFn: (row) =>
                    row.vehiculo
                        ? `${row.vehiculo.marca} ${row.vehiculo.modelo}`
                        : '',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Vehículo
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => {
                    const vehiculo = row.original.vehiculo;

                    return (
                        <div className="flex items-center gap-2">
                            {vehiculo ? (
                                <>
                                    <CarFront className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="font-medium text-foreground">
                                        {vehiculo.marca} {vehiculo.modelo}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Car className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="text-muted-foreground italic">
                                        Sin vehículo
                                    </span>
                                </>
                            )}
                        </div>
                    );
                },
                meta: { label: 'Vehículo', mobile: 'title' },
            },
            {
                id: 'patente',
                accessorFn: (row) => row.vehiculo?.patente ?? '—',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Patente
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => (
                    <span className="font-mono">
                        {row.original.vehiculo?.patente ?? '—'}
                    </span>
                ),
                meta: { label: 'Patente', mobile: 'field' },
            },
            {
                id: 'inicio',
                accessorFn: (row) => row.fecha_inicio ?? '',
                sortingFn: 'datetime',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Inicio
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => formatDate(row.original.fecha_inicio),
                meta: { label: 'Inicio', mobile: 'field' },
            },
            {
                id: 'fin',
                accessorFn: (row) => row.fecha_fin ?? '',
                sortingFn: 'datetime',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Fin
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => formatDate(row.original.fecha_fin),
                meta: { label: 'Fin', mobile: 'field' },
            },
            {
                id: 'estado',
                accessorFn: (row) =>
                    row.fecha_fin === null ? 'Activo' : 'Finalizado',
                enableSorting: false,
                header: 'Estado',
                cell: ({ row }) =>
                    row.original.fecha_fin === null ? (
                        <StatusBadge tone="success" dot>
                            Activo
                        </StatusBadge>
                    ) : (
                        <StatusBadge tone="neutral">Finalizado</StatusBadge>
                    ),
                meta: { label: 'Estado', mobile: 'badge' },
            },
            {
                id: 'asignado_por',
                accessorFn: (row) => row.asignado_por ?? '—',
                header: ({ column }) => (
                    <DataTableColumnHeader column={column}>
                        Asignado por
                    </DataTableColumnHeader>
                ),
                cell: ({ row }) => row.original.asignado_por ?? '—',
                meta: { label: 'Asignado por', mobile: 'field' },
            },
        ],
        [],
    );

    return (
        <>
            <Head title={`Asignaciones — ${user.name}`} />

            <PageContainer>
                <PageHeader
                    title="Historial de Asignaciones"
                    description={`${user.name} — DNI ${user.dni}`}
                    count={{
                        value: asignaciones.length,
                        singular: 'asignación',
                        plural: 'asignaciones',
                    }}
                    onBack={() => {
                        if (window.history.length > 1) {
                            window.history.back();
                        } else {
                            router.get('/users');
                        }
                    }}
                    actions={
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                window.open(
                                    `/users/${user.id}/asignaciones/pdf`,
                                    '_blank',
                                )
                            }
                        >
                            <FileDown className="size-4" />
                            Exportar PDF
                        </Button>
                    }
                />

                <DataTable
                    columns={columns}
                    data={asignaciones}
                    getRowId={(row) => String(row.id)}
                    initialSorting={[{ id: 'inicio', desc: true }]}
                    empty={{
                        title: 'Sin asignaciones registradas',
                        description:
                            'Este usuario todavía no tuvo ningún vehículo asignado.',
                    }}
                />
            </PageContainer>
        </>
    );
}
