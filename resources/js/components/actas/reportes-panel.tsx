import { router } from '@inertiajs/react';
import { ChevronDown, ClipboardList, Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Chip } from '@/components/actas/atomos';
import { formatFecha, formatFechaHora } from '@/components/actas/tipos';
import type {
    ActaFila,
    CobroFila,
    DesgloseFila,
    Reporte,
    ReporteDetalle,
} from '@/components/actas/tipos';
import { formatARS } from '@/components/money-dual';
import { cn } from '@/lib/utils';

const REPORTES_VISIBLES = 5;
/** Cuántas filas de cada lista se muestran en pantalla (el resto, en el PDF). */
const FILAS_DETALLE = 8;
/** Cuántas filas de desglose se muestran antes de mandar al PDF. */
const FILAS_DESGLOSE = 6;

/** Titular del panel plegado: qué movió la última corrida. */
export function resumenUltimo(r: Reporte): string {
    const cuando = formatFechaHora(r.cuando);

    if (!r.ok) {
        return `Última (${cuando}): falló`;
    }

    if (r.sin_movimiento) {
        return `Última (${cuando}): sin movimiento`;
    }

    return `Última (${cuando}): +${r.nuevas} por ${formatARS(r.monto_nuevas)} · cobrado ${formatARS(r.cobrado)}`;
}

/**
 * Reportes de sincronización: una fila por corrida, con lo que sumó, lo que se
 * pagó al organismo y lo que se le cobró a los choferes desde esa corrida.
 */
