import {
    Building2,
    CalendarRange,
    Check,
    ChevronLeft,
    ChevronRight,
    Plus,
    Trash2,
    User as UserIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/app/status-badge';
import { PatenteChofer } from '@/components/multas/atomos';
import {
    formatFecha,
    isoDate,
    lunesDe,
    montoEfectivo,
    sinImporte,
} from '@/components/multas/logica';
import type { Multa, MultaEliminada } from '@/components/multas/tipos';
import { formatARS } from '@/components/recaudaciones-tabla';
import { cn } from '@/lib/utils';

function ReporteStat({
    icon: Icon,
    color,
    label,
    value,
    sub,
}: {
    icon: LucideIcon;
    color: string;
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <span
                className={cn(
                    'flex items-center gap-1.5 text-xs font-medium',
                    color,
                )}
            >
                <Icon aria-hidden="true" className="size-3.5" /> {label}
            </span>
            <span className="text-xl font-bold text-foreground tabular-nums">
                {value}
            </span>
            {sub && (
                <span className="text-xs text-muted-foreground">{sub}</span>
            )}
        </div>
    );
}

/** Sección con encabezado + contador; muestra vacío si no hay filas. */
function ReporteSeccion({
    icon: Icon,
    color,
    title,
    count,
    children,
}: {
    icon: LucideIcon;
    color: string;
    title: string;
    count: number;
    children: ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                <Icon aria-hidden="true" className={cn('size-4', color)} />
                <span className="text-sm font-medium text-foreground">
                    {title}
                </span>
                <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                    {count}
                </span>
            </div>
            {count === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Sin novedades esta semana.
                </p>
            ) : (
                <div className="divide-y divide-border">{children}</div>
            )}
        </div>
    );
}

/** Fila de una sección: patente + chofer, detalle opcional, fecha y monto. */
function ReporteFila({
    patente,
    conductor,
    inactivo,
    detalle,
    fecha,
    monto,
    montoClass,
    extra,
}: {
    patente: string;
    conductor: string | null;
    inactivo?: boolean;
    detalle?: string;
    fecha: string;
    monto: ReactNode;
    montoClass?: string;
    extra?: ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 px-4 py-2.5">
            <PatenteChofer
                patente={patente}
                conductor={conductor}
                inactivo={inactivo}
            />
            {detalle !== undefined && (
                <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:block">
                    {detalle}
                </span>
            )}
            <span className="ml-auto flex shrink-0 items-center gap-2">
                {extra}
                <span className="text-xs text-muted-foreground tabular-nums">
                    {fecha}
                </span>
                <span
                    className={cn(
                        'w-24 text-right text-sm font-semibold tabular-nums',
                        montoClass ?? 'text-foreground',
                    )}
                >
                    {monto}
                </span>
            </span>
        </div>
    );
}

