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
    EstadoBadge,
    formatARS,
    formatDate,
    RecaudacionesTabla,
    ResumenRecaudacionModal,
} from '@/components/recaudaciones-tabla';
import { MoneyInput } from '@/components/money-input';
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

interface DeudorInversion {
    inversion_id: number;
    inversion: string;
    empresa: string;
    deuda: number;
}

interface Deudor {
    user_id: number;
    name: string;
    deuda_total: number;
    inversiones: DeudorInversion[];
}

interface EmpresaCierre {
    id: number;
    nombre: string;
    apertura_abierta: boolean;
    total_recaudado: number;
}

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
    cierreUnificado: {
        empresas: EmpresaCierre[];
        deudores: Deudor[];
        vehiculosCruzados: string[];
    };
}

export default function RecaudacionesIndex({
    abierta,
    apertura,
    filas,
    totalGeneral,
    gananciaPotencial,
    ultimoCierre,
    cierreUnificado,
}: Props) {
    const { auth } = usePage<any>().props;
    const isAdmin = auth?.user?.role === 'administrador';

    const [showCierreModal, setShowCierreModal] = useState(false);
    const [showAbrirModal, setShowAbrirModal] = useState(false);
    const [showResumenModal, setShowResumenModal] = useState(false);
    const [showDescuentosModal, setShowDescuentosModal] = useState(false);
    const [filterInversionDescuento, setFilterInversionDescuento] = useState('');
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

    const inversionesConDescuento = useMemo(
        () => [...new Set(filasConDescuento.map((f) => f.inversion_nombre))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
        [filasConDescuento],
    );

    const filasConDescuentoFiltradas = useMemo(
        () => filterInversionDescuento
            ? filasConDescuento.filter((f) => f.inversion_nombre === filterInversionDescuento)
            : filasConDescuento,
        [filasConDescuento, filterInversionDescuento],
    );

    const totalDescuentos = useMemo(
        () => filasConDescuentoFiltradas.reduce((s, f) => s + Number(f.descuento), 0),
        [filasConDescuentoFiltradas],
    );

    // Porcentaje del potencial de la flota que ya está recaudado en este período.
    const porcentajeAlcanzado =
        gananciaPotencial > 0
            ? Math.round((totalGeneral / gananciaPotencial) * 100)
            : 0;

    // ── Cierre unificado: solo la tasa. La decisión "abona / no abona" de cada
    //    socio deudor se ajusta después, en el detalle del cierre (editable).
    const todasAbiertas = cierreUnificado.empresas.every((e) => e.apertura_abierta);
    const totalACerrar = cierreUnificado.empresas.reduce((s, e) => s + e.total_recaudado, 0);

    const [tasa, setTasa] = useState('');

    function abrirModalCierre() {
        setTasa('');
        setShowCierreModal(true);
    }

    function handleCierre() {
        setProcessingCierre(true);
        router.post(
            '/recaudaciones/cierre',
            { tasa },
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
                                        onClick={abrirModalCierre}
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
            <Dialog open={showDescuentosModal} onOpenChange={(v) => { setShowDescuentosModal(v); if (!v) setFilterInversionDescuento(''); }}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[600px]">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                            <Percent className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Descuentos del período</DialogTitle>
                            <DialogDescription className="text-xs">
                                {filasConDescuento.length} auto{filasConDescuento.length !== 1 ? 's' : ''} con descuento — total {formatARS(filasConDescuento.reduce((s, f) => s + Number(f.descuento), 0))}
                            </DialogDescription>
                        </div>
                    </div>

                    {/* Filtro por inversión */}
                    {inversionesConDescuento.length > 1 && (
                        <div className="border-b border-border px-5 py-3">
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setFilterInversionDescuento('')}
                                    className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${filterInversionDescuento === '' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                                >
                                    Todas
                                </button>
                                {inversionesConDescuento.map((inv) => (
                                    <button
                                        key={inv}
                                        type="button"
                                        onClick={() => setFilterInversionDescuento(inv === filterInversionDescuento ? '' : inv)}
                                        className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${filterInversionDescuento === inv ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                                    >
                                        {inv}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="max-h-[55vh] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-2.5 font-medium tracking-wider">Patente</th>
                                    <th className="px-4 py-2.5 font-medium tracking-wider">Chofer</th>
                                    <th className="px-4 py-2.5 text-right font-medium tracking-wider">Descuento</th>
                                    <th className="px-4 py-2.5 font-medium tracking-wider">Descripción</th>
                                    <th className="px-4 py-2.5 font-medium tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filasConDescuentoFiltradas.map((f) => (
                                    <tr key={f.id ?? f.vehiculo_id} className="bg-card hover:bg-muted/40">
                                        <td className="px-4 py-2.5 font-mono font-medium text-foreground">{f.patente}</td>
                                        <td className="px-4 py-2.5 text-foreground">{f.chofer}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatARS(Number(f.descuento))}</td>
                                        <td className="px-4 py-2.5 text-muted-foreground">{f.descripcion || <span className="italic">—</span>}</td>
                                        <td className="px-4 py-2.5"><EstadoBadge estado={f.estado} deuda={Number(f.deuda)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-border bg-muted/30">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 font-semibold text-foreground">Total descuentos</td>
                                    <td className="px-4 py-3 text-right text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatARS(totalDescuentos)}</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <DialogFooter className="flex-wrap gap-2 border-t border-border px-5 py-4">
                        <Button variant="outline" size="sm" onClick={() => window.open('/pdf/recaudaciones-descuentos', '_blank')}>
                            <FileDown className="mr-1.5 h-4 w-4" />
                            PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.open('/excel/recaudaciones-descuentos', '_blank')}>
                            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                            Excel
                        </Button>
                        <Button variant="outline" onClick={() => { setShowDescuentosModal(false); setFilterInversionDescuento(''); }}>Cerrar</Button>
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

            {/* Modal cierre unificado: ambas empresas + tasa + abonos */}
            <Dialog open={showCierreModal} onOpenChange={setShowCierreModal}>
                <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Cierre unificado de recaudaciones</DialogTitle>
                        <DialogDescription>
                            Se cierran las recaudaciones de las dos empresas a la
                            vez y se calcula el sueldo de cada socio. Los abonos de
                            los deudores se ajustan después, en el detalle del cierre.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Estado por empresa */}
                    <div className="mt-3 flex flex-col gap-2">
                        {cierreUnificado.empresas.map((e) => (
                            <div
                                key={e.id}
                                className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-2.5"
                            >
                                <div>
                                    <p className="text-sm font-medium text-foreground">{e.nombre}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {e.apertura_abierta
                                            ? `Recaudado: ${formatARS(e.total_recaudado)}`
                                            : 'Sin recaudación abierta'}
                                    </p>
                                </div>
                                {e.apertura_abierta ? (
                                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                        Abierta
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                                        Cerrada
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {cierreUnificado.vehiculosCruzados.length > 0 && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                            Hay vehículos asignados a una inversión de otra
                            empresa: <strong>{cierreUnificado.vehiculosCruzados.join(', ')}</strong>.
                            Corregí la inversión de esos vehículos antes de cerrar.
                        </div>
                    )}

                    {!todasAbiertas ? (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                            Para ejecutar el cierre unificado, todas las empresas
                            deben tener su recaudación abierta.
                        </div>
                    ) : (
                        <>
                            {/* Tasa */}
                            <div className="mt-4">
                                <label className="text-xs font-medium text-muted-foreground uppercase">
                                    Tasa de cambio (ARS por 1 USD)
                                </label>
                                <MoneyInput
                                    value={tasa === '' ? null : Number(tasa)}
                                    onValueChange={(n) => setTasa(n == null ? '' : String(n))}
                                    placeholder="Ej: 1.450,00"
                                    className="mt-1 w-full"
                                />
                            </div>

                            {/* Aviso: los abonos se ajustan después, en el detalle */}
                            <div className="mt-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                                Los sueldos se calculan como si todos los socios abonaran.
                                Después, en el detalle del cierre, marcás por socio si
                                <strong className="text-foreground"> abona o no</strong> y el
                                importe del abono — el cierre se recalcula en vivo.
                            </div>

                            {/* Total */}
                            <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                    Total a cerrar (ambas empresas)
                                </p>
                                <p className="mt-1 text-xl font-bold text-foreground">
                                    {formatARS(totalACerrar)}
                                </p>
                            </div>
                        </>
                    )}

                    <DialogFooter className="mt-4">
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
                            disabled={
                                processingCierre ||
                                !todasAbiertas ||
                                cierreUnificado.vehiculosCruzados.length > 0 ||
                                !tasa ||
                                Number(tasa) <= 0
                            }
                        >
                            {processingCierre
                                ? 'Procesando...'
                                : 'Cerrar y calcular sueldos'}
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
