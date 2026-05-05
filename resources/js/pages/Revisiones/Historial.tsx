import { Head, Link } from '@inertiajs/react';
import { ChevronRight, CalendarClock } from 'lucide-react';

interface Cierre {
    id: number;
    periodo_inicio: string;
    periodo_fin: string;
    user: { id: number; name: string };
    created_at: string;
}

interface Props {
    cierres: {
        data: Cierre[];
        links: any[];
    };
}

function formatDateRange(inicioStr: string, finStr: string) {
    const inicio = new Date(inicioStr + 'T00:00:00');
    const fin = new Date(finStr + 'T00:00:00');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    return `Del ${inicio.getDate()} de ${meses[inicio.getMonth()]} al ${fin.getDate()} de ${meses[fin.getMonth()]}, ${fin.getFullYear()}`;
}

export default function Historial({ cierres }: Props) {
    return (
        <>
            <Head title="Historial de Revisiones" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                        Historial de Revisiones
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Registro de todos los periodos cerrados de revisiones
                    </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    {cierres.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                            <CalendarClock className="h-8 w-8 text-muted-foreground/50" />
                            <p>No hay cierres registrados aún.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {cierres.data.map((cierre) => {
                                return (
                                    <Link
                                        key={cierre.id}
                                        href={`/revisiones/historial/${cierre.id}`}
                                        className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold">
                                                Cierre #{cierre.id}
                                            </span>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                                        </div>
                                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                            <span>
                                                {formatDateRange(cierre.periodo_inicio, cierre.periodo_fin)}
                                            </span>
                                            <span className="text-xs">
                                                Cerrado por: <span className="font-medium text-foreground">{cierre.user?.name}</span>
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

Historial.layout = {
    breadcrumbs: [
        { title: 'Revisiones', href: '/revisiones' },
        { title: 'Historial', href: '/revisiones/historial' }
    ],
};
