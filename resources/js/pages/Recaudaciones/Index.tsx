import { Head, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    ClipboardList,
    Coins,
    Download,
    FileDown,
    FileSpreadsheet,
    History,
    Lock,
    Percent,
    Target,
    Unlock,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    formatARS,
    formatDate,
    RecaudacionesTabla,
    ResumenRecaudacionModal,
} from '@/components/recaudaciones-tabla';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { RecaudacionFila } from '@/types';

interface Props {
    abierta: boolean;
    apertura: {
        id: number;
        user: { id: number; name: string } | null;
        created_at: string;
    } | null;
    filas: RecaudacionFila[];
    totalGeneral: number;
    gananciaPotencial: number;
    ultimoCierre: {
        id: number;
        user: { id: number; name: string } | null;
        created_at: string;
    } | null;
}

export default function RecaudacionesIndex({
    abierta,
    apertura,
    filas,
    totalGeneral,
    gananciaPotencial,
    ultimoCierre,
}: Props) {
    const { auth } = usePage<any>().props;
    const isAdmin = auth?.user?.role === 'administrador';

    const [showCierreModal, setShowCierreModal] = useState(false);
    const [showAbrirModal, setShowAbrirModal] = useState(false);
    const [showResumenModal, setShowResumenModal] = useState(false);
    const [showDescuentosModal, setShowDescuentosModal] = useState(false);
    const [processingCierre, setProcessingCierre] = useState(false);
    const [processingAbrir, setProcessingAbrir] = useState(false);

    const hayDeudores = useMemo(
        () => filas.some((f) => f.estado === 'deuda'),
        [filas],
    );

    const filasConDescuento = useMemo(
        () => filas
            .filter((f) => Number(f.descuento) > 0)
            .sort((a, b) => a.patente.localeCompare(b.patente, 'es', { numeric: true })),
        [filas],
    );

    const totalDescuentos = useMemo(
        () => filasConDescuento.reduce((s, f) => s + Number(f.descuento), 0),
        [filasConDescuento],
    );

    // Porcentaje del potencial de la flota que ya está recaudado en este período.
    const porcentajeAlcanzado =
        gananciaPotencial > 0
            ? Math.round((totalGeneral / gananciaPotencial) * 100)
            : 0;


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

    function handleAbrir() {
        setProcessingAbrir(true);
        router.post(
            '/recaudaciones/abrir',
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setProcessingAbrir(false);
                    setShowAbrirModal(false);
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
                        <h2 className="text-lg font-semibold text-foreground">
                            Recaudaciones
                        </h2>
                        {abierta && apertura ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Recaudación abierta el{' '}
                                {formatDate(apertura.created_at)} por{' '}
                                {apertura.user?.name ?? 'N/A'}
                            </p>
                        ) : ultimoCierre ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Último cierre:{' '}
                                {formatDate(ultimoCierre.created_at)} por{' '}
                                {ultimoCierre.user?.name ?? 'N/A'}
                            </p>
                        ) : (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Sin cierres de recaudación previos
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                router.get('/recaudaciones/historial')
                            }
                        >
                            <History className="mr-1.5 h-4 w-4" />
                            Historial
                        </Button>
                        {abierta && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowResumenModal(true)}
                                    disabled={filas.length === 0}
                                >
                                    <ClipboardList className="mr-1.5 h-4 w-4" />
                                    Resumen
                                </Button>
                                {filasConDescuento.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowDescuentosModal(true)}
                                    >
                                        <Percent className="mr-1.5 h-4 w-4 text-amber-500" />
                                        Descuentos
                                    </Button>
                                )}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <Target className="mr-1.5 h-4 w-4 text-indigo-500" />
                                            Potencial
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-72 p-0">
                                        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
                                                <Target className="h-5 w-5 text-indigo-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground">
                                                    Ganancia potencial
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Si todos los autos estuvieran alquilados.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3">
                                            <p className="text-2xl font-bold tabular-nums text-foreground">
                                                {formatARS(gananciaPotencial)}
                                            </p>
                                            <div className="mt-3 flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground">
                                                        Recaudado
                                                    </span>
                                                    <span className="font-medium tabular-nums text-foreground">
                                                        {formatARS(totalGeneral)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground">
                                                        Alcanzado
                                                    </span>
                                                    <span className="font-medium tabular-nums text-foreground">
                                                        {porcentajeAlcanzado}%
                                                    </span>
                                                </div>
                                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-indigo-500 transition-all"
                                                        style={{
                                                            width: `${Math.min(porcentajeAlcanzado, 100)}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" disabled={filas.length === 0}>
                                            <Download className="mr-1.5 h-4 w-4" />
                                            Exportar
                                            <ChevronDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => window.open('/pdf/recaudaciones-actuales', '_blank')}>
                                            <Download className="mr-2 h-4 w-4" />
                                            PDF período actual
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => window.open('/excel/recaudaciones-actuales', '_blank')}>
                                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                                            Excel período actual
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => window.open('/pdf/recaudaciones-deudores', '_blank')}
                                            disabled={!hayDeudores}
                                        >
                                            <FileDown className="mr-2 h-4 w-4" />
                                            PDF deudores
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
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
                            </>
                        )}
                        {!abierta && isAdmin && (
                            <Button
                                size="sm"
                                onClick={() => setShowAbrirModal(true)}
                            >
                                <Unlock className="mr-1.5 h-4 w-4" />
                                Abrir recaudación
                            </Button>
                        )}
                    </div>
                </div>

                {/* Contenido */}
                {!abierta ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <Coins className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            No hay una recaudación abierta.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {isAdmin
                                ? 'Abrí una recaudación para congelar la lista de vehículos y choferes del momento.'
                                : 'Esperá a que un administrador abra la recaudación.'}
                        </p>
                    </div>
                ) : filas.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <Coins className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            La recaudación abierta no tiene vehículos.
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

            {/* Modal descuentos */}
            <Dialog open={showDescuentosModal} onOpenChange={setShowDescuentosModal}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                            <Percent className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Descuentos del período</DialogTitle>
                            <DialogDescription className="text-xs">
                                {filasConDescuento.length} auto{filasConDescuento.length !== 1 ? 's' : ''} con descuento — total {formatARS(totalDescuentos)}
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-2.5 font-medium tracking-wider">Patente</th>
                                    <th className="px-4 py-2.5 font-medium tracking-wider">Chofer</th>
                                    <th className="px-4 py-2.5 text-right font-medium tracking-wider">Descuento</th>
                                    <th className="px-4 py-2.5 font-medium tracking-wider">Descripción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filasConDescuento.map((f) => (
                                    <tr key={f.id ?? f.vehiculo_id} className="bg-card hover:bg-muted/40">
                                        <td className="px-4 py-2.5 font-mono font-medium text-foreground">{f.patente}</td>
                                        <td className="px-4 py-2.5 text-foreground">{f.chofer}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatARS(Number(f.descuento))}</td>
                                        <td className="px-4 py-2.5 text-muted-foreground">{f.descripcion || <span className="italic">—</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-border bg-muted/30">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 font-semibold text-foreground">Total descuentos</td>
                                    <td className="px-4 py-3 text-right text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatARS(totalDescuentos)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <DialogFooter className="border-t border-border px-5 py-4">
                        <Button variant="outline" onClick={() => setShowDescuentosModal(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal resumen por inversión */}
            <ResumenRecaudacionModal
                open={showResumenModal}
                onOpenChange={setShowResumenModal}
                filas={filas}
                totalGeneral={totalGeneral}
            />

            {/* Modal confirmar apertura */}
            <Dialog open={showAbrirModal} onOpenChange={setShowAbrirModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Abrir recaudación</DialogTitle>
                        <DialogDescription>
                            Se bloquearán los vehículos con chofer asignado en
                            este momento. La lista y los choferes quedarán
                            congelados: aunque luego se reasignen o desasignen
                            vehículos, esta recaudación no cambiará hasta
                            cerrarla.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAbrirModal(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleAbrir}
                            disabled={processingAbrir}
                        >
                            {processingAbrir
                                ? 'Procesando...'
                                : 'Abrir recaudación'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal confirmar cierre */}
            <Dialog open={showCierreModal} onOpenChange={setShowCierreModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Confirmar cierre de recaudaciones
                        </DialogTitle>
                        <DialogDescription>
                            Se registrará el cierre del período actual y los
                            valores quedarán congelados. El período quedará
                            cerrado hasta que abras una nueva recaudación.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase">
                            Total a cerrar
                        </p>
                        <p className="mt-1 text-xl font-bold text-foreground">
                            {formatARS(totalGeneral)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {filas.length} vehículo
                            {filas.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowCierreModal(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleCierre}
                            disabled={processingCierre}
                        >
                            {processingCierre
                                ? 'Procesando...'
                                : 'Confirmar cierre'}
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
