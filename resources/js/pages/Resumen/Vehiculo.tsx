import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Package,
    Scale,
    TrendingDown,
    TrendingUp,
    Wrench,
} from 'lucide-react';
import { PageContainer } from '@/components/app/page-container';
import { cn } from '@/lib/utils';

interface Filtros {
    desde: string;
    hasta: string;
    empresa_id: number | null;
    inversion_id: number | null;
    tipo: string | null;
    incluir_abierto: boolean;
}

interface Ingreso {
    fecha: string | null;
    concepto: string;
    en_curso: boolean;
    monto: number;
}

interface Egreso {
    fecha: string | null;
    tipo: 'gasto' | 'repuesto';
    descripcion: string | null;
    monto: number;
}

interface Props {
    filtros: Filtros;
    vehiculo: {
        id: number;
        patente: string;
        marca: string | null;
        modelo: string | null;
        inversion: string | null;
        empresa: string | null;
    };
    ingresos: Ingreso[];
    egresos: Egreso[];
    totales: { ingresos: number; egresos: number; neto: number };
}

function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

function formatFecha(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);

    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export default function ResumenVehiculo({
    filtros,
    vehiculo,
    ingresos,
    egresos,
    totales,
}: Props) {
    // Volver al resumen conservando los filtros vigentes.
    const volverQs = (() => {
        const p = new URLSearchParams({
            desde: filtros.desde,
            hasta: filtros.hasta,
        });

        if (filtros.empresa_id) {
            p.set('empresa_id', String(filtros.empresa_id));
        }

        if (filtros.inversion_id) {
            p.set('inversion_id', String(filtros.inversion_id));
        }

        if (filtros.tipo) {
            p.set('tipo', filtros.tipo);
        }

        if (filtros.incluir_abierto) {
            p.set('incluir_abierto', '1');
        }

        return p.toString();
    })();

    return (
        <>
            <Head title={`Vehículo ${vehiculo.patente}`} />

            <PageContainer className="mx-auto w-full max-w-4xl gap-5 sm:p-6">
                {/* Header */}
                <div className="flex flex-col gap-3">
                    <Link
                        href={`/resumen?${volverQs}`}
                        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Volver al resumen
                    </Link>

                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h1 className="font-mono text-xl font-bold tracking-widest text-foreground uppercase sm:text-2xl">
                                {vehiculo.patente}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {[vehiculo.marca, vehiculo.modelo]
                                    .filter(Boolean)
                                    .join(' ') || 'Vehículo'}
                                {vehiculo.inversion
                                    ? ` · ${vehiculo.inversion}`
                                    : ''}
                                {vehiculo.empresa
                                    ? ` · ${vehiculo.empresa}`
                                    : ''}
                            </p>
                        </div>
                        <span className="rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                            {formatFecha(filtros.desde)} –{' '}
                            {formatFecha(filtros.hasta)}
                        </span>
                    </div>
                </div>

                {/* Totales */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatCard
                        label="Ingresos"
                        value={totales.ingresos}
                        icon={TrendingUp}
                        tone="ok"
                    />
                    <StatCard
                        label="Egresos"
                        value={totales.egresos}
                        icon={TrendingDown}
                        tone="bad"
                    />
                    <StatCard
                        label="Neto"
                        value={totales.neto}
                        icon={Scale}
                        tone={totales.neto < 0 ? 'bad' : 'ok'}
                    />
                </div>

                {/* Ingresos */}
                <Seccion
                    titulo="Ingresos"
                    subtitulo="Recaudaciones del vehículo"
                    total={totales.ingresos}
                    vacio={ingresos.length === 0}
                    vacioTexto="Sin recaudaciones en el período."
                >
                    <table className="w-full text-sm">
                        <thead className="border-b border-border text-xs tracking-wider text-muted-foreground uppercase">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium">
                                    Fecha
                                </th>
                                <th className="px-4 py-2 text-left font-medium">
                                    Concepto
                                </th>
                                <th className="px-4 py-2 text-right font-medium">
                                    Monto
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {ingresos.map((r, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                                        {formatFecha(r.fecha)}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="inline-flex items-center gap-2">
                                            {r.concepto}
                                            {r.en_curso && (
                                                <span className="rounded border border-warning/30 bg-warning-soft px-1.5 py-0.5 text-xs font-semibold text-warning-soft-foreground">
                                                    En curso
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-right font-medium whitespace-nowrap text-success tabular-nums">
                                        {formatARS(r.monto)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Seccion>

                {/* Egresos */}
                <Seccion
                    titulo="Egresos"
                    subtitulo="Gastos de flota y repuestos de inventario"
                    total={totales.egresos}
                    vacio={egresos.length === 0}
                    vacioTexto="Sin egresos en el período."
                >
                    <table className="w-full text-sm">
                        <thead className="border-b border-border text-xs tracking-wider text-muted-foreground uppercase">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium">
                                    Fecha
                                </th>
                                <th className="px-4 py-2 text-left font-medium">
                                    Tipo
                                </th>
                                <th className="px-4 py-2 text-left font-medium">
                                    Descripción
                                </th>
                                <th className="px-4 py-2 text-right font-medium">
                                    Monto
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {egresos.map((e, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                                        {formatFecha(e.fecha)}
                                    </td>
                                    <td className="px-4 py-2">
                                        {e.tipo === 'repuesto' ? (
                                            <span className="inline-flex items-center gap-1.5 rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                                                <Package className="h-3 w-3" />
                                                Repuesto
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                                <Wrench className="h-3 w-3" />
                                                Gasto
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-muted-foreground">
                                        {e.descripcion ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 text-right font-medium whitespace-nowrap text-destructive tabular-nums">
                                        {formatARS(e.monto)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Seccion>
            </PageContainer>
        </>
    );
}

const TONE = {
    ok: 'text-success-soft-foreground bg-success-soft',
    bad: 'text-destructive-soft-foreground bg-destructive-soft',
} as const;

function StatCard({
    label,
    value,
    icon: Icon,
    tone,
}: {
    label: string;
    value: number;
    icon: typeof Scale;
    tone: keyof typeof TONE;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div
                className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    TONE[tone],
                )}
            >
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="truncate text-lg font-bold text-foreground tabular-nums">
                    {formatARS(value)}
                </p>
                <p className="truncate text-xs tracking-wide text-muted-foreground uppercase">
                    {label}
                </p>
            </div>
        </div>
    );
}

function Seccion({
    titulo,
    subtitulo,
    total,
    vacio,
    vacioTexto,
    children,
}: {
    titulo: string;
    subtitulo: string;
    total: number;
    vacio: boolean;
    vacioTexto: string;
    children: React.ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">
                        {titulo}
                    </h2>
                    <p className="text-xs text-muted-foreground">{subtitulo}</p>
                </div>
                <span className="text-sm font-bold text-foreground tabular-nums">
                    {formatARS(total)}
                </span>
            </div>
            {vacio ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {vacioTexto}
                </p>
            ) : (
                <div className="overflow-x-auto">{children}</div>
            )}
        </section>
    );
}

ResumenVehiculo.layout = {
    breadcrumbs: [
        { title: 'Resumen', href: '/resumen' },
        { title: 'Vehículo', href: '#' },
    ],
};
