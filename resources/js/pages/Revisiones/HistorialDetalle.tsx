import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

export default function HistorialDetalle({ cierre }: Props) {
    const inicio = new Date(cierre.periodo_inicio + 'T00:00:00');
    const fin = new Date(cierre.periodo_fin + 'T00:00:00');
    
    const revisadosCount = cierre.detalles.filter(d => d.estado === 'revisado').length;
    const noRevisadosCount = cierre.detalles.length - revisadosCount;

    return (
        <>
            <Head title={`Cierre #${cierre.id}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" asChild className="h-8 w-8">
                            <Link href="/revisiones/historial">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                                Cierre de Revisiones #{cierre.id}
                            </h1>
                            <p className="text-sm text-muted-foreground capitalize">
                                {format(inicio, "dd 'de' MMMM", { locale: es })} - {format(fin, "dd 'de' MMMM, yyyy", { locale: es })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            {revisadosCount} revisados
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            {noRevisadosCount} pendientes
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {cierre.detalles.map((detalle) => (
                        <div
                            key={detalle.id}
                            className={cn(
                                "flex flex-col justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm",
                                detalle.estado === 'revisado' 
                                    ? "border-green-500/30 dark:border-green-900/30" 
                                    : "border-red-500/30 dark:border-red-900/30"
                            )}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex flex-col">
                                    <h3 className="font-mono text-lg font-bold text-foreground leading-none">{detalle.vehiculo.patente}</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">{detalle.vehiculo.marca} {detalle.vehiculo.modelo}</p>
                                </div>
                                {detalle.estado === 'revisado' ? (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Revisado
                                    </span>
                                ) : (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        No Revisado
                                    </span>
                                )}
                            </div>
                            
                            {detalle.estado === 'revisado' && detalle.revision ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span className="rounded-md border border-border bg-muted/50 px-2 py-1 font-medium">
                                            Km: {detalle.revision.kilometraje?.toLocaleString('es-AR')}
                                        </span>
                                        <span className="rounded-md border border-border bg-muted/50 px-2 py-1 capitalize font-medium">
                                            Nafta {detalle.revision.nivel_nafta}
                                        </span>
                                    </div>
                                    {detalle.revision.revisor && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <UserCheck className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                                            <span className="truncate">
                                                Revisado por <span className="font-medium text-foreground">{detalle.revision.revisor.name}</span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-2 font-medium">
                                    El vehículo quedó sin revisión en este periodo
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
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
