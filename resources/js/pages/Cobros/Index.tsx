import { Head, router, usePage } from '@inertiajs/react';
import {
    Box,
    Building2,
    Calendar,
    ChevronDown,
    ChevronRight,
    CircleDollarSign,
    Car,
    Download,
    FileSpreadsheet,
    HandCoins,
    History,
    Lock,
    LockOpen,
    Package,
    Receipt,
    TrendingUp,
    User,
    UserCircle2,
    Warehouse,
    Wrench,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { index, abrir, cierre, cierreDesglose } from '@/routes/cobros';
import type {
    CajaApertura,
    CierreGastoLegacy,
    CierreHistorial,
    CobroDesglose,
    CobroTransaccion,
    CobrosGastoLinea,
    CobrosGastosResumen,
    ResumenIntegradoInversion,
} from '@/types';

function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDateDia(d: string | null): string {
    if (!d) return '—';
    return new Date(`${d}T00:00:00`).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

const TIPO_LABEL: Record<string, string> = {
    galpon: 'Galpón',
    taller: 'Taller',
    oficina: 'Oficina',
    kevin: 'Kevin',
    stock: 'Stock',
    vehiculo: 'Vehículo',
};

interface Props {
    abierta: boolean;
    apertura: CajaApertura | null;
    totalGeneral: number;
    totalGanancia: number;
    totalGastos: number;
    gastosResumen: CobrosGastosResumen;
    ultimoCierre: {
        id: number;
        user: { id: number; name: string };
        created_at: string;
    } | null;
    historialCierres: CierreHistorial[];
    historialGastosLegacy: CierreGastoLegacy[];
    resumenIntegrado: ResumenIntegradoInversion[];
    totalIntegrado: number;
}

type Tab = 'inventario' | 'gastos';

export default function CobrosIndex({
    abierta,
    apertura,
    totalGeneral,
    totalGanancia,
    totalGastos,
    gastosResumen,
    ultimoCierre,
    historialCierres,
    historialGastosLegacy,
    resumenIntegrado,
    totalIntegrado,
}: Props) {
    const { auth } = usePage<any>().props;
    const isAdmin = auth.user.role === 'administrador';
    const hideEmpresa = true;

    const [tab, setTab] = useState<Tab>('inventario');

    const totalACerrar = totalGeneral + totalGastos;

    // ─── Apertura / Cierre ────────────────────────────────────────────────
    const [processingAbrir, setProcessingAbrir] = useState(false);
    const [showCierreModal, setShowCierreModal] = useState(false);
    const [processingCierre, setProcessingCierre] = useState(false);

    function handleAbrir() {
        setProcessingAbrir(true);
        router.post(
            abrir.url(),
            {},
            {
                onFinish: () => setProcessingAbrir(false),
                preserveScroll: true,
            },
        );
    }

    function handleCierre() {
        setProcessingCierre(true);
        router.post(
            cierre.url(),
            {},
            {
                onFinish: () => {
                    setProcessingCierre(false);
                    setShowCierreModal(false);
                },
                preserveScroll: true,
            },
        );
    }

    // ─── Historial Detail Modal ───────────────────────────────────────────
    const [selectedCierre, setSelectedCierre] =
        useState<CierreHistorial | null>(null);
    const [expandedDetalles, setExpandedDetalles] = useState<Set<string>>(
        new Set(),
    );
    const [desgloseCache, setDesgloseCache] = useState<
        Record<
            string,
            {
                loading: boolean;
                data: CobroDesglose[] | null;
                transacciones: CobroTransaccion[] | null;
            }
        >
    >({});
    const [expandedVehiculos, setExpandedVehiculos] = useState<Set<string>>(
        new Set(),
    );

    function vehiculoKey(detalleK: string, vehiculoId: number): string {
        return `${detalleK}::${vehiculoId}`;
    }

    function toggleVehiculo(detalleK: string, vehiculoId: number) {
        const k = vehiculoKey(detalleK, vehiculoId);
        setExpandedVehiculos((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    }

    function detalleKey(
        cierreId: number,
        inversionId: number,
        empresaId: number,
    ): string {
        return `${cierreId}-${inversionId}-${empresaId}`;
    }

    async function toggleDetalle(
        cierreId: number,
        inversionId: number,
        empresaId: number,
    ) {
        const key = detalleKey(cierreId, inversionId, empresaId);
        const isExpanded = expandedDetalles.has(key);

        setExpandedDetalles((prev) => {
            const next = new Set(prev);
            if (isExpanded) next.delete(key);
            else next.add(key);
            return next;
        });

        if (isExpanded || desgloseCache[key]?.data) return;

        setDesgloseCache((prev) => ({
            ...prev,
            [key]: { loading: true, data: null, transacciones: null },
        }));

        try {
            const res = await fetch(
                cierreDesglose.url(cierreId, {
                    query: { inversion_id: inversionId, empresa_id: empresaId },
                }),
                {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                },
            );
            const json = await res.json();
            setDesgloseCache((prev) => ({
                ...prev,
                [key]: {
                    loading: false,
                    data: json.desglose ?? [],
                    transacciones: json.transacciones ?? [],
                },
            }));
        } catch {
            setDesgloseCache((prev) => ({
                ...prev,
                [key]: { loading: false, data: [], transacciones: [] },
            }));
        }
    }

    return (
        <>
            <Head title="Cobros" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header + estado del período */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Cobros
                        </h2>
                        {abierta && apertura ? (
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                <LockOpen className="h-3.5 w-3.5" />
                                Período abierto desde {formatDate(apertura.created_at)}
                                {apertura.user?.name ? ` por ${apertura.user.name}` : ''}
                            </p>
                        ) : (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {ultimoCierre
                                    ? `Sin período abierto · último cierre ${formatDate(ultimoCierre.created_at)}`
                                    : 'Sin período abierto'}
                            </p>
                        )}
                    </div>

                    {isAdmin && (
                        <div className="flex items-center gap-2">
                            {!abierta ? (
                                <Button size="sm" onClick={handleAbrir} disabled={processingAbrir}>
                                    <LockOpen className="mr-1.5 h-4 w-4" />
                                    {processingAbrir ? 'Abriendo...' : 'Abrir período'}
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={() => setShowCierreModal(true)}
                                    disabled={totalACerrar === 0}
                                >
                                    <Lock className="mr-1.5 h-4 w-4" />
                                    Cierre de Caja
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="inline-flex w-fit rounded-lg border border-border bg-card p-1 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setTab('inventario')}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            tab === 'inventario'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Package className="h-4 w-4" />
                        Inventario
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('gastos')}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            tab === 'gastos'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <HandCoins className="h-4 w-4" />
                        Gastos
                    </button>
                </div>

                {tab === 'inventario' ? (
                    <InventarioPanel
                        resumenIntegrado={resumenIntegrado}
                        totalIntegrado={totalIntegrado}
                        totalGeneral={totalGeneral}
                        totalGanancia={totalGanancia}
                    />
                ) : (
                    <GastosPanel
                        gastosResumen={gastosResumen}
                        historialGastosLegacy={historialGastosLegacy}
                    />
                )}

                {/* Historial de Cierres (unificado) */}
                {historialCierres.length > 0 && (
                    <div className="mt-2">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">
                            Historial de Cierres
                        </h3>
                        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                            <div className="hidden md:block">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                        <tr>
                                            <th className="px-4 py-3 font-medium tracking-wider sm:px-6">Fecha</th>
                                            <th className="px-4 py-3 font-medium tracking-wider sm:px-6">Ejecutado por</th>
                                            <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">Cobros</th>
                                            <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">Gastos</th>
                                            <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">Total</th>
                                            <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {historialCierres.map((c) => (
                                            <tr key={c.id} className="transition-colors hover:bg-muted/40">
                                                <td className="px-4 py-3 sm:px-6">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                        {formatDate(c.created_at)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 sm:px-6">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                        {c.user?.name ?? 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-muted-foreground sm:px-6">
                                                    {formatARS(Number(c.total_cobros))}
                                                </td>
                                                <td className="px-4 py-3 text-right text-muted-foreground sm:px-6">
                                                    {formatARS(Number(c.total_gastos))}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium sm:px-6">
                                                    {formatARS(Number(c.total))}
                                                </td>
                                                <td className="px-4 py-3 text-right sm:px-6">
                                                    <Button variant="outline" size="sm" onClick={() => setSelectedCierre(c)}>
                                                        Ver
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile */}
                            <ul className="divide-y divide-border md:hidden">
                                {historialCierres.map((c) => (
                                    <li key={c.id} className="flex items-center justify-between p-4">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{formatDate(c.created_at)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {c.user?.name ?? 'N/A'} · Cobros {formatARS(Number(c.total_cobros))} · Gastos {formatARS(Number(c.total_gastos))}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold">{formatARS(Number(c.total))}</span>
                                            <Button variant="outline" size="sm" onClick={() => setSelectedCierre(c)}>Ver</Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Modal Cierre de Caja ──────────────────────────────────────── */}
            <Dialog open={showCierreModal} onOpenChange={setShowCierreModal}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                            <Lock className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Confirmar cierre de caja</DialogTitle>
                            <DialogDescription className="text-xs">Se cierran cobros y gastos juntos. Los totales quedarán congelados y el período se cerrará.</DialogDescription>
                        </div>
                    </div>
                    <div className="space-y-2 px-5 py-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase">Cobros</p>
                                <p className="mt-1 text-lg font-bold text-foreground">{formatARS(totalGeneral)}</p>
                            </div>
                            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase">Gastos</p>
                                <p className="mt-1 text-lg font-bold text-foreground">{formatARS(totalGastos)}</p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Total a cerrar</p>
                            <p className="mt-1 text-xl font-bold text-foreground">{formatARS(totalACerrar)}</p>
                        </div>
                    </div>
                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button type="button" variant="outline" onClick={() => setShowCierreModal(false)}>Cancelar</Button>
                        <Button type="button" onClick={handleCierre} disabled={processingCierre}>
                            {processingCierre ? 'Procesando...' : 'Confirmar cierre'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Modal Detalle Cierre Histórico ────────────────────────────── */}
            <Dialog
                open={!!selectedCierre}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedCierre(null);
                        setExpandedDetalles(new Set());
                        setExpandedVehiculos(new Set());
                    }
                }}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[640px]">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
                            <Calendar className="h-5 w-5 text-sky-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Detalle del cierre</DialogTitle>
                            <DialogDescription className="text-xs">
                                {selectedCierre && formatDate(selectedCierre.created_at)} — {selectedCierre?.user?.name ?? 'N/A'}
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 px-5 py-4">
                    <div className="max-h-[50vh] space-y-4 overflow-y-auto">
                        {(() => {
                            if (!selectedCierre) return null;
                            const grupos = selectedCierre.detalles.reduce(
                                (acc, d) => {
                                    const key = d.empresa_nombre ?? 'N/A';
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(d);
                                    return acc;
                                },
                                {} as Record<string, typeof selectedCierre.detalles>,
                            );

                            return Object.entries(grupos).map(([empresa, detalles]) => {
                                const subtotal = detalles.reduce((s, d) => s + Number(d.total), 0);
                                return (
                                    <div key={empresa} className="space-y-2">
                                        {!hideEmpresa && (
                                            <div className="flex items-center justify-between border-b border-border pb-1">
                                                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{empresa}</span>
                                                <span className="text-xs font-semibold text-muted-foreground">{formatARS(subtotal)}</span>
                                            </div>
                                        )}
                                        {detalles.map((d, idx) => {
                                            const key = detalleKey(selectedCierre.id, d.inversion_id, d.empresa_id);
                                            const isOpen = expandedDetalles.has(key);
                                            const cached = desgloseCache[key];
                                            return (
                                                <div key={idx} className="overflow-hidden rounded-lg border border-border">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleDetalle(selectedCierre.id, d.inversion_id, d.empresa_id)}
                                                        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                                                    >
                                                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                                            {d.inversion_nombre}
                                                        </span>
                                                        <span className="text-sm font-semibold text-foreground">{formatARS(Number(d.total))}</span>
                                                    </button>

                                                    {isOpen && (
                                                        <div className="border-t border-border bg-muted/20">
                                                            {cached?.loading && (
                                                                <p className="px-4 py-3 text-xs text-muted-foreground">Cargando desglose...</p>
                                                            )}
                                                            {!cached?.loading && cached?.data && cached.data.length === 0 && (
                                                                <p className="px-4 py-3 text-xs text-muted-foreground">Sin desglose disponible.</p>
                                                            )}
                                                            {!cached?.loading && cached?.data && cached.data.length > 0 && (
                                                                <ul className="divide-y divide-border">
                                                                    {cached.data.map((v) => {
                                                                        const vk = vehiculoKey(key, v.vehiculo_id);
                                                                        const vOpen = expandedVehiculos.has(vk);
                                                                        const tx = (cached.transacciones ?? []).filter((t) => t.patente === v.patente);
                                                                        return (
                                                                            <li key={v.vehiculo_id}>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleVehiculo(key, v.vehiculo_id)}
                                                                                    className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        {vOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                                                                        <Car className="h-4 w-4 text-muted-foreground" />
                                                                                        <div>
                                                                                            <p className="text-sm font-medium text-foreground">{v.patente}</p>
                                                                                            <p className="text-xs text-muted-foreground">{v.marca} {v.modelo}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <span className="text-sm font-semibold text-foreground">{formatARS(Number(v.subtotal))}</span>
                                                                                </button>

                                                                                {vOpen && (
                                                                                    <div className="border-t border-border bg-background">
                                                                                        {tx.length === 0 ? (
                                                                                            <p className="px-4 py-3 text-xs text-muted-foreground">Sin transacciones.</p>
                                                                                        ) : (
                                                                                            <table className="w-full text-left text-xs">
                                                                                                <thead className="bg-muted/30 text-[10px] tracking-wider text-muted-foreground uppercase">
                                                                                                    <tr>
                                                                                                        <th className="px-4 py-2 font-medium">Artículo</th>
                                                                                                        <th className="px-2 py-2 text-right font-medium">Cant.</th>
                                                                                                        <th className="px-2 py-2 text-right font-medium">P. Unit.</th>
                                                                                                        <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody className="divide-y divide-border">
                                                                                                    {tx.map((t) => (
                                                                                                        <tr key={t.id}>
                                                                                                            <td className="px-4 py-2 font-medium text-foreground">{t.articulo}</td>
                                                                                                            <td className="px-2 py-2 text-right text-muted-foreground">{t.cantidad}</td>
                                                                                                            <td className="px-2 py-2 text-right text-muted-foreground">{formatARS(Number(t.precio_unitario))}</td>
                                                                                                            <td className="px-4 py-2 text-right font-semibold text-foreground">{formatARS(Number(t.subtotal))}</td>
                                                                                                        </tr>
                                                                                                    ))}
                                                                                                </tbody>
                                                                                            </table>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-2 text-sm">
                            <span className="text-muted-foreground">Cobros</span>
                            <span className="font-medium text-foreground">{selectedCierre && formatARS(Number(selectedCierre.total_cobros))}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-2 text-sm">
                            <span className="text-muted-foreground">Gastos</span>
                            <span className="flex items-center gap-2 font-medium text-foreground">
                                {selectedCierre && formatARS(Number(selectedCierre.total_gastos))}
                                {selectedCierre?.gasto_cierre_id && (
                                    <Button variant="outline" size="sm" className="h-7" onClick={() => window.open(`/cierres-gasto/${selectedCierre.gasto_cierre_id}`, '_blank')}>
                                        Ver desglose
                                    </Button>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
                            <span className="text-sm font-semibold text-muted-foreground">Total</span>
                            <span className="text-lg font-bold text-foreground">{selectedCierre && formatARS(Number(selectedCierre.total))}</span>
                        </div>
                    </div>
                    </div>

                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button
                            variant="outline"
                            disabled={!selectedCierre}
                            onClick={() => { if (!selectedCierre) return; window.open(`/pdf/cierres-caja/${selectedCierre.id}`, '_blank'); }}
                        >
                            <Download className="mr-1.5 h-4 w-4" />
                            Exportar PDF
                        </Button>
                        <Button variant="outline" onClick={() => setSelectedCierre(null)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─── Panel Inventario: cobros + gastos de flota anclados a cada vehículo ────
function InventarioPanel({
    resumenIntegrado,
    totalIntegrado,
    totalGeneral,
    totalGanancia,
}: {
    resumenIntegrado: ResumenIntegradoInversion[];
    totalIntegrado: number;
    totalGeneral: number;
    totalGanancia: number;
}) {
    const [expandedIntegrado, setExpandedIntegrado] = useState<Set<number>>(new Set());
    const [expandedVeh, setExpandedVeh] = useState<Set<number>>(new Set());

    function toggleIntegrado(invId: number) {
        setExpandedIntegrado((prev) => {
            const next = new Set(prev);
            if (next.has(invId)) next.delete(invId);
            else next.add(invId);
            return next;
        });
    }

    function toggleVeh(vehId: number) {
        setExpandedVeh((prev) => {
            const next = new Set(prev);
            if (next.has(vehId)) next.delete(vehId);
            else next.add(vehId);
            return next;
        });
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Totales */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Cobros del período</p>
                            <p className="text-2xl font-bold text-foreground">{formatARS(totalGeneral)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Ganancia del período</p>
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatARS(totalGanancia)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Car className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Cobros + gastos de flota</p>
                            <p className="text-2xl font-bold text-foreground">{formatARS(totalIntegrado)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Exportar */}
            <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" disabled={totalGeneral === 0} onClick={() => window.open('/pdf/cobros', '_blank')}>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">PDF cobros</span>
                </Button>
                <Button variant="outline" size="sm" disabled={totalGeneral === 0} onClick={() => window.open('/excel/cobros', '_blank')}>
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="hidden sm:inline">Excel cobros</span>
                </Button>
                <Button variant="outline" size="sm" disabled={resumenIntegrado.length === 0} onClick={() => window.open('/pdf/cobros-integrado', '_blank')}>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">PDF integrado</span>
                </Button>
                <Button variant="outline" size="sm" disabled={resumenIntegrado.length === 0} onClick={() => window.open('/excel/cobros-integrado', '_blank')}>
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="hidden sm:inline">Excel integrado</span>
                </Button>
            </div>

            {/* Integrado por inversión → vehículo (cobros + gastos de flota) */}
            {resumenIntegrado.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                    <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-3 text-sm text-muted-foreground">No hay cobros ni gastos de flota en el período.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {resumenIntegrado.map((inv) => {
                        const open = expandedIntegrado.has(inv.inversion_id);
                        return (
                            <div key={inv.inversion_id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => toggleIntegrado(inv.inversion_id)}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                                >
                                    {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-sm font-semibold text-foreground">{inv.inversion_nombre}</span>
                                        <span className="text-xs text-muted-foreground">
                                            Cobros {formatARS(inv.total_cobros)} · Gastos {formatARS(inv.total_gastos)}
                                        </span>
                                    </div>
                                    <span className="shrink-0 text-sm font-bold text-foreground">{formatARS(inv.total)}</span>
                                </button>

                                {open && (
                                    <div className="border-t border-border">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-medium">Vehículo</th>
                                                    <th className="px-3 py-2 text-right font-medium">Cobros</th>
                                                    <th className="px-3 py-2 text-right font-medium">Gastos</th>
                                                    <th className="px-4 py-2 text-right font-medium">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {inv.vehiculos.map((v) => {
                                                    const vOpen = expandedVeh.has(v.vehiculo_id);
                                                    return (
                                                        <Fragment key={v.vehiculo_id}>
                                                            <tr className="cursor-pointer hover:bg-muted/20" onClick={() => toggleVeh(v.vehiculo_id)}>
                                                                <td className="px-4 py-2">
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                        {vOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                                                        <span className="font-mono font-medium text-foreground">{v.patente}</span>
                                                                        <span className="text-xs text-muted-foreground">{v.marca} {v.modelo}</span>
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-muted-foreground">{formatARS(v.cobros)}</td>
                                                                <td className="px-3 py-2 text-right text-muted-foreground">{formatARS(v.gastos)}</td>
                                                                <td className="px-4 py-2 text-right font-semibold text-foreground">{formatARS(v.total)}</td>
                                                            </tr>
                                                            {vOpen && (
                                                                <tr className="bg-muted/10">
                                                                    <td colSpan={4} className="px-4 py-3">
                                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                                            <div>
                                                                                <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Cobros (inventario)</p>
                                                                                {v.cobros_detalle.length === 0 ? (
                                                                                    <p className="text-xs text-muted-foreground">Sin cobros.</p>
                                                                                ) : (
                                                                                    <ul className="flex flex-col gap-0.5">
                                                                                        {v.cobros_detalle.map((c, i) => (
                                                                                            <li key={i} className="flex justify-between gap-2 text-xs">
                                                                                                <span className="text-foreground">{c.articulo} <span className="text-muted-foreground">×{c.cantidad}</span></span>
                                                                                                <span className="shrink-0 text-muted-foreground">{formatARS(c.subtotal)}</span>
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Gastos de flota</p>
                                                                                {v.gastos_detalle.length === 0 ? (
                                                                                    <p className="text-xs text-muted-foreground">Sin gastos.</p>
                                                                                ) : (
                                                                                    <ul className="flex flex-col gap-0.5">
                                                                                        {v.gastos_detalle.map((g, i) => (
                                                                                            <li key={i} className="flex justify-between gap-2 text-xs">
                                                                                                <span className="text-foreground">
                                                                                                    {g.fecha ? `${g.fecha.slice(8, 10)}/${g.fecha.slice(5, 7)} · ` : ''}
                                                                                                    {g.descripcion?.trim() || g.recibio || 'Gasto'}
                                                                                                </span>
                                                                                                <span className="shrink-0 text-muted-foreground">{formatARS(g.monto)}</span>
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Panel Gastos: todo menos flota, estructurado como /gastos (solo lectura) ─
const CATEGORIAS: { key: string; label: string; tipos: string[]; icon: React.ReactNode }[] = [
    { key: 'galpon', label: 'Galpón', tipos: ['galpon'], icon: <Building2 className="h-5 w-5 text-muted-foreground" /> },
    { key: 'taller', label: 'Taller', tipos: ['taller'], icon: <Wrench className="h-5 w-5 text-muted-foreground" /> },
    { key: 'oficina', label: 'Oficina', tipos: ['oficina'], icon: <Building2 className="h-5 w-5 text-muted-foreground" /> },
    { key: 'stock', label: 'Stock', tipos: ['stock'], icon: <Box className="h-5 w-5 text-muted-foreground" /> },
    { key: 'kevin', label: 'Kevin', tipos: ['kevin'], icon: <UserCircle2 className="h-5 w-5 text-muted-foreground" /> },
];

function cardIcon(key: string): React.ReactNode {
    const cls = 'h-5 w-5 text-muted-foreground';
    if (key === 'kevin') return <UserCircle2 className={cls} />;
    if (key === 'galpon') return <Warehouse className={cls} />;
    return <HandCoins className={cls} />;
}

function GastosPanel({
    gastosResumen,
    historialGastosLegacy,
}: {
    gastosResumen: CobrosGastosResumen;
    historialGastosLegacy: CierreGastoLegacy[];
}) {
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

    function toggleCat(key: string) {
        setExpandedCats((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    const gastosByCat = useMemo(() => {
        const map: Record<string, CobrosGastoLinea[]> = {};
        for (const cat of CATEGORIAS) map[cat.key] = [];
        for (const g of gastosResumen.gastos) {
            const cat = CATEGORIAS.find((c) => c.tipos.includes(g.tipo));
            if (cat) map[cat.key].push(g);
        }
        return map;
    }, [gastosResumen.gastos]);

    const allCards = [
        ...gastosResumen.cards,
        { key: 'general', label: 'Total', total: gastosResumen.total },
    ];

    function renderLista(list: CobrosGastoLinea[]) {
        if (list.length === 0) {
            return <p className="px-2 py-4 text-center text-xs text-muted-foreground">Sin gastos en esta categoría.</p>;
        }
        return (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                        <tr>
                            <th className="px-3 py-2 font-medium">Fecha</th>
                            <th className="px-3 py-2 font-medium">Descripción</th>
                            <th className="px-3 py-2 font-medium">Recibió</th>
                            <th className="px-3 py-2 font-medium">Método</th>
                            <th className="px-3 py-2 text-right font-medium">Monto</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {list.map((g) => (
                            <tr key={g.id} className="hover:bg-muted/20">
                                <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{formatDateDia(g.fecha)}</td>
                                <td className="px-3 py-2 font-medium text-foreground">{g.descripcion?.trim() || 'Sin descripción'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-foreground">{g.recibio ?? '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-foreground capitalize">{g.metodo_pago}</td>
                                <td className="px-3 py-2 text-right font-bold whitespace-nowrap text-foreground">{formatARS(Number(g.monto))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
                Gastos del período sin la flota (la flota se ve en Inventario, anclada a cada vehículo). Solo lectura — el alta se hace en{' '}
                <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => router.get('/gastos')}>
                    Gastos
                </button>
                .
            </p>

            {/* Cards de totales */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {allCards.map((card) => {
                    const isGeneral = card.key === 'general';
                    return (
                        <div key={card.key} className={`rounded-xl border p-4 shadow-sm ${isGeneral ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">{cardIcon(card.key)}</div>
                                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{card.label}</p>
                            </div>
                            <p className="mt-2 text-xl font-bold text-foreground">{formatARS(Number(card.total))}</p>
                        </div>
                    );
                })}
            </div>

            {/* Últimos gastos */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Últimos gastos</h3>
                </div>
                {gastosResumen.ultimos.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay gastos en el período.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Fecha</th>
                                    <th className="px-3 py-2 font-medium">Descripción</th>
                                    <th className="px-3 py-2 font-medium">Categoría</th>
                                    <th className="px-3 py-2 font-medium">Recibió</th>
                                    <th className="px-3 py-2 text-right font-medium">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {gastosResumen.ultimos.map((g) => (
                                    <tr key={g.id} className="hover:bg-muted/20">
                                        <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{formatDateDia(g.fecha)}</td>
                                        <td className="px-3 py-2 font-medium text-foreground">{g.descripcion?.trim() || 'Sin descripción'}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-foreground">{TIPO_LABEL[g.tipo] ?? g.tipo}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-foreground">{g.recibio ?? '—'}</td>
                                        <td className="px-3 py-2 text-right font-bold whitespace-nowrap text-foreground">{formatARS(Number(g.monto))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Desglose por categoría */}
            {gastosResumen.count === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                    <HandCoins className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-3 text-sm text-muted-foreground">No hay gastos en el período.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {CATEGORIAS.map((cat) => {
                        const catGastos = gastosByCat[cat.key] ?? [];
                        const catOpen = expandedCats.has(cat.key);
                        const catTotal = catGastos.reduce((s, g) => s + Number(g.monto), 0);
                        return (
                            <div key={cat.key} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => toggleCat(cat.key)}
                                    className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        {catOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">{cat.icon}</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-foreground">{cat.label}</p>
                                            <p className="text-xs text-muted-foreground">{catGastos.length} gasto{catGastos.length !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-base font-bold text-foreground">{formatARS(catTotal)}</span>
                                </button>
                                {catOpen && <div className="border-t border-border bg-muted/10 p-2">{renderLista(catGastos)}</div>}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Cierres de gastos legacy */}
            {historialGastosLegacy.length > 0 && (
                <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Cierres de gastos anteriores</h3>
                    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <ul className="divide-y divide-border">
                            {historialGastosLegacy.map((c) => (
                                <li key={c.id} className="flex items-center justify-between px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{c.periodo_fin ? formatDate(c.periodo_fin) : formatDate(c.created_at)}</p>
                                        <p className="text-xs text-muted-foreground">{c.user?.name ?? 'N/A'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{formatARS(Number(c.total))}</span>
                                        <Button variant="outline" size="sm" onClick={() => window.open(`/cierres-gasto/${c.id}`, '_blank')}>Ver</Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

CobrosIndex.layout = {
    breadcrumbs: [
        {
            title: 'Cobros',
            href: index.url(),
        },
    ],
};
