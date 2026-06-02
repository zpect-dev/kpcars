import { Head, router, usePage } from '@inertiajs/react';
import { ClipboardList, FileDown, History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDate, RecaudacionesTabla, ResumenRecaudacionModal } from '@/components/recaudaciones-tabla';
import { Button } from '@/components/ui/button';
import type { RecaudacionFila } from '@/types';

interface Props {
    cierre: {
        id: number;
        user: { id: number; name: string } | null;
        created_at: string;
    };
    filas: RecaudacionFila[];
    totalGeneral: number;
}

export default function RecaudacionesCierre({ cierre, filas, totalGeneral }: Props) {
    const { auth } = usePage<any>().props;
    const isAdmin = auth?.user?.role === 'administrador';

    const [showResumenModal, setShowResumenModal] = useState(false);

    const hayDeudores = useMemo(() => filas.some((f) => f.estado === 'deuda'), [filas]);

    return (
        <>
            <Head title={`Cierre #${cierre.id}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Cierre #{cierre.id}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(cierre.created_at)} por {cierre.user?.name ?? 'N/A'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => router.get('/recaudaciones/historial')}>
                            <History className="mr-1.5 h-4 w-4" />
                            Historial
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowResumenModal(true)}
                            disabled={filas.length === 0}
                        >
                            <ClipboardList className="mr-1.5 h-4 w-4" />
                            Resumen
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                window.open(`/pdf/recaudaciones-deudores/cierre/${cierre.id}`, '_blank')
                            }
                            disabled={!hayDeudores}
                        >
                            <FileDown className="mr-1.5 h-4 w-4" />
                            Imprimir deudores
                        </Button>
                    </div>
                </div>

                {filas.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <p className="text-sm text-muted-foreground">
                            Este cierre no tiene registros de recaudación.
                        </p>
                    </div>
                ) : (
                    <RecaudacionesTabla
                        filas={filas}
                        editable={isAdmin}
                        endpoint={(f) => `/recaudaciones/registro/${f.id}`}
                        emptyMessage="No hay registros que coincidan con la búsqueda."
                    />
                )}
            </div>

            {/* Modal resumen por inversión */}
            <ResumenRecaudacionModal
                open={showResumenModal}
                onOpenChange={setShowResumenModal}
                filas={filas}
                totalGeneral={totalGeneral}
            />
        </>
    );
}

RecaudacionesCierre.layout = {
    breadcrumbs: [
        { title: 'Recaudaciones', href: '/recaudaciones' },
        { title: 'Historial', href: '/recaudaciones/historial' },
        { title: 'Cierre', href: '#' },
    ],
};
