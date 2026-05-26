import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Calendar, ChevronRight, Coins, Download, FileSpreadsheet, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyDual, formatARS, formatUSD } from '@/components/money-dual';
import { cn } from '@/lib/utils';
import { FLOTA_CONCEPTOS } from '@/lib/concepto';

interface Cierre {
    id: number;
    periodo_inicio: string | null;
    periodo_fin: string;
    total_recaudado: number;
    total_distribuido: number;
    tasa: number | null;
    ejecutado_por: { id: number; name: string } | null;
}

interface Recaudacion {
    inversion: string;
    monto: number;
}

interface PorInversorDetalle {
    inversion: string;
    concepto: string;
    monto: number;
}

interface PorInversor {
    user: { id: number; name: string; dni: string };
    total: number;
    detalles: PorInversorDetalle[];
}

interface Props {
    cierre: Cierre;
    recaudaciones: Recaudacion[];
    porInversor: PorInversor[];
}

function formatFecha(d: string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function toUSD(ars: number, tasa: number | null): number | null {
    return tasa && tasa > 0 ? ars / tasa : null;
}

export default function CierresShow({ cierre, recaudaciones, porInversor }: Props) {
    const recaudadoUSD = toUSD(cierre.total_recaudado, cierre.tasa);
    const distribuidoUSD = toUSD(cierre.total_distribuido, cierre.tasa);

    return (
        <>
            <Head title={`Cierre ${formatFecha(cierre.periodo_fin)}`} />

            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.get('/cierres-inversion')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Volver</span>
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                            Cierre {formatFecha(cierre.periodo_fin)}
                        </h1>
                        {cierre.ejecutado_por && (
                            <p className="text-xs text-muted-foreground">
                                Ejecutado por {cierre.ejecutado_por.name}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/pdf/cierres-inversion/${cierre.id}`, '_blank')}
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">PDF</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/excel/cierres-inversion/${cierre.id}`, '_blank')}
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            <span className="hidden sm:inline">Excel</span>
                        </Button>
                    </div>
                </div>

                {/* Hero strip */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    <HeroStat
                        label="Recaudado"
                        value={recaudadoUSD != null ? formatUSD(recaudadoUSD) : formatARS(cierre.total_recaudado)}
                        sub={recaudadoUSD != null ? formatARS(cierre.total_recaudado) : undefined}
                        icon={Coins}
                        tone="orange"
                    />
                    <HeroStat
                        label="Distribuido"
                        value={distribuidoUSD != null ? formatUSD(distribuidoUSD) : formatARS(cierre.total_distribuido)}
                        sub={distribuidoUSD != null ? formatARS(cierre.total_distribuido) : undefined}
                        icon={TrendingUp}
                        tone="violet"
                    />
                    <HeroStat
                        label="Fecha de cierre"
                        value={formatFecha(cierre.periodo_fin)}
                        sub={cierre.periodo_inicio ? `Desde ${formatFecha(cierre.periodo_inicio)}` : undefined}
                        icon={Calendar}
                        tone="info"
                    />
                </div>

                {cierre.tasa && (
                    <p className="text-[11px] text-muted-foreground">
                        Tasa: <span className="font-mono font-medium text-foreground">{formatARS(cierre.tasa)}</span> / USD
                    </p>
                )}

                {/* Two columns */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                    {/* Recaudaciones */}
                    <div>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Recaudado por inversión
                            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                                {recaudaciones.length}
                            </span>
                        </h2>
                        {recaudaciones.length === 0 ? (
                            <p className="rounded-2xl border border-border bg-card p-6 text-sm italic text-muted-foreground">
                                Sin recaudación registrada.
                            </p>
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-border bg-card">
                                {[...recaudaciones]
                                    .sort((a, b) =>
                                        (a.inversion ?? '').localeCompare(b.inversion ?? '', 'es', {
                                            numeric: true,
                                            sensitivity: 'base',
                                        }),
                                    )
                                    .map((r, idx, arr) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                'flex items-center justify-between gap-3 px-5 py-3',
                                                idx < arr.length - 1 && 'border-b border-border',
                                            )}
                                        >
                                            <span className="font-mono text-sm font-medium text-foreground">
                                                {r.inversion}
                                            </span>
                                            <MoneyDual
                                                ars={r.monto}
                                                tasa={cierre.tasa}
                                                orientation="stacked"
                                                size="sm"
                                                className="shrink-0 items-end"
                                            />
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Sueldo por inversor */}
                    <div>
                        <h2 className="mb-3 text-sm font-semibold text-foreground">
                            Sueldo por inversor
                            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                                {porInversor.length}
                            </span>
                        </h2>
                        {porInversor.length === 0 ? (
                            <p className="rounded-2xl border border-border bg-card p-6 text-sm italic text-muted-foreground">
                                Sin pagos en este cierre.
                            </p>
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-border bg-card">
                                {porInversor.map((row, idx, arr) => {
                                    const flotaTotal = row.detalles
                                        .filter((d) => FLOTA_CONCEPTOS.has(d.concepto))
                                        .reduce((a, d) => a + d.monto, 0);
                                    const finTotal = row.detalles
                                        .filter((d) => d.concepto === 'redistribucion_financiador')
                                        .reduce((a, d) => a + d.monto, 0);
                                    const flotaUSD = flotaTotal > 0 ? toUSD(flotaTotal, cierre.tasa) : null;
                                    const finUSD = finTotal > 0 ? toUSD(finTotal, cierre.tasa) : null;
                                    const totalUSD = toUSD(row.total, cierre.tasa);
                                    const isLast = idx === arr.length - 1;

                                    return (
                                        <button
                                            key={row.user.id}
                                            type="button"
                                            onClick={() =>
                                                router.get(
                                                    `/cierres-inversion/${cierre.id}/inversor/${row.user.id}`,
                                                )
                                            }
                                            className={cn(
                                                'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/40',
                                                !isLast && 'border-b border-border',
                                            )}
                                        >
                                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                <span className="truncate text-sm font-semibold text-foreground">
                                                    {row.user.name}
                                                </span>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                                    {flotaTotal > 0 && (
                                                        <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                                                            Flota · {flotaUSD != null ? formatUSD(flotaUSD) : formatARS(flotaTotal)}
                                                        </span>
                                                    )}
                                                    {finTotal > 0 && (
                                                        <span className="font-mono text-[11px] text-violet-500 dark:text-violet-400">
                                                            Financiación · {finUSD != null ? formatUSD(finUSD) : formatARS(finTotal)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                                                        {totalUSD != null ? formatUSD(totalUSD) : formatARS(row.total)}
                                                    </span>
                                                    {totalUSD != null && (
                                                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                                            {formatARS(row.total)}
                                                        </span>
                                                    )}
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

const TONE_COLORS = {
    orange: { icon: 'text-primary', bg: 'bg-primary/10' },
    info:   { icon: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500/10' },
    violet: { icon: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10' },
};

function HeroStat({ label, value, sub, icon: Icon, tone }: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    tone: keyof typeof TONE_COLORS;
}) {
    const c = TONE_COLORS[tone];
    return (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5 min-h-[110px]">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                </span>
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', c.bg, c.icon)}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
            </div>
            <div className="font-mono text-xl font-semibold leading-tight tabular-nums text-foreground break-all">
                {value}
            </div>
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
    );
}

CierresShow.layout = {
    breadcrumbs: [
        { title: 'Cierres', href: '/cierres-inversion' },
        { title: 'Detalle' },
    ],
};