export function ReportesPanel({
    reportes,
    detalle,
}: {
    reportes: Reporte[];
    detalle: ReporteDetalle | null;
}) {
    // El panel arranca plegado: en la barra alcanza con el último movimiento.
    const [listaAbierta, setListaAbierta] = useState(false);
    const [abierto, setAbierto] = useState<number | null>(null);
    const [verTodos, setVerTodos] = useState(false);

    if (reportes.length === 0) {
        return null;
    }

    const visibles = verTodos ? reportes : reportes.slice(0, REPORTES_VISIBLES);

    function toggle(id: number) {
        if (abierto === id) {
            setAbierto(null);

            return;
        }

        setAbierto(id);
        // El detalle no viaja en la carga inicial: se pide al desplegar la fila.
        // reload() ya preserva scroll y estado.
        router.reload({
            only: ['reporteDetalle'],
            data: { reporte: id },
        });
    }

    return (
        <div className="rounded-xl border border-border bg-card">
            {/* Barra plegada: una línea con lo último que pasó. */}
            <button
                type="button"
                onClick={() => setListaAbierta((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
            >
                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="shrink-0 font-medium text-foreground">
                    Reportes
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {resumenUltimo(reportes[0])}
                </span>
                <ChevronDown
                    className={cn(
                        'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                        listaAbierta && 'rotate-180',
                    )}
                />
            </button>

            {listaAbierta && (
                <>
                    <div className="divide-y divide-border border-t border-border">
                        {visibles.map((r) => (
                            <div key={r.id}>
                                <button
                                    type="button"
                                    onClick={() => toggle(r.id)}
                                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/50"
                                >
                                    <ChevronDown
                                        className={cn(
                                            'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
                                            abierto === r.id && 'rotate-180',
                                        )}
                                    />

                                    {/* La automática es la norma: solo se aclara
                                        cuando la corrida fue a mano. */}
                                    <span
                                        className="shrink-0 text-muted-foreground tabular-nums"
                                        title={
                                            r.origen === 'schedule'
                                                ? 'Sincronización automática'
                                                : 'Sincronización manual'
                                        }
                                    >
                                        {formatFechaHora(r.cuando)}
                                        {r.origen !== 'schedule' && ' (manual)'}
                                    </span>

                                    {!r.ok ? (
                                        <span className="min-w-0 truncate font-medium text-destructive">
                                            Falló{r.error ? `: ${r.error}` : ''}
                                        </span>
                                    ) : r.sin_movimiento ? (
                                        <span className="text-muted-foreground">
                                            Sin movimiento
                                        </span>
                                    ) : (
                                        <>
                                            <span
                                                className="font-medium text-warning-soft-foreground tabular-nums"
                                                title="Multas nuevas"
                                            >
                                                +{r.nuevas}{' '}
                                                {formatARS(r.monto_nuevas)}
                                            </span>
                                            <span
                                                className="text-muted-foreground tabular-nums"
                                                title="Pagadas al organismo"
                                            >
                                                −{r.resueltas}{' '}
                                                {formatARS(r.monto_resueltas)}
                                            </span>
                                            <span
                                                className="font-medium text-success tabular-nums"
                                                title="Cobrado a choferes en el período"
                                            >
                                                {formatARS(r.cobrado)}
                                            </span>
                                            <span
                                                className="ml-auto text-muted-foreground tabular-nums"
                                                title="Deuda vigente al cierre"
                                            >
                                                deuda{' '}
                                                {formatARS(r.deuda_vigente)}
                                            </span>
                                        </>
                                    )}
                                </button>

                                {abierto === r.id && (
                                    <ReporteDetalleBloque
                                        runId={r.id}
                                        detalle={detalle}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {reportes.length > REPORTES_VISIBLES && (
                        <button
                            type="button"
                            onClick={() => setVerTodos((v) => !v)}
                            className="w-full border-t border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                        >
                            {verTodos
                                ? 'Ver menos'
                                : `Ver todas (${reportes.length})`}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

/** Detalle de un reporte: desgloses y listas de lo que movió la corrida. */
export function ReporteDetalleBloque({
    runId,
    detalle,
}: {
    runId: number;
    detalle: ReporteDetalle | null;
}) {
    // El prop parcial todavía no llegó (o es el de otra fila).
    if (!detalle || detalle.run.id !== runId) {
        return (
            <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Cargando detalle…
            </div>
        );
    }

    const t = detalle.totales;

    return (
        <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <Chip
                    label="Nuevas"
                    valor={`${t.nuevas} · ${formatARS(t.monto_nuevas)}`}
                    tone="amber"
                />
                <Chip
                    label="Pagadas al organismo"
                    valor={`${t.resueltas} · ${formatARS(t.monto_resueltas)}`}
                    tone="plain"
                />
                <Chip
                    label="Cobrado"
                    valor={`${t.pagos} · ${formatARS(t.cobrado)}`}
                    tone="emerald"
                />
                <Chip
                    label="Deuda al cierre"
                    valor={formatARS(t.deuda_vigente)}
                    tone="plain"
                />

                <a
                    href={`/actas/reportes/${runId}/pdf`}
                    className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                </a>
            </div>

            <p className="text-xs text-muted-foreground">
                Cobros del período: los registrados desde el{' '}
                {formatFechaHora(detalle.periodo.desde)} hasta{' '}
                {detalle.periodo.hasta
                    ? `el ${formatFechaHora(detalle.periodo.hasta)} (sincronización siguiente)`
                    : 'hoy'}
                .
                {t.reabiertas > 0 &&
                    ` ${t.reabiertas} multa${t.reabiertas === 1 ? '' : 's'} reapareció en el feed tras figurar como pagada.`}
            </p>

            <div className="grid gap-2 lg:grid-cols-2">
                <TablaDesglose
                    titulo="Por chofer"
                    header="Chofer"
                    filas={detalle.por_chofer}
                />
                <TablaDesglose
                    titulo="Por vehículo"
                    header="Patente"
                    filas={detalle.por_vehiculo}
                />
            </div>

            <ListaActas
                titulo="Multas nuevas"
                vacio="Esta sincronización no trajo multas nuevas."
                actas={detalle.nuevas}
            />

            <ListaActas
                titulo="Pagadas al organismo"
                vacio="Ninguna multa desapareció del feed en esta sincronización."
                actas={detalle.resueltas}
            />

            <ListaCobros cobros={detalle.cobros} />
        </div>
    );
}

export function SeccionPlegable({
    titulo,
    cantidad,
    children,
}: {
    titulo: string;
    cantidad: number;
    children: React.ReactNode;
}) {
    const [abierta, setAbierta] = useState(false);

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            <button
                type="button"
                onClick={() => setAbierta((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
            >
                <ChevronDown
                    className={cn(
                        'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
                        abierta && 'rotate-180',
                    )}
                />
                {titulo}
                <span className="text-muted-foreground">({cantidad})</span>
            </button>

            {abierta && (
                <div className="border-t border-border">{children}</div>
            )}
        </div>
    );
}

export function TablaDesglose({
    titulo,
    header,
    filas,
}: {
    titulo: string;
    header: string;
    filas: DesgloseFila[];
}) {
    const visibles = filas.slice(0, FILAS_DESGLOSE);

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-2 py-1 text-xs font-medium text-muted-foreground">
                {titulo}
            </div>

            {filas.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    Sin movimiento.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                            <tr className="border-b border-border">
                                <th className="px-2 py-1 text-left font-normal">
                                    {header}
                                </th>
                                <th className="px-2 py-1 text-right font-normal">
                                    Nuevas
                                </th>
                                <th className="px-2 py-1 text-right font-normal">
                                    Cobrado
                                </th>
                                <th className="px-2 py-1 text-right font-normal">
                                    Adeuda hoy
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {visibles.map((f) => (
                                <tr key={f.label}>
                                    <td className="max-w-[140px] truncate px-2 py-1 text-foreground">
                                        {f.label}
                                    </td>
                                    <td className="px-2 py-1 text-right tabular-nums">
                                        {f.nuevas} · {formatARS(f.monto_nuevas)}
                                    </td>
                                    <td className="px-2 py-1 text-right text-success tabular-nums">
                                        {formatARS(f.cobrado)}
                                    </td>
                                    <td className="px-2 py-1 text-right text-destructive tabular-nums">
                                        {formatARS(f.adeuda)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filas.length > visibles.length && (
                        <p className="border-t border-border px-2 py-1 text-xs text-muted-foreground">
                            y {filas.length - visibles.length} más — en el PDF.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export function ListaActas({
    titulo,
    vacio,
    actas,
}: {
    titulo: string;
    vacio: string;
    actas: ActaFila[];
}) {
    const visibles = actas.slice(0, FILAS_DETALLE);

    return (
        <SeccionPlegable titulo={titulo} cantidad={actas.length}>
            {actas.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    {vacio}
                </p>
            ) : (
                <>
                    <div className="divide-y divide-border">
                        {visibles.map((a) => (
                            <div
                                key={a.id}
                                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-2 py-1 text-xs"
                            >
                                <span className="font-medium text-foreground">
                                    {a.patente}
                                </span>
                                <span className="text-muted-foreground">
                                    {a.conductor ?? 'Sin chofer'}
                                </span>
                                <span className="text-muted-foreground">
                                    {a.jurisdiccion}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                    {a.motivo ?? 'Sin motivo informado'}
                                </span>
                                <span className="text-muted-foreground tabular-nums">
                                    {formatFecha(a.fecha_infraccion)}
                                </span>
                                <span className="font-medium text-foreground tabular-nums">
                                    {a.monto === null
                                        ? 'Sin monto'
                                        : formatARS(a.monto)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {actas.length > visibles.length && (
                        <p className="border-t border-border px-2 py-1 text-xs text-muted-foreground">
                            y {actas.length - visibles.length} más — están todas
                            en el PDF.
                        </p>
                    )}
                </>
            )}
        </SeccionPlegable>
    );
}

export function ListaCobros({ cobros }: { cobros: CobroFila[] }) {
    const visibles = cobros.slice(0, FILAS_DETALLE);

    return (
        <SeccionPlegable
            titulo="Cobros a choferes en el período"
            cantidad={cobros.length}
        >
            {cobros.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    Sin cobros registrados en el período.
                </p>
            ) : (
                <>
                    <div className="divide-y divide-border">
                        {visibles.map((c) => (
                            <div
                                key={c.id}
                                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-2 py-1 text-xs"
                            >
                                <span className="text-muted-foreground tabular-nums">
                                    {formatFecha(c.fecha)}
                                </span>
                                <span className="font-medium text-foreground">
                                    {c.patente ?? '—'}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                    {c.conductor ?? 'Sin chofer'}
                                </span>
                                <span className="text-muted-foreground">
                                    {c.es_transferencia
                                        ? 'Transferencia'
                                        : 'Efectivo'}
                                </span>
                                <span className="font-medium text-success tabular-nums">
                                    {formatARS(c.monto)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {cobros.length > visibles.length && (
                        <p className="border-t border-border px-2 py-1 text-xs text-muted-foreground">
                            y {cobros.length - visibles.length} más — están
                            todos en el PDF.
                        </p>
                    )}
                </>
            )}
        </SeccionPlegable>
    );
}
