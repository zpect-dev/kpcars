import { Head } from '@inertiajs/react';
import {
    Calendar,
    ChevronDown,
    Clock,
    Coins,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { formatARS, formatUSD } from '@/components/money-dual';
import { cn } from '@/lib/utils';

interface Movimiento {
    id: number;
    tipo: 'cargo' | 'pago';
    monto: string;
    descripcion: string | null;
    created_at: string;
    registrado_por: { id: number; name: string } | null;
}

interface InversionRow {
    id: number;
    nombre: string;
    empresa: { id: number; nombre: string } | null;
    tiene_deuda: boolean;
    es_financiador: boolean;
    saldo: number;
    movimientos: Movimiento[];
}

interface CierreDetalle {
    inversion: string;
    concepto: string;
    monto: number;
}

interface CierreRow {
    id: number;
    periodo_inicio: string | null;
    periodo_fin: string;
    total: number;
    tasa: number | null;
    detalles: CierreDetalle[];
}

interface Props {
    inversiones: InversionRow[];
    cierres: CierreRow[];
    tasaActual: number | null;
}

const CONCEPTO_LABEL: Record<string, string> = {
    parte_completa: 'Parte completa',
    media_parte_deudor: 'Media parte (deudor)',
    cero_deudor: 'Cero (deudor 3ra+)',
    redistribucion_financiador: 'Redistribución como financiador',
};

function toUSD(ars: number, tasa: number | null): number | null {
    return tasa && tasa > 0 ? ars / tasa : null;
}

function formatFecha(d: string): string {
    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

function nextSundayLabel(): string {
    const d = new Date();
    const days = d.getDay() === 0 ? 7 : 7 - d.getDay();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function getStatus(inv: InversionRow) {
    if (inv.tiene_deuda) return 'deuda' as const;
    if (inv.es_financiador) return 'financia' as const;
    return 'al-dia' as const;
}

const FLOTA_CONCEPTOS = new Set(['parte_completa', 'media_parte_deudor', 'cero_deudor']);

function getConceptoDisplay(concepto: string): { label: string; cls: string } {
    switch (concepto) {
        case 'parte_completa':             return { label: 'Sueldo flota',           cls: 'text-emerald-600 dark:text-emerald-400' };
        case 'redistribucion_financiador': return { label: 'Sueldo financista',       cls: 'text-violet-500 dark:text-violet-400' };
        case 'media_parte_deudor':         return { label: 'Media parte · deudor',    cls: 'text-amber-500 dark:text-amber-400' };
        case 'cero_deudor':                return { label: 'Sin cobro · 3ra+ falta',  cls: 'text-muted-foreground' };
        default:                           return { label: concepto,                  cls: 'text-muted-foreground' };
    }
}

function getRecentPago(movimientos: Movimiento[]): Movimiento | null {
    const pagos = movimientos.filter((m) => m.tipo === 'pago');
    if (pagos.length === 0) return null;
    const latest = pagos[0];
    const days = (Date.now() - new Date(latest.created_at).getTime()) / 86_400_000;
    return days <= 60 ? latest : null;
}

export default function MiCuentaIndex({ inversiones, cierres, tasaActual }: Props) {
    const [expandedCierres, setExpandedCierres] = useState<Set<number>>(new Set());

    function toggleCierre(id: number) {
        setExpandedCierres((prev) => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    }

    const deudaTotal = inversiones.reduce((a, i) => a + (i.tiene_deuda ? i.saldo : 0), 0);
    const inversionesConDeuda = inversiones.filter((i) => i.tiene_deuda).length;
    const ultimoCierre = cierres[0] ?? null;
    const totalHistorico = cierres.reduce((a, c) => a + c.total, 0);

    // Accumulate per investment: sum monto, use flota concept if present (takes priority over financista for label)
    const lastCierreByInv = new Map<string, { monto: number; concepto: string }>();
    if (ultimoCierre) {
        ultimoCierre.detalles.forEach((d) => {
            if (!d.inversion) return;
            const existing = lastCierreByInv.get(d.inversion);
            if (existing) {
                existing.monto += d.monto;
                if (d.concepto !== 'redistribucion_financiador') existing.concepto = d.concepto;
            } else {
                lastCierreByInv.set(d.inversion, { monto: d.monto, concepto: d.concepto });
            }
        });
    }

    const deudaUSD = toUSD(deudaTotal, tasaActual);
    const ultimoCierreUSD = ultimoCierre ? toUSD(ultimoCierre.total, tasaActual) : null;
    const historicoUSD = toUSD(totalHistorico, tasaActual);


    return (
        <>
            <Head title="Mi Cuenta" />

            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">

                {/* ── Hero strip ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

                    {/* Deuda pendiente */}
                    <div className={cn(
                        'relative overflow-hidden rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-3 min-h-[148px]',
                        deudaTotal > 0
                            ? 'border-red-500/25 bg-red-950/10 dark:bg-red-950/15'
                            : 'border-emerald-500/20 bg-emerald-950/5 dark:bg-emerald-950/10',
                    )}>
                        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full blur-2xl opacity-60"
                            style={{ background: deudaTotal > 0 ? 'oklch(0.72 0.18 25 / 0.08)' : 'oklch(0.80 0.14 155 / 0.08)' }} />
                        <div className="relative flex items-start justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Deuda pendiente
                            </span>
                            {deudaTotal > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500 dark:text-red-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                    {inversionesConDeuda} en deuda
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                    Al día
                                </span>
                            )}
                        </div>
                        <div className="relative flex flex-col gap-1">
                            <span className={cn(
                                'font-mono text-xl font-semibold leading-none tabular-nums break-all',
                                deudaTotal > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
                            )}>
                                {deudaTotal > 0 ? '− ' : ''}
                                {deudaUSD != null ? formatUSD(deudaUSD) : formatARS(deudaTotal)}
                            </span>
                            {deudaUSD != null && (
                                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                                    {deudaTotal > 0 ? '− ' : ''}{formatARS(deudaTotal)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Recaudación último cierre */}
                    <HeroStat
                        label="Recaudación · último cierre"
                        value={ultimoCierreUSD != null
                            ? formatUSD(ultimoCierreUSD)
                            : ultimoCierre ? formatARS(ultimoCierre.total) : '—'}
                        sub={ultimoCierre
                            ? (ultimoCierreUSD != null ? formatARS(ultimoCierre.total) + ' · ' : '') + formatFecha(ultimoCierre.periodo_fin)
                            : 'Sin cierres aún'}
                        icon={Coins}
                        tone="orange"
                    />

                    {/* Próximo cierre */}
                    <HeroStat
                        label="Próximo cierre"
                        value={nextSundayLabel()}
                        sub="Domingo · cierre semanal"
                        icon={Clock}
                        tone="info"
                    />

                    {/* Cobrado histórico */}
                    <HeroStat
                        label="Cobrado histórico"
                        value={historicoUSD != null ? formatUSD(historicoUSD) : formatARS(totalHistorico)}
                        sub={historicoUSD != null
                            ? formatARS(totalHistorico) + ` · ${cierres.length} cierre${cierres.length !== 1 ? 's' : ''}`
                            : `${cierres.length} cierre${cierres.length !== 1 ? 's' : ''} registrados`}
                        icon={TrendingUp}
                        tone="violet"
                    />
                </div>

                {/* ── Mis inversiones ────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                        Mis inversiones
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                            {inversiones.length}
                        </span>
                    </h2>
                    {tasaActual && (
                        <span className="text-[11px] text-muted-foreground">
                            Tasa: <span className="font-mono font-medium text-foreground">{formatARS(tasaActual)}</span> / USD
                        </span>
                    )}
                </div>

                {inversiones.length === 0 ? (
                    <EmptyState
                        icon={Wallet}
                        title="Sin inversiones"
                        sub="No estás asignado a ninguna inversión todavía."
                    />
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-border bg-card">
                        {inversiones.map((inv, i) => {
                            const status = getStatus(inv);
                            const lastEntry = lastCierreByInv.get(inv.nombre);
                            const isLast = i === inversiones.length - 1;
                            return (
                                <PositionRow
                                    key={inv.id}
                                    inv={inv}
                                    status={status}
                                    lastEntry={lastEntry}
                                    tasaActual={tasaActual}
                                    isLast={isLast}
                                />
                            );
                        })}
                    </div>
                )}

                {/* ── Historial de cierres ───────────────────────────────── */}
                {cierres.length > 0 && (
                    <>
                        <h2 className="text-sm font-semibold text-foreground">
                            Historial de cierres
                            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                                {cierres.length}
                            </span>
                        </h2>
                        <div className="overflow-hidden rounded-2xl border border-border bg-card">
                            {cierres.map((c, i) => {
                                const cUSD = toUSD(c.total, c.tasa);
                                const isLast = i === cierres.length - 1;
                                const isOpen = expandedCierres.has(c.id);
                                return (
                                    <div key={c.id} className={cn(!isLast && 'border-b border-border')}>
                                        <button
                                            type="button"
                                            onClick={() => toggleCierre(c.id)}
                                            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/40"
                                        >
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                <Calendar className="h-4 w-4" />
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <span className="text-sm font-semibold text-foreground">
                                                    Cierre #{c.id}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatFecha(c.periodo_fin)}
                                                    {c.periodo_inicio && ` · desde ${formatFecha(c.periodo_inicio)}`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                        + {cUSD != null ? formatUSD(cUSD) : formatARS(c.total)}
                                                    </span>
                                                    {cUSD != null && (
                                                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                                                            {formatARS(c.total)}
                                                        </span>
                                                    )}
                                                </div>
                                                <ChevronDown className={cn(
                                                    'h-4 w-4 text-muted-foreground transition-transform duration-200',
                                                    isOpen && 'rotate-180',
                                                )} />
                                            </div>
                                        </button>

                                        {isOpen && c.detalles.length > 0 && (
                                            <CierreDetalle cierre={c} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

const TONE_COLORS = {
    orange: { icon: 'text-primary', bg: 'bg-primary/10' },
    info:   { icon: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500/10' },
    violet: { icon: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10' },
    ok:     { icon: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
};

function HeroStat({ label, value, sub, icon: Icon, tone }: {
    label: string; value: string; sub: string;
    icon: React.ElementType; tone: keyof typeof TONE_COLORS;
}) {
    const c = TONE_COLORS[tone];
    return (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5 min-h-[148px]">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', c.bg, c.icon)}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
            </div>
            <div className="font-mono text-xl font-semibold leading-tight tabular-nums text-foreground break-all">{value}</div>
            <span className="text-xs text-muted-foreground">{sub}</span>
        </div>
    );
}

function PositionRow({ inv, status, lastEntry, tasaActual, isLast }: {
    inv: InversionRow;
    status: 'deuda' | 'financia' | 'al-dia';
    lastEntry?: { monto: number; concepto: string };
    tasaActual: number | null;
    isLast: boolean;
}) {
    const stripeColor = status === 'deuda'
        ? 'bg-red-500/70'
        : status === 'financia'
            ? 'bg-violet-500/70'
            : 'bg-emerald-500/40';

    const badgeCls = status === 'deuda'
        ? 'border-red-500/25 bg-red-500/10 text-red-500 dark:text-red-400'
        : status === 'financia'
            ? 'border-violet-500/25 bg-violet-500/10 text-violet-500 dark:text-violet-400'
            : 'border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400';

    const badgeLabel = status === 'deuda' ? 'En deuda' : status === 'financia' ? 'Financia' : 'Al día';

    const lastEntryUSD = lastEntry ? toUSD(lastEntry.monto, tasaActual) : null;
    const conceptoDisplay = lastEntry ? getConceptoDisplay(lastEntry.concepto) : null;
    const recentPago = getRecentPago(inv.movimientos);

    return (
        <div className={cn(
            'relative flex items-center gap-4 px-5 py-4',
            !isLast && 'border-b border-border',
        )}>
            {/* Stripe */}
            <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', stripeColor)} />

            {/* INV name + badges */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-foreground">{inv.nombre}</span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', badgeCls)}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {badgeLabel}
                    </span>
                    {recentPago && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            Pago aplicado · {formatFecha(recentPago.created_at)}
                        </span>
                    )}
                </div>
                {inv.empresa && (
                    <span className="text-xs text-muted-foreground">{inv.empresa.nombre}</span>
                )}
            </div>

            {/* Último cierre */}
            {lastEntry && conceptoDisplay ? (
                <div className="hidden flex-col items-end gap-1 sm:flex shrink-0">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Último cierre</span>
                    <span className={cn('font-mono text-sm font-semibold tabular-nums', conceptoDisplay.cls)}>
                        + {lastEntryUSD != null ? formatUSD(lastEntryUSD) : formatARS(lastEntry.monto)}
                    </span>
                    {lastEntryUSD != null && (
                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                            {formatARS(lastEntry.monto)}
                        </span>
                    )}
                    <span className={cn('text-[10px]', conceptoDisplay.cls)}>{conceptoDisplay.label}</span>
                </div>
            ) : (
                <div className="hidden sm:flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Último cierre</span>
                    <span className="text-xs text-muted-foreground italic">Sin datos</span>
                </div>
            )}
        </div>
    );
}

function CierreDetalle({ cierre }: { cierre: CierreRow }) {
    const flotaRows   = cierre.detalles.filter((d) => FLOTA_CONCEPTOS.has(d.concepto));
    const finRows     = cierre.detalles.filter((d) => d.concepto === 'redistribucion_financiador');
    const flotaTotal  = flotaRows.reduce((a, d) => a + d.monto, 0);
    const finTotal    = finRows.reduce((a, d) => a + d.monto, 0);
    const hasFinanc   = finRows.length > 0;

    function DetalleTable({ rows, total, label }: {
        rows: CierreDetalle[]; total: number; label: string;
    }) {
        const totalUSD = toUSD(total, cierre.tasa);
        return (
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
                <table className="w-full text-xs">
                    <tbody className="divide-y divide-border/40">
                        {rows.map((d, i) => {
                            const dUSD = toUSD(d.monto, cierre.tasa);
                            return (
                                <tr key={i}>
                                    <td className="py-1.5 font-mono text-[11px] font-medium text-primary">{d.inversion}</td>
                                    <td className="py-1.5 text-muted-foreground">{CONCEPTO_LABEL[d.concepto] ?? d.concepto}</td>
                                    <td className="py-1.5 text-right">
                                        <span className="font-mono font-semibold text-foreground">
                                            {dUSD != null ? formatUSD(dUSD) : formatARS(d.monto)}
                                        </span>
                                        {dUSD != null && (
                                            <span className="block font-mono text-[10px] text-muted-foreground">{formatARS(d.monto)}</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-border">
                            <td colSpan={2} className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Total {label}
                            </td>
                            <td className="pt-2 text-right">
                                <span className="font-mono text-sm font-semibold text-foreground">
                                    {totalUSD != null ? formatUSD(totalUSD) : formatARS(total)}
                                </span>
                                {totalUSD != null && (
                                    <span className="block font-mono text-[10px] text-muted-foreground">{formatARS(total)}</span>
                                )}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        );
    }

    return (
        <div className={cn(
            'border-t border-border bg-muted/20 px-5 py-4',
            hasFinanc && 'flex flex-col gap-4',
        )}>
            <DetalleTable rows={flotaRows} total={flotaTotal} label="Flota" />
            {hasFinanc && (
                <DetalleTable rows={finRows} total={finTotal} label="Financista" />
            )}
        </div>
    );
}

function EmptyState({ icon: Icon, title, sub, tone = 'neutral' }: {
    icon: React.ElementType; title: string; sub: string; tone?: 'neutral' | 'ok';
}) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-12 text-center">
            <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full',
                tone === 'ok' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
            )}>
                <Icon className="h-6 w-6" />
            </div>
            <span className="text-base font-semibold text-foreground">{title}</span>
            <span className="text-sm text-muted-foreground">{sub}</span>
        </div>
    );
}

MiCuentaIndex.layout = {
    breadcrumbs: [{ title: 'Mi Cuenta', href: '/mi-cuenta' }],
};
