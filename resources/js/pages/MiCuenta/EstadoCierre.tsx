import { Head, Link } from '@inertiajs/react';
import { Building2, Coins, Download, HandCoins, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatARS, formatUSD } from '@/components/money-dual';
import { CONCEPTO_LABEL } from '@/lib/concepto';
import { cn } from '@/lib/utils';

interface Inv {
    inversion_nombre: string;
    recaudado: number;
    es_financiador: boolean;
}

interface FlotaGasto {
    patente: string;
    vehiculo: string;
    monto: number;
}

interface EmpresaBlock {
    empresa_id: number;
    empresa_nombre: string;
    recaudacion_empresa: number;
    mi_recaudacion: number;
    mi_fraccion: number;
    inversiones: Inv[];
    gastos: {
        flota: FlotaGasto[];
        flota_total: number;
        globales_empresa: number;
        globales_mi_parte: number;
        total: number;
    };
    sueldo: {
        detalle: { inversion: string; concepto: string; monto: number }[];
        total: number;
    };
}

interface Props {
    cierre: { id: number; fecha: string | null; tasa: number };
    socio: { id: number; name: string };
    empresas: EmpresaBlock[];
    totales: { recaudado: number; gastos: number; sueldo: number };
}

function toUSD(ars: number, tasa: number): number | null {
    return tasa > 0 ? ars / tasa : null;
}