/** Reporte semanal de actividad de multas (tab "Reporte"). */
export function ReporteSemanal({
    multas,
    eliminadas,
}: {
    multas: Multa[];
    eliminadas: MultaEliminada[];
}) {
    const [offset, setOffset] = useState(0); // 0 = semana en curso

    const { desde, hasta } = useMemo(() => {
        const inicio = lunesDe(new Date());
        inicio.setDate(inicio.getDate() + offset * 7);
        const fin = new Date(inicio);
        fin.setDate(fin.getDate() + 6);

        return { desde: isoDate(inicio), hasta: isoDate(fin) };
    }, [offset]);

    const rep = useMemo(() => {
        const en = (d: string | null | undefined) =>
            !!d && d >= desde && d <= hasta;
        const nuevas = multas.filter((m) => en(m.created_at));
        const pagadas = multas.filter((m) => en(m.pagada_en));
        const cobros = multas.flatMap((m) =>
            m.pagos
                .filter((p) => en(p.fecha))
                .map((p) => ({ multa: m, pago: p })),
        );
        const saldadas = multas.filter((m) => m.cobrado && en(m.cobrada_en));
        const borradas = eliminadas.filter((e) => en(e.deleted_at));

        return {
            nuevas,
            pagadas,
            cobros,
            saldadas,
            borradas,
            montoNuevas: nuevas.reduce((s, m) => s + montoEfectivo(m), 0),
            montoPagadas: pagadas.reduce((s, m) => s + montoEfectivo(m), 0),
            montoCobrado: cobros.reduce((s, c) => s + Number(c.pago.monto), 0),
        };
    }, [multas, eliminadas, desde, hasta]);

    const esActual = offset === 0;

    return (
        <div className="flex flex-col gap-4 pb-4">
            {/* Navegador de semana */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
                <button
                    type="button"
                    onClick={() => setOffset((o) => o - 1)}
                    aria-label="Semana anterior"
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                </button>
                <div className="flex items-center gap-2 px-1">
                    <CalendarRange
                        aria-hidden="true"
                        className="size-4 text-primary"
                    />
                    <span
                        aria-live="polite"
                        className="text-sm font-semibold text-foreground tabular-nums"
                    >
                        {formatFecha(desde)} – {formatFecha(hasta)}
                    </span>
                    {esActual && (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            Esta semana
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setOffset((o) => o + 1)}
                    disabled={esActual}
                    aria-label="Semana siguiente"
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ChevronRight aria-hidden="true" className="size-4" />
                </button>
                <div className="ml-auto flex items-center gap-1.5">
                    <button
                        type="button"
                        aria-pressed={offset === -1}
                        onClick={() => setOffset(-1)}
                        className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            offset === -1
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                    >
                        Semana pasada
                    </button>
                    <button
                        type="button"
                        aria-pressed={esActual}
                        onClick={() => setOffset(0)}
                        className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            esActual
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                    >
                        Esta semana
                    </button>
                </div>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ReporteStat
                    icon={Plus}
                    color="text-primary"
                    label="Nuevas multas"
                    value={String(rep.nuevas.length)}
                    sub={
                        rep.montoNuevas > 0
                            ? formatARS(rep.montoNuevas)
                            : 'Sin monto'
                    }
                />
                <ReporteStat
                    icon={Building2}
                    color="text-info"
                    label="Pagadas al sistema"
                    value={String(rep.pagadas.length)}
                    sub={
                        rep.montoPagadas > 0 ? formatARS(rep.montoPagadas) : '—'
                    }
                />
                <ReporteStat
                    icon={UserIcon}
                    color="text-success"
                    label="Cobrado a choferes"
                    value={formatARS(rep.montoCobrado)}
                    sub={`${rep.cobros.length} pago${rep.cobros.length !== 1 ? 's' : ''} · ${rep.saldadas.length} saldada${rep.saldadas.length !== 1 ? 's' : ''}`}
                />
                <ReporteStat
                    icon={Trash2}
                    color="text-destructive"
                    label="Eliminadas"
                    value={String(rep.borradas.length)}
                    sub={rep.borradas.length > 0 ? 'ver detalle' : 'Ninguna'}
                />
            </div>

            <ReporteSeccion
                icon={Plus}
                color="text-primary"
                title="Nuevas multas registradas"
                count={rep.nuevas.length}
            >
                {rep.nuevas.map((m) => (
                    <ReporteFila
                        key={m.id}
                        patente={m.patente}
                        conductor={m.conductor ?? null}
                        inactivo={m.conductor_inactivo}
                        detalle={m.descripcion}
                        fecha={formatFecha(m.created_at)}
                        monto={
                            sinImporte(m) ? '—' : formatARS(montoEfectivo(m))
                        }
                    />
                ))}
            </ReporteSeccion>

            <ReporteSeccion
                icon={Building2}
                color="text-info"
                title="Pagadas al sistema de infracciones"
                count={rep.pagadas.length}
            >
                {rep.pagadas.map((m) => (
                    <ReporteFila
                        key={m.id}
                        patente={m.patente}
                        conductor={m.conductor ?? null}
                        inactivo={m.conductor_inactivo}
                        detalle={m.descripcion}
                        fecha={m.pagada_en ? formatFecha(m.pagada_en) : ''}
                        monto={
                            sinImporte(m) ? '—' : formatARS(montoEfectivo(m))
                        }
                    />
                ))}
            </ReporteSeccion>

            <ReporteSeccion
                icon={UserIcon}
                color="text-success"
                title="Cobros a choferes"
                count={rep.cobros.length}
            >
                {rep.cobros.map(({ multa: m, pago: p }) => (
                    <ReporteFila
                        key={p.id}
                        patente={m.patente}
                        conductor={m.conductor ?? null}
                        inactivo={m.conductor_inactivo}
                        fecha={formatFecha(p.fecha)}
                        monto={formatARS(Number(p.monto))}
                        montoClass="text-success"
                        extra={
                            <>
                                {p.es_transferencia && (
                                    <StatusBadge tone="info" size="sm">
                                        Transferencia
                                    </StatusBadge>
                                )}
                                {!m.cobrado && (
                                    <StatusBadge tone="warning" size="sm">
                                        Parcial
                                    </StatusBadge>
                                )}
                            </>
                        }
                    />
                ))}
            </ReporteSeccion>

            <ReporteSeccion
                icon={Check}
                color="text-success"
                title="Saldadas por completo"
                count={rep.saldadas.length}
            >
                {rep.saldadas.map((m) => (
                    <ReporteFila
                        key={m.id}
                        patente={m.patente}
                        conductor={m.conductor ?? null}
                        inactivo={m.conductor_inactivo}
                        detalle={m.descripcion}
                        fecha={m.cobrada_en ? formatFecha(m.cobrada_en) : ''}
                        monto={
                            sinImporte(m)
                                ? '—'
                                : formatARS(Number(m.monto_cobrado))
                        }
                    />
                ))}
            </ReporteSeccion>

            <ReporteSeccion
                icon={Trash2}
                color="text-destructive"
                title="Multas eliminadas"
                count={rep.borradas.length}
            >
                {rep.borradas.map((e) => (
                    <ReporteFila
                        key={e.id}
                        patente={e.patente}
                        conductor={e.conductor}
                        inactivo={e.conductor_inactivo}
                        detalle={e.descripcion}
                        fecha={formatFecha(e.deleted_at)}
                        monto={sinImporte(e) ? '—' : formatARS(Number(e.monto))}
                        montoClass="text-muted-foreground line-through"
                    />
                ))}
            </ReporteSeccion>
        </div>
    );
}
