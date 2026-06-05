import { Head, router, usePage } from '@inertiajs/react';
import { ClipboardList, Coins, FileDown, History, Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    formatARS,
    formatDate,
    RecaudacionesTabla,
    ResumenRecaudacionModal,
} from '@/components/recaudaciones-tabla';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { RecaudacionFila } from '@/types';

interface Props {
    filas: RecaudacionFila[];
    totalGeneral: number;
    ultimoCierre: {
        id: number;
        user: { id: number; name: string } | null;
        created_at: string;
    } | null;
}

export default function RecaudacionesIndex({ filas, totalGeneral, ultimoCierre }: Props) {
    const { auth } = usePage<any>().props;
    const isAdmin = auth?.user?.role === 'administrador';

    const [showCierreModal, setShowCierreModal] = useState(false);
    const [showResumenModal, setShowResumenModal] = useState(false);
    const [processingCierre, setProcessingCierre] = useState(false);

    const hayDeudores = useMemo(() => filas.some((f) => f.estado === 'deuda'), [filas]);

    function handleCierre() {
        setProcessingCierre(true);
        router.post(
            '/recaudaciones/cierre',
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setProcessingCierre(false);
                    setShowCierreModal(false);
                },
            },
        );
    }

    return (
        <>
            <Head title="Recaudaciones" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Recaudaciones</h2>
                        {ultimoCierre ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Último cierre: {formatDate(ultimoCierre.created_at)} por{' '}
                                {ultimoCierre.user?.name ?? 'N/A'}
                            </p>
                        ) : (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Sin cierres de recaudación previos
                            </p>
                        )}
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
                            onClick={() => window.open('/pdf/recaudaciones-deudores', '_blank')}
                            disabled={!hayDeudores}
                        >
                            <FileDown className="mr-1.5 h-4 w-4" />
                            Imprimir deudores
                        </Button>
                        {isAdmin && (
                            <Button
                                size="sm"
                                onClick={() => setShowCierreModal(true)}
                                disabled={filas.length === 0}
                            >
                                <Lock className="mr-1.5 h-4 w-4" />
                                Cerrar período
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabla editable */}
                {filas.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <Coins className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            No hay vehículos con chofer asignado en esta empresa.
                        </p>
                    </div>
                ) : (
                    <RecaudacionesTabla
                        filas={filas}
                        editable={isAdmin}
                        endpoint={(f) => `/recaudaciones/${f.vehiculo_id}`}
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

            {/* Modal confirmar cierre */}
            <Dialog open={showCierreModal} onOpenChange={setShowCierreModal}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                            <Lock className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Cerrar período</DialogTitle>
                            <DialogDescription className="text-xs">
                                Los valores quedarán congelados y comenzará un nuevo período inmediatamente.
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="px-5 py-4">
                        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Total a cerrar</p>
                            <p className="mt-1 text-xl font-bold text-foreground">{formatARS(totalGeneral)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {filas.length} vehículo{filas.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button type="button" variant="outline" onClick={() => setShowCierreModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleCierre} disabled={processingCierre}>
                            {processingCierre ? 'Procesando...' : 'Confirmar cierre'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

RecaudacionesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Recaudaciones',
            href: '/recaudaciones',
        },
    ],
};