function formatFecha(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function invLabel(nombre: string): string {
    return nombre.replace(/^INV_(\d+)$/i, 'Inversión $1');
}

export default function EstadoCierre({ cierre, socio, empresas, totales }: Props) {
    return (
        <>
            <Head title={`Estado del cierre #${cierre.id}`} />

            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link href="/mi-cuenta" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                            ← Mi Cuenta
                        </Link>
                        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                            Estado del cierre #{cierre.id}
                        </h1>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-muted-foreground">
                                {formatFecha(cierre.fecha)}
                            </span>
                            <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
                                Tasa {formatARS(cierre.tasa)} / USD
                            </span>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/pdf/mi-cuenta/cierres/${cierre.id}`, '_blank')}
                    >
                        <Download className="mr-1.5 h-4 w-4" />
                        PDF
                    </Button>
                </div>

                {/* Hero: mis 3 números del cierre */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <HeroStat label="Recaudé (mis inversiones)" ars={totales.recaudado} tasa={cierre.tasa} icon={Coins} tone="orange" />
                    <HeroStat label="Se gastó (mi parte)" ars={totales.gastos} tasa={cierre.tasa} icon={HandCoins} tone="rose" />
                    <HeroStat label="Cobré de sueldo" ars={totales.sueldo} tasa={cierre.tasa} icon={TrendingUp} tone="ok" />
                </div>

                {empresas.map((e) => (
                    <div key={e.empresa_id} className="overflow-hidden rounded-2xl border border-border bg-card">
                        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <p className="text-base font-semibold text-foreground">{e.empresa_nombre}</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3">
                            {/* Recaudación */}
                            <Bloque titulo="Recaudación" icon={Coins}>
                                {e.inversiones.map((inv, i) => (
                                    <Fila
                                        key={i}
                                        label={invLabel(inv.inversion_nombre) + (inv.es_financiador ? ' · financiador' : '')}
                                        monto={inv.recaudado}
                                        tasa={cierre.tasa}
                                    />
                                ))}
                                <Fila label="Total mis inversiones" monto={e.mi_recaudacion} tasa={cierre.tasa} fuerte />
                                <div className="mt-1 border-t border-border/60 pt-2">
                                    <Fila
                                        label={`Total empresa (represento ${(e.mi_fraccion * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%)`}
                                        monto={e.recaudacion_empresa}
                                        tasa={cierre.tasa}
                                        tenue
                                    />
                                </div>
                            </Bloque>

                            {/* Gastos */}
                            <Bloque titulo="Gastos (mi parte)" icon={HandCoins} borde>
                                {e.gastos.flota.length === 0 ? (
                                    <p className="py-1.5 text-xs text-muted-foreground">Flota · sin gastos</p>
                                ) : (
                                    e.gastos.flota.map((f, i) => (
                                        <Fila
                                            key={i}
                                            label={`Flota · ${f.patente}${f.vehiculo ? ' — ' + f.vehiculo : ''}`}
                                            monto={f.monto}
                                            tasa={cierre.tasa}
                                        />
                                    ))
                                )}
                                <Fila label="Subtotal flota" monto={e.gastos.flota_total} tasa={cierre.tasa} fuerte />
                                <div className="mt-1 border-t border-border/60 pt-2">
                                    <Fila
                                        label="Galpón / Taller / Oficina — mi parte"
                                        monto={e.gastos.globales_mi_parte}
                                        tasa={cierre.tasa}
                                    />
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        de {formatARS(e.gastos.globales_empresa)} de la empresa
                                    </p>
                                </div>
                                <div className="mt-1 border-t border-border pt-2">
                                    <Fila label="Total gastos" monto={e.gastos.total} tasa={cierre.tasa} fuerte />
                                </div>
                            </Bloque>

                            {/* Sueldo */}
                            <Bloque titulo="Mi sueldo" icon={Wallet} borde>
                                {e.sueldo.detalle.map((d, i) => (
                                    <Fila
                                        key={i}
                                        label={`${invLabel(d.inversion)} · ${CONCEPTO_LABEL[d.concepto] ?? d.concepto}`}
                                        monto={d.monto}
                                        tasa={cierre.tasa}
                                    />
                                ))}
                                <div className="mt-1 border-t border-border pt-2">
                                    <Fila label="Total cobrado" monto={e.sueldo.total} tasa={cierre.tasa} fuerte />
                                </div>
                            </Bloque>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

/* ── Sub-componentes ─────────────────────────────────────────────────────── */

const TONE = {
    orange: 'text-primary bg-primary/10',
    ok: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    rose: 'text-rose-500 dark:text-rose-400 bg-rose-500/10',
};

function HeroStat({ label, ars, tasa, icon: Icon, tone }: {
    label: string;
    ars: number;
    tasa: number;
    icon: React.ElementType;
    tone: keyof typeof TONE;
}) {
    const usd = toUSD(ars, tasa);
    return (
        <div className="flex min-h-[120px] flex-col justify-between gap-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', TONE[tone])}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
            </div>
            <div className="flex flex-col leading-tight">
                <span className="text-lg font-semibold tabular-nums text-foreground sm:text-xl">{formatARS(ars)}</span>
                {usd != null && <span className="text-[11px] tabular-nums text-muted-foreground">{formatUSD(usd)}</span>}
            </div>
        </div>
    );
}

function Bloque({ titulo, icon: Icon, borde, children }: {
    titulo: string;
    icon: React.ElementType;
    borde?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('p-5', borde && 'border-t border-border lg:border-t-0 lg:border-l')}>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {titulo}
            </div>
            <div className="flex flex-col gap-1">{children}</div>
        </div>
    );
}

function Fila({ label, monto, tasa, fuerte, tenue }: {
    label: string;
    monto: number;
    tasa: number;
    fuerte?: boolean;
    tenue?: boolean;
}) {
    const usd = toUSD(monto, tasa);
    return (
        <div className="flex items-baseline justify-between gap-3">
            <span className={cn('min-w-0 flex-1 truncate text-xs', tenue ? 'text-muted-foreground' : 'text-foreground', fuerte && 'font-semibold')}>
                {label}
            </span>
            <span className={cn('shrink-0 text-right text-xs tabular-nums', tenue ? 'text-muted-foreground' : 'text-foreground', fuerte && 'font-semibold')}>
                {formatARS(monto)}
                {usd != null && <span className="ml-1 text-[10px] text-muted-foreground">({formatUSD(usd)})</span>}
            </span>
        </div>
    );
}

EstadoCierre.layout = {
    breadcrumbs: [
        { title: 'Mi Cuenta', href: '/mi-cuenta' },
        { title: 'Estado del cierre', href: '#' },
    ],
};
