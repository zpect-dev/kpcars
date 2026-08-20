import { Head, router } from '@inertiajs/react';
import {
    Building2,
    ChevronDown,
    ClipboardList,
    CircleCheck,
    Filter,
    Search,
    RefreshCw,
    TriangleAlert,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    EstadoBadge,
    FilterButton,
    Highlight,
    StatCard,
} from '@/components/actas/atomos';
import { CobrarActaForm, CobroButton } from '@/components/actas/cobrar-modal';
import { ReportesPanel } from '@/components/actas/reportes-panel';
import {
    formatFecha,
    ORDEN_LABEL,
} from '@/components/actas/tipos';
import type {
    Acta,
    ChoferFiltro,
    EstadoFiltro,
    Grupo,
    JurisFiltro,
    Orden,
    Reporte,
    ReporteDetalle,
    Stats,
    UltimaSync,
} from '@/components/actas/tipos';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { formatARS } from '@/components/money-dual';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { cn } from '@/lib/utils';

interface Props {
    actas: Acta[];
    stats: Stats;
    ultimoSnapshot: string | null;
    diasResueltas: number;
    ultimaSync: UltimaSync | null;
    reportes: Reporte[];
    reporteDetalle: ReporteDetalle | null;
}


export default function ActasIndex({
    actas,
    stats,
    ultimoSnapshot,
    diasResueltas,
    ultimaSync,
    reportes,
    reporteDetalle,
}: Props) {
    useFlashToast();

    const [estado, setEstado] = useState<EstadoFiltro>('vigente');
    const [juris, setJuris] = useState<JurisFiltro>('todas');
    const [chofer, setChofer] = useState<ChoferFiltro>('todos');
    const [search, setSearch] = useState('');
    const [orden, setOrden] = useState<Orden>('vigentes');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [sincronizando, setSincronizando] = useState(false);
    const [cobrando, setCobrando] = useState<Acta | null>(null);

    const grupos = useMemo<Grupo[]>(() => {
        const q = search.toLowerCase().trim();

        const visibles = actas.filter((a) => {
            if (estado !== 'todas' && a.estado !== estado) {
                return false;
            }

            if (juris !== 'todas' && a.jurisdiccion !== juris) {
                return false;
            }

            if (chofer === 'sin' && a.conductor_id !== null) {
                return false;
            }

            if (chofer === 'con' && a.conductor_id === null) {
                return false;
            }

            if (
                q &&
                !a.patente.toLowerCase().includes(q) &&
                !(a.conductor ?? '').toLowerCase().includes(q)
            ) {
                return false;
            }

            return true;
        });

        const map = new Map<string, Grupo>();

        for (const a of visibles) {
            let g = map.get(a.patente);

            if (!g) {
                g = {
                    key: a.patente,
                    patente: a.patente,
                    sub: a.vehiculo ?? '',
                    conductor: a.conductor,
                    actas: [],
                    vigentes: 0,
                    total: 0,
                };
                map.set(a.patente, g);
            }

            g.actas.push(a);
        }

        const alfa = (a: Grupo, b: Grupo) =>
            a.patente.localeCompare(b.patente, 'es', { numeric: true });

        return Array.from(map.values())
            .map((g) => ({
                ...g,
                vigentes: g.actas.filter((a) => a.estado === 'vigente').length,
                total: g.actas
                    .filter((a) => a.estado === 'vigente')
                    .reduce((s, a) => s + a.monto_efectivo, 0),
            }))
            .sort((a, b) => {
                if (orden === 'monto') {
return b.total - a.total || alfa(a, b);
}

                if (orden === 'cantidad') {
return b.actas.length - a.actas.length || alfa(a, b);
}

                if (orden === 'alfabetico') {
return alfa(a, b);
}

                // 'vigentes' (default)
                return (
                    b.vigentes - a.vigentes || b.total - a.total || alfa(a, b)
                );
            });
    }, [actas, estado, juris, chofer, search, orden]);

    function toggleExpand(key: string) {
        setExpanded((prev) => {
            const next = new Set(prev);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    }

    const allExpanded =
        grupos.length > 0 && grupos.every((g) => expanded.has(g.key));

    function toggleExpandAll() {
        setExpanded(
            allExpanded ? new Set() : new Set(grupos.map((g) => g.key)),
        );
    }

    function sincronizar() {
        setSincronizando(true);
        router.post(
            '/actas/sincronizar',
            {},
            {
                preserveScroll: true,
                onFinish: () => setSincronizando(false),
            },
        );
    }

    const hayFiltros =
        juris !== 'todas' ||
        estado !== 'vigente' ||
        chofer !== 'todos' ||
        !!search.trim();

    function limpiarFiltros() {
        setJuris('todas');
        setEstado('vigente');
        setChofer('todos');
        setSearch('');
    }

    const totalActasFiltradas = grupos.reduce((s, g) => s + g.actas.length, 0);
    // Deuda vigente del set filtrado (g.total ya suma solo vigentes con monto).
    const deudaFiltrada = grupos.reduce((s, g) => s + g.total, 0);

    return (
        <>
            <Head title="Multas (feed)" />

            <PageContainer className="gap-5 sm:p-6">
                <PageHeader
                    title="Multas (feed)"
                    meta={
                        <span className="rounded-md border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-semibold tracking-wide text-warning-soft-foreground uppercase">
                            Beta
                        </span>
                    }
                    description={
                        <>
                            Multas traídas automáticamente del feed externo.
                            {ultimoSnapshot
                                ? ` Última actualización: ${formatFecha(ultimoSnapshot)}.`
                                : ' Todavía sin datos: sincronizá para empezar.'}
                        </>
                    }
                    actions={
                        <Button
                            size="sm"
                            onClick={sincronizar}
                            disabled={sincronizando}
                        >
                            <RefreshCw
                                aria-hidden="true"
                                className={cn(
                                    'size-4',
                                    sincronizando && 'animate-spin',
                                )}
                            />
                            {sincronizando
                                ? 'Sincronizando…'
                                : 'Sincronizar ahora'}
                        </Button>
                    }
                />

                {/* Aviso: última sincronización falló */}
                {ultimaSync && !ultimaSync.ok && (
                    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                            <p className="font-medium">
                                La última sincronización falló
                                {ultimaSync.cuando
                                    ? ` (${formatFecha(ultimaSync.cuando.slice(0, 10))})`
                                    : ''}
                                . Los datos pueden estar desactualizados.
                            </p>
                            {ultimaSync.error && (
                                <p className="mt-0.5 truncate text-xs opacity-80">
                                    {ultimaSync.error}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                        label="Multas vigentes"
                        value={String(stats.vigentes)}
                        sub={`${stats.bsas} BSAS · ${stats.caba} CABA`}
                        tone="amber"
                        icon={TriangleAlert}
                    />
                    <StatCard
                        label="Pagadas al sistema"
                        value={String(stats.resueltas)}
                        sub={`Pagadas en los ultimos ${diasResueltas} días`}
                        tone="emerald"
                        icon={CircleCheck}
                    />
                    <div className="col-span-2 flex flex-col justify-center rounded-xl border border-border bg-card px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            <Building2 className="h-3.5 w-3.5" /> Deuda vigente
                        </span>
                        <span className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                            {formatARS(stats.monto_vigente)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Mayormente BSAS: CABA no informa monto en todos los
                            casos
                        </span>
                    </div>
                </div>

                {/* Reportes de cada sincronización */}
                <ReportesPanel reportes={reportes} detalle={reporteDetalle} />

                {/* Filtros */}
                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
                    <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                        <Label htmlFor="buscar">Buscar</Label>
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="buscar"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Patente o conductor…"
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Estado</Label>
                        <div className="flex h-9 gap-1.5">
                            {(
                                [
                                    { key: 'vigente', label: 'Vigentes' },
                                    { key: 'resuelta', label: 'Pagadas' },
                                    { key: 'todas', label: 'Todas' },
                                ] as { key: EstadoFiltro; label: string }[]
                            ).map((t) => (
                                <FilterButton
                                    key={t.key}
                                    active={estado === t.key}
                                    onClick={() => setEstado(t.key)}
                                >
                                    {t.label}
                                </FilterButton>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Jurisdicción</Label>
                        <div className="flex h-9 gap-1.5">
                            {(
                                [
                                    { key: 'todas', label: 'Todas' },
                                    { key: 'BSAS', label: 'BSAS' },
                                    { key: 'CABA', label: 'CABA' },
                                ] as { key: JurisFiltro; label: string }[]
                            ).map((t) => (
                                <FilterButton
                                    key={t.key}
                                    active={juris === t.key}
                                    onClick={() => setJuris(t.key)}
                                >
                                    {t.label}
                                </FilterButton>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Chofer</Label>
                        <div className="flex h-9 gap-1.5">
                            {(
                                [
                                    { key: 'todos', label: 'Todos' },
                                    { key: 'con', label: 'Con chofer' },
                                    { key: 'sin', label: 'Sin chofer' },
                                ] as { key: ChoferFiltro; label: string }[]
                            ).map((t) => (
                                <FilterButton
                                    key={t.key}
                                    active={chofer === t.key}
                                    onClick={() => setChofer(t.key)}
                                >
                                    {t.label}
                                </FilterButton>
                            ))}
                        </div>
                    </div>

                    {hayFiltros && (
                        <button
                            type="button"
                            onClick={limpiarFiltros}
                            title="Limpiar filtros"
                            aria-label="Limpiar filtros"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Toolbar: resumen + orden + expandir todo */}
                {grupos.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <span className="text-sm text-muted-foreground">
                                {grupos.length}{' '}
                                {grupos.length === 1 ? 'vehículo' : 'vehículos'}{' '}
                                · {totalActasFiltradas}{' '}
                                {totalActasFiltradas === 1 ? 'multa' : 'multas'}
                            </span>
                            {hayFiltros && (
                                <span
                                    title="Deuda vigente del filtro aplicado"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary tabular-nums"
                                >
                                    <Filter className="h-3 w-3" />
                                    {formatARS(deudaFiltrada)}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                                Ordenar:
                            </span>
                            <div className="flex gap-1.5">
                                {(Object.keys(ORDEN_LABEL) as Orden[]).map(
                                    (o) => (
                                        <FilterButton
                                            key={o}
                                            active={orden === o}
                                            onClick={() => setOrden(o)}
                                        >
                                            {ORDEN_LABEL[o]}
                                        </FilterButton>
                                    ),
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={toggleExpandAll}
                                className="ml-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                {allExpanded
                                    ? 'Colapsar todo'
                                    : 'Expandir todo'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Lista agrupada por vehículo */}
                {grupos.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card shadow-sm">
                        <EmptyState
                            variant={hayFiltros ? 'filtered' : 'empty'}
                            icon={hayFiltros ? undefined : ClipboardList}
                            title={
                                hayFiltros
                                    ? 'Ninguna multa coincide con los filtros'
                                    : 'Todavía no hay multas en el feed'
                            }
                            description={
                                hayFiltros
                                    ? 'Probá con otra patente o quitá algún filtro.'
                                    : 'Sincronizá con el feed externo para traer las multas.'
                            }
                            action={
                                hayFiltros
                                    ? {
                                          label: 'Limpiar filtros',
                                          onClick: limpiarFiltros,
                                      }
                                    : {
                                          label: 'Sincronizar ahora',
                                          onClick: sincronizar,
                                      }
                            }
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {grupos.map((g) => {
                            const isOpen =
                                search.trim().length > 0 || expanded.has(g.key);

                            return (
                                <div
                                    key={g.key}
                                    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(g.key)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                                    >
                                        <ChevronDown
                                            className={cn(
                                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                                isOpen && 'rotate-180',
                                            )}
                                        />
                                        <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-sm font-bold tracking-wide text-foreground uppercase">
                                            <Highlight
                                                text={g.patente}
                                                query={search}
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                            {g.sub || '—'}
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                            {g.actas.length}{' '}
                                            {g.actas.length !== 1
                                                ? 'multas'
                                                : 'multa'}
                                        </span>
                                        {g.vigentes > 0 ? (
                                            <span className="shrink-0 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-soft-foreground">
                                                {g.vigentes} vigente
                                                {g.vigentes !== 1 ? 's' : ''}
                                            </span>
                                        ) : (
                                            <span className="shrink-0 rounded-md bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-soft-foreground">
                                                Al día
                                            </span>
                                        )}
                                        <span className="min-w-[90px] shrink-0 text-right text-sm font-bold text-foreground tabular-nums">
                                            {formatARS(g.total)}
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <div className="border-t border-border">
                                            {/* Header — solo desktop */}
                                            <div className="hidden items-center gap-4 border-b border-border bg-muted/30 px-4 py-2 sm:flex">
                                                <span className="w-[80px] shrink-0 text-xs font-medium text-muted-foreground">
                                                    Fecha inf.
                                                </span>
                                                <span className="w-[80px] shrink-0 text-xs font-medium text-muted-foreground">
                                                    Vencimiento
                                                </span>
                                                <span className="w-[64px] shrink-0 text-xs font-medium text-muted-foreground">
                                                    Jurisd.
                                                </span>
                                                <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">
                                                    Conductor
                                                </span>
                                                <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                                                    Motivo
                                                </span>
                                                <span className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
                                                    Monto
                                                </span>
                                                <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">
                                                    Estado
                                                </span>
                                                <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
                                                    Cobro chofer
                                                </span>
                                            </div>

                                            {g.actas.map((a) => (
                                                <div
                                                    key={a.id}
                                                    className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4"
                                                >
                                                    <span className="w-[80px] shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                                                        {formatFecha(
                                                            a.fecha_infraccion,
                                                        )}
                                                    </span>
                                                    <span className="w-[80px] shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                                                        {formatFecha(
                                                            a.fecha_vencimiento,
                                                        )}
                                                    </span>
                                                    <span className="w-[64px] shrink-0">
                                                        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                                                            {a.jurisdiccion}
                                                        </span>
                                                    </span>
                                                    <span className="w-32 shrink-0 truncate text-sm text-foreground">
                                                        {a.conductor ? (
                                                            <Highlight
                                                                text={
                                                                    a.conductor
                                                                }
                                                                query={search}
                                                            />
                                                        ) : (
                                                            <span className="text-muted-foreground italic">
                                                                Sin chofer
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex min-w-0 flex-1 flex-col">
                                                        <span className="flex items-center gap-1.5 text-sm text-foreground">
                                                            <span className="truncate">
                                                                {a.motivo ??
                                                                    '—'}
                                                            </span>
                                                            {a.posible_duplicado && (
                                                                <span
                                                                    title="Posible duplicado de una multa cargada a mano (misma unidad, fecha y monto)"
                                                                    className="inline-flex shrink-0 items-center rounded-md bg-warning-soft px-1.5 py-0.5 text-xs font-semibold text-warning-soft-foreground"
                                                                >
                                                                    ¿Dup.
                                                                    manual?
                                                                </span>
                                                            )}
                                                        </span>
                                                        {a.acta && (
                                                            <span className="truncate font-mono text-xs text-muted-foreground">
                                                                {a.acta}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex w-28 shrink-0 flex-col items-start sm:items-end">
                                                        {a.punto_rojo ? (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-destructive-soft px-1.5 py-0.5 text-xs font-semibold text-destructive-soft-foreground">
                                                                <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
                                                                Punto rojo
                                                            </span>
                                                        ) : a.pago_voluntario &&
                                                          a.monto != null ? (
                                                            <div
                                                                className="flex flex-col items-start gap-0.5 sm:items-end"
                                                                title="Pago voluntario: el feed ya trae el monto con descuento"
                                                            >
                                                                <span className="text-sm font-semibold text-muted-foreground tabular-nums line-through">
                                                                    {formatARS(
                                                                        a.monto *
                                                                            2,
                                                                    )}
                                                                </span>
                                                                <span className="text-sm font-semibold text-success tabular-nums">
                                                                    {formatARS(
                                                                        a.monto,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm font-semibold whitespace-nowrap text-foreground tabular-nums">
                                                                {a.monto != null
                                                                    ? formatARS(
                                                                          a.monto,
                                                                      )
                                                                    : '—'}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="w-24 shrink-0">
                                                        <EstadoBadge acta={a} />
                                                    </span>
                                                    <span className="w-28 shrink-0">
                                                        <CobroButton
                                                            acta={a}
                                                            onClick={() =>
                                                                setCobrando(a)
                                                            }
                                                        />
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </PageContainer>

            <Dialog
                open={cobrando !== null}
                onOpenChange={(o) => !o && setCobrando(null)}
            >
                <DialogContent className="gap-0 p-0 sm:max-w-lg">
                    {cobrando && (
                        <CobrarActaForm
                            acta={cobrando}
                            onClose={() => setCobrando(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

ActasIndex.layout = {
    breadcrumbs: [{ title: 'Multas (feed)', href: '/actas' }],
};
