import { Head, router, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Calendar,
    ChevronDown,
    ChevronRight,
    CircleDollarSign,
    Car,
    Lock,
    Receipt,
    User,
    Download,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { index, show, cierre, cierreDesglose } from '@/routes/cobros';
import type {
    CierreHistorial,
    CobroDesglose,
    CobroResumenInversion,
    CobroTransaccion,
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

interface Props {
    resumen: CobroResumenInversion[];
    totalGeneral: number;
    ultimoCierre: {
        id: number;
        user: { id: number; name: string };
        created_at: string;
    } | null;
    historialCierres: CierreHistorial[];
}

export default function CobrosIndex({
    resumen,
    totalGeneral,
    ultimoCierre,
    historialCierres,
}: Props) {
    const { auth } = usePage<any>().props;
    const isAdmin = auth.user.role === 'administrador';
    const isInversor = auth.user.role === 'inversor';
    const empresaRestringidaId = (auth?.user?.empresa_restringida_id as number | null | undefined) ?? null;
    const hideEmpresa = isInversor || empresaRestringidaId != null;

    // ─── Cierre de Caja Modal ─────────────────────────────────────────────
    const [showCierreModal, setShowCierreModal] = useState(false);
    const [processingCierre, setProcessingCierre] = useState(false);

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
                    query: {
                        inversion_id: inversionId,
                        empresa_id: empresaId,
                    },
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

    return (
        <>
            <Head title="Cobros" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Cobros por Inversión
                        </h2>
                        {ultimoCierre && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Último cierre:{' '}
                                {formatDate(ultimoCierre.created_at)} por{' '}
                                {ultimoCierre.user?.name ?? 'N/A'}
                            </p>
                        )}
                        {!ultimoCierre && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Sin cierres de caja previos
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={resumen.length === 0}
                            onClick={() => {
                                window.open('/pdf/cobros', '_blank');
                            }}
                        >
                            <Download className="mr-1.5 h-4 w-4" />
                            Exportar PDF
                        </Button>
                        {isAdmin && (
                            <Button
                                size="sm"
                                onClick={() => setShowCierreModal(true)}
                                disabled={resumen.length === 0}
                            >
                                <Lock className="mr-1.5 h-4 w-4" />
                                Cierre de Caja
                            </Button>
                        )}
                    </div>
                </div>

                {/* Total General Card */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                Total de la semana actual
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                                {formatARS(totalGeneral)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Inversiones Grid */}
                {resumen.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            No hay cobros pendientes en la semana actual.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {resumen.map((inv) => (
                            <button
                                key={`${inv.inversion_id}-${inv.empresa_id}`}
                                type="button"
                                onClick={() =>
                                    router.get(
                                        show.url(inv.inversion_id, {
                                            query: {
                                                empresa_id: inv.empresa_id,
                                            },
                                        }),
                                    )
                                }
                                className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {inv.inversion_nombre}
                                    </p>
                                    {!hideEmpresa && (
                                        <p className="text-xs text-muted-foreground">
                                            {inv.empresa_nombre}
                                        </p>
                                    )}
                                    <p className="mt-1 text-lg font-bold text-foreground">
                                        {formatARS(Number(inv.total))}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {inv.transacciones_count} transacción
                                        {inv.transacciones_count !== 1
                                            ? 'es'
                                            : ''}
                                    </p>
                                </div>
                                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Historial de Cierres */}
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
                                            <th className="px-4 py-3 font-medium tracking-wider sm:px-6">
                                                Fecha
                                            </th>
                                            <th className="px-4 py-3 font-medium tracking-wider sm:px-6">
                                                Ejecutado por
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">
                                                Total
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">
                                                Detalle
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {historialCierres.map((c) => (
                                            <tr
                                                key={c.id}
                                                className="transition-colors hover:bg-muted/40"
                                            >
                                                <td className="px-4 py-3 sm:px-6">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                        {formatDate(
                                                            c.created_at,
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 sm:px-6">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                        {c.user?.name ?? 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium sm:px-6">
                                                    {formatARS(Number(c.total))}
                                                </td>
                                                <td className="px-4 py-3 text-right sm:px-6">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setSelectedCierre(c)
                                                        }
                                                    >
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
                                    <li
                                        key={c.id}
                                        className="flex items-center justify-between p-4"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {formatDate(c.created_at)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {c.user?.name ?? 'N/A'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold">
                                                {formatARS(Number(c.total))}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setSelectedCierre(c)
                                                }
                                            >
                                                Ver
                                            </Button>
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Cierre de Caja</DialogTitle>
                        <DialogDescription>
                            Se registrará el cierre del período actual y los
                            totales quedarán congelados. Un nuevo período
                            comenzará inmediatamente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase">
                            Total a cerrar
                        </p>
                        <p className="mt-1 text-xl font-bold text-foreground">
                            {formatARS(totalGeneral)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {resumen.length} inversión
                            {resumen.length !== 1 ? 'es' : ''} con cobros
                            pendientes
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
                                : 'Confirmar Cierre'}
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Detalle del Cierre</DialogTitle>
                        <DialogDescription>
                            {selectedCierre &&
                                formatDate(selectedCierre.created_at)}{' '}
                            — {selectedCierre?.user?.name ?? 'N/A'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] space-y-4 overflow-y-auto">
                        {(() => {
                            if (!selectedCierre) return null;
                            const grupos = selectedCierre.detalles.reduce(
                                (acc, d) => {
                                    const key = d.empresa_nombre ?? 'N/A';
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(d);
                                    return acc;
                                },
                                {} as Record<
                                    string,
                                    typeof selectedCierre.detalles
                                >,
                            );

                            return Object.entries(grupos).map(
                                ([empresa, detalles]) => {
                                    const subtotal = detalles.reduce(
                                        (s, d) => s + Number(d.total),
                                        0,
                                    );
                                    return (
                                        <div
                                            key={empresa}
                                            className="space-y-2"
                                        >
                                            {!hideEmpresa && (
                                                <div className="flex items-center justify-between border-b border-border pb-1">
                                                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                        {empresa}
                                                    </span>
                                                    <span className="text-xs font-semibold text-muted-foreground">
                                                        {formatARS(subtotal)}
                                                    </span>
                                                </div>
                                            )}
                                            {detalles.map((d, idx) => {
                                                const key = detalleKey(
                                                    selectedCierre.id,
                                                    d.inversion_id,
                                                    d.empresa_id,
                                                );
                                                const isOpen =
                                                    expandedDetalles.has(key);
                                                const cached =
                                                    desgloseCache[key];
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="overflow-hidden rounded-lg border border-border"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                toggleDetalle(
                                                                    selectedCierre.id,
                                                                    d.inversion_id,
                                                                    d.empresa_id,
                                                                )
                                                            }
                                                            className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                                                        >
                                                            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                                {isOpen ? (
                                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                ) : (
                                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                                {
                                                                    d.inversion_nombre
                                                                }
                                                            </span>
                                                            <span className="text-sm font-semibold text-foreground">
                                                                {formatARS(
                                                                    Number(
                                                                        d.total,
                                                                    ),
                                                                )}
                                                            </span>
                                                        </button>

                                                        {isOpen && (
                                                            <div className="border-t border-border bg-muted/20">
                                                                {cached?.loading && (
                                                                    <p className="px-4 py-3 text-xs text-muted-foreground">
                                                                        Cargando
                                                                        desglose...
                                                                    </p>
                                                                )}
                                                                {!cached?.loading &&
                                                                    cached?.data &&
                                                                    cached.data
                                                                        .length ===
                                                                        0 && (
                                                                        <p className="px-4 py-3 text-xs text-muted-foreground">
                                                                            Sin
                                                                            desglose
                                                                            disponible.
                                                                        </p>
                                                                    )}
                                                                {!cached?.loading &&
                                                                    cached?.data &&
                                                                    cached.data
                                                                        .length >
                                                                        0 && (
                                                                        <ul className="divide-y divide-border">
                                                                            {cached.data.map(
                                                                                (
                                                                                    v,
                                                                                ) => {
                                                                                    const vk =
                                                                                        vehiculoKey(
                                                                                            key,
                                                                                            v.vehiculo_id,
                                                                                        );
                                                                                    const vOpen =
                                                                                        expandedVehiculos.has(
                                                                                            vk,
                                                                                        );
                                                                                    const tx =
                                                                                        (cached.transacciones ??
                                                                                            []).filter(
                                                                                            (
                                                                                                t,
                                                                                            ) =>
                                                                                                t.patente ===
                                                                                                v.patente,
                                                                                        );
                                                                                    return (
                                                                                        <li
                                                                                            key={
                                                                                                v.vehiculo_id
                                                                                            }
                                                                                        >
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    toggleVehiculo(
                                                                                                        key,
                                                                                                        v.vehiculo_id,
                                                                                                    )
                                                                                                }
                                                                                                className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                                                                                            >
                                                                                                <div className="flex items-center gap-2">
                                                                                                    {vOpen ? (
                                                                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                                                    ) : (
                                                                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                                                                    )}
                                                                                                    <Car className="h-4 w-4 text-muted-foreground" />
                                                                                                    <div>
                                                                                                        <p className="text-sm font-medium text-foreground">
                                                                                                            {
                                                                                                                v.patente
                                                                                                            }
                                                                                                        </p>
                                                                                                        <p className="text-xs text-muted-foreground">
                                                                                                            {
                                                                                                                v.marca
                                                                                                            }{' '}
                                                                                                            {
                                                                                                                v.modelo
                                                                                                            }
                                                                                                        </p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <span className="text-sm font-semibold text-foreground">
                                                                                                    {formatARS(
                                                                                                        Number(
                                                                                                            v.subtotal,
                                                                                                        ),
                                                                                                    )}
                                                                                                </span>
                                                                                            </button>

                                                                                            {vOpen && (
                                                                                                <div className="border-t border-border bg-background">
                                                                                                    {tx.length ===
                                                                                                    0 ? (
                                                                                                        <p className="px-4 py-3 text-xs text-muted-foreground">
                                                                                                            Sin
                                                                                                            transacciones.
                                                                                                        </p>
                                                                                                    ) : (
                                                                                                        <table className="w-full text-left text-xs">
                                                                                                            <thead className="bg-muted/30 text-[10px] tracking-wider text-muted-foreground uppercase">
                                                                                                                <tr>
                                                                                                                    <th className="px-4 py-2 font-medium">
                                                                                                                        Artículo
                                                                                                                    </th>
                                                                                                                    <th className="px-2 py-2 text-right font-medium">
                                                                                                                        Cant.
                                                                                                                    </th>
                                                                                                                    <th className="px-2 py-2 text-right font-medium">
                                                                                                                        P.
                                                                                                                        Unit.
                                                                                                                    </th>
                                                                                                                    <th className="px-4 py-2 text-right font-medium">
                                                                                                                        Subtotal
                                                                                                                    </th>
                                                                                                                </tr>
                                                                                                            </thead>
                                                                                                            <tbody className="divide-y divide-border">
                                                                                                                {tx.map(
                                                                                                                    (
                                                                                                                        t,
                                                                                                                    ) => (
                                                                                                                        <tr
                                                                                                                            key={
                                                                                                                                t.id
                                                                                                                            }
                                                                                                                        >
                                                                                                                            <td className="px-4 py-2 font-medium text-foreground">
                                                                                                                                {
                                                                                                                                    t.articulo
                                                                                                                                }
                                                                                                                            </td>
                                                                                                                            <td className="px-2 py-2 text-right text-muted-foreground">
                                                                                                                                {
                                                                                                                                    t.cantidad
                                                                                                                                }
                                                                                                                            </td>
                                                                                                                            <td className="px-2 py-2 text-right text-muted-foreground">
                                                                                                                                {formatARS(
                                                                                                                                    Number(
                                                                                                                                        t.precio_unitario,
                                                                                                                                    ),
                                                                                                                                )}
                                                                                                                            </td>
                                                                                                                            <td className="px-4 py-2 text-right font-semibold text-foreground">
                                                                                                                                {formatARS(
                                                                                                                                    Number(
                                                                                                                                        t.subtotal,
                                                                                                                                    ),
                                                                                                                                )}
                                                                                                                            </td>
                                                                                                                        </tr>
                                                                                                                    ),
                                                                                                                )}
                                                                                                            </tbody>
                                                                                                        </table>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </li>
                                                                                    );
                                                                                },
                                                                            )}
                                                                        </ul>
                                                                    )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                },
                            );
                        })()}
                    </div>

                    <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                        <span className="text-sm font-semibold text-muted-foreground">
                            Total
                        </span>
                        <span className="text-lg font-bold text-foreground">
                            {selectedCierre &&
                                formatARS(Number(selectedCierre.total))}
                        </span>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={!selectedCierre}
                            onClick={() => {
                                if (!selectedCierre) return;
                                window.open(
                                    `/pdf/cierres-caja/${selectedCierre.id}`,
                                    '_blank',
                                );
                            }}
                        >
                            <Download className="mr-1.5 h-4 w-4" />
                            Exportar PDF
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setSelectedCierre(null)}
                        >
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
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
