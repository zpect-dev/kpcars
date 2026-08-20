import { Head, router } from '@inertiajs/react';
import { AlertCircle, CheckCircle2, UserCheck } from 'lucide-react';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { cn } from '@/lib/utils';

interface Detalle {
    id: number;
    estado: 'revisado' | 'no_revisado';
    vehiculo: { id: number; patente: string; marca: string; modelo: string };
    revision: {
        kilometraje: number;
        nivel_nafta: string;
        revisor: { name: string };
    } | null;
}

interface Cierre {
    id: number;
    periodo_inicio: string;
    periodo_fin: string;
    detalles: Detalle[];
}

interface Props {
    cierre: Cierre;
}

function formatDateRange(inicioStr: string, finStr: string) {
    const inicio = new Date(inicioStr + 'T00:00:00');
    const fin = new Date(finStr + 'T00:00:00');
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    return `${inicio.getDate()} de ${meses[inicio.getMonth()]} - ${fin.getDate()} de ${meses[fin.getMonth()]}, ${fin.getFullYear()}`;
}

export default function HistorialDetalle({ cierre }: Props) {
    const revisadosCount = cierre.detalles.filter(
        (d) => d.estado === 'revisado',
    ).length;
    const noRevisadosCount = cierre.detalles.length - revisadosCount;

    return (
        <>
            <Head title={`Cierre #${cierre.id}`} />

            <PageContainer>
                <PageHeader
                    title={`Cierre de Revisiones #${cierre.id}`}
                    description={formatDateRange(
                        cierre.periodo_inicio,
                        cierre.periodo_fin,
                    )}
                    onBack={() => router.get('/revisiones/historial')}
                    actions={
                        <>
                            <StatusBadge tone="success" dot>
                                {revisadosCount} revisados
                            </StatusBadge>
                            <StatusBadge tone="destructive" dot>
                                {noRevisadosCount} pendientes
                            </StatusBadge>
                        </>
                    }
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {cierre.detalles.map((detalle) => {
                        const revisado = detalle.estado === 'revisado';

                        return (
                            <div
                                key={detalle.id}
                                className={cn(
                                    'flex flex-col justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm',
                                    revisado
                                        ? 'border-success/30'
                                        : 'border-destructive/30',
                                )}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex flex-col">
                                        <h3 className="font-mono text-lg leading-none font-bold text-foreground">
                                            {detalle.vehiculo.patente}
                                        </h3>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {detalle.vehiculo.marca}{' '}
                                            {detalle.vehiculo.modelo}
                                        </p>
                                    </div>
                                    {revisado ? (
                                        <StatusBadge
                                            tone="success"
                                            icon={CheckCircle2}
                                        >
                                            Revisado
                                        </StatusBadge>
                                    ) : (
                                        <StatusBadge
                                            tone="destructive"
                                            icon={AlertCircle}
                                        >
                                            No revisado
                                        </StatusBadge>
                                    )}
                                </div>

                                {revisado && detalle.revision ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <span className="rounded-md border border-border bg-muted/50 px-2 py-1 font-medium tabular-nums">
                                                Km:{' '}
                                                {detalle.revision.kilometraje?.toLocaleString(
                                                    'es-AR',
                                                )}
                                            </span>
                                            <span className="rounded-md border border-border bg-muted/50 px-2 py-1 font-medium capitalize">
                                                Nafta{' '}
                                                {detalle.revision.nivel_nafta}
                                            </span>
                                        </div>
                                        {detalle.revision.revisor && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <UserCheck
                                                    aria-hidden="true"
                                                    className="size-3.5 shrink-0 text-success"
                                                />
                                                <span className="truncate">
                                                    Revisado por{' '}
                                                    <span className="font-medium text-foreground">
                                                        {
                                                            detalle.revision
                                                                .revisor.name
                                                        }
                                                    </span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs font-medium text-destructive">
                                        El vehículo quedó sin revisión en este
                                        período
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </PageContainer>
        </>
    );
}

HistorialDetalle.layout = {
    breadcrumbs: [
        { title: 'Revisiones', href: '/revisiones' },
        { title: 'Historial', href: '/revisiones/historial' },
        { title: 'Detalle', href: '#' }
    ],
};
