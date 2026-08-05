import { Head, router } from '@inertiajs/react';
import {
    Building2,
    ChevronDown,
    CircleCheck,
    RefreshCw,
    Search,
    TriangleAlert,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatARS } from '@/components/money-dual';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { cn } from '@/lib/utils';

interface Acta {
    id: number;
    patente: string;
    jurisdiccion: string;
    acta: string | null;
    motivo: string | null;
    monto: number | null;
    fecha_infraccion: string | null;
    fecha_vencimiento: string | null;
    estado: 'vigente' | 'resuelta';
    resuelta_en: string | null;
    vista_primera_en: string | null;
    vehiculo: string | null;
    conductor_id: number | null;
    conductor: string | null;
}

interface Stats {
    vigentes: number;
    resueltas: number;
    monto_vigente: number;
    bsas: number;
    caba: number;
}

interface Props {
    actas: Acta[];
    stats: Stats;
    ultimoSnapshot: string | null;
}

type EstadoFiltro = 'todas' | 'vigente' | 'resuelta';
type JurisFiltro = 'todas' | 'BSAS' | 'CABA';
type Orden = 'vigentes' | 'monto' | 'cantidad' | 'alfabetico';

interface Grupo {
    key: string;
    patente: string;
    sub: string;
    conductor: string | null;
    actas: Acta[];
    vigentes: number;
    total: number;
}

const ORDEN_LABEL: Record<Orden, string> = {
    vigentes: 'Vigentes',
    monto: 'Monto',
    cantidad: 'Cantidad',
    alfabetico: 'A-Z',
};

/** Fecha ISO (Y-m-d) a dd/mm/aaaa, sin corrimiento de zona horaria. */
function formatFecha(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);

    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Resalta las coincidencias de la búsqueda dentro de un texto. */
function Highlight({ text, query }: { text: string; query: string }) {
    const q = query.trim();

    if (!q) {
        return <>{text}</>;
    }

    const idx = text.toLowerCase().indexOf(q.toLowerCase());

    if (idx === -1) {
        return <>{text}</>;
    }

    return (
        <>
            {text.slice(0, idx)}
            <mark className="rounded bg-amber-200 px-0.5 text-foreground dark:bg-amber-500/40">
                {text.slice(idx, idx + q.length)}
            </mark>
            {text.slice(idx + q.length)}
        </>
    );
}

export default function ActasIndex({ actas, stats, ultimoSnapshot }: Props) {
    useFlashToast();

    const [estado, setEstado] = useState<EstadoFiltro>('vigente');
    const [juris, setJuris] = useState<JurisFiltro>('todas');
    const [search, setSearch] = useState('');
    const [orden, setOrden] = useState<Orden>('vigentes');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [sincronizando, setSincronizando] = useState(false);

    const grupos = useMemo<Grupo[]>(() => {
        const q = search.toLowerCase().trim();

        const visibles = actas.filter((a) => {
            if (estado !== 'todas' && a.estado !== estado) {
                return false;
            }

            if (juris !== 'todas' && a.jurisdiccion !== juris) {
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
                    .filter((a) => a.estado === 'vigente' && a.monto != null)
                    .reduce((s, a) => s + (a.monto ?? 0), 0),
            }))
            .sort((a, b) => {
                if (orden === 'monto') return b.total - a.total || alfa(a, b);
                if (orden === 'cantidad')
                    return b.actas.length - a.actas.length || alfa(a, b);
                if (orden === 'alfabetico') return alfa(a, b);

                // 'vigentes' (default)
                return b.vigentes - a.vigentes || b.total - a.total || alfa(a, b);
            });
    }, [actas, estado, juris, search, orden]);

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
        setExpanded(allExpanded ? new Set() : new Set(grupos.map((g) => g.key)));
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

    const hayFiltros = juris !== 'todas' || estado !== 'vigente' || !!search.trim();

    function limpiarFiltros() {
        setJuris('todas');
        setEstado('vigente');
        setSearch('');
    }

    const totalActasFiltradas = grupos.reduce((s, g) => s + g.actas.length, 0);

    return (
        <>
            <Head title="Multas (feed)" />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                                Multas (feed)
                            </h1>
                            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                                Beta
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Multas traídas automáticamente del feed externo.
                            {ultimoSnapshot
                                ? ` Última actualización: ${formatFecha(ultimoSnapshot)}.`
                                : ' Todavía sin datos: sincronizá para empezar.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={sincronizar}
                        disabled={sincronizando}
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                        <RefreshCw
                            className={cn('h-4 w-4', sincronizando && 'animate-spin')}
                        />
                        {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
                    </button>
                </div>

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
                        label="Pagadas (resueltas)"
                        value={String(stats.resueltas)}
                        sub="Desaparecieron del feed"
                        tone="emerald"
                        icon={CircleCheck}
                    />
                    <div className="col-span-2 flex flex-col justify-center rounded-xl border border-border bg-card px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            <Building2 className="h-3.5 w-3.5" /> Deuda vigente
                            (BSAS)
                        </span>
                        <span className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                            {formatARS(stats.monto_vigente)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            CABA no informa monto en todos los casos
                        </span>
                    </div>
                </div>

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

                    {hayFiltros && (
                        <button
                            type="button"
                            onClick={limpiarFiltros}
                            title="Limpiar filtros"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Toolbar: resumen + orden + expandir todo */}
                {grupos.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">
                            {grupos.length}{' '}
                            {grupos.length === 1 ? 'vehículo' : 'vehículos'} ·{' '}
                            {totalActasFiltradas}{' '}
                            {totalActasFiltradas === 1 ? 'multa' : 'multas'}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                                Ordenar:
                            </span>
                            <div className="flex gap-1.5">
                                {(Object.keys(ORDEN_LABEL) as Orden[]).map((o) => (
                                    <FilterButton
                                        key={o}
                                        active={orden === o}
                                        onClick={() => setOrden(o)}
                                    >
                                        {ORDEN_LABEL[o]}
                                    </FilterButton>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={toggleExpandAll}
                                className="ml-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                {allExpanded ? 'Colapsar todo' : 'Expandir todo'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Lista agrupada por vehículo */}
                {grupos.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
                        No hay multas que coincidan con los filtros.
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
                                            <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                {g.vigentes} vigente
                                                {g.vigentes !== 1 ? 's' : ''}
                                            </span>
                                        ) : (
                                            <span className="shrink-0 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
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
                                                <span className="w-[80px] shrink-0 text-[11px] font-medium text-muted-foreground">
                                                    Fecha inf.
                                                </span>
                                                <span className="w-[80px] shrink-0 text-[11px] font-medium text-muted-foreground">
                                                    Vencimiento
                                                </span>
                                                <span className="w-[64px] shrink-0 text-[11px] font-medium text-muted-foreground">
                                                    Jurisd.
                                                </span>
                                                <span className="w-32 shrink-0 text-[11px] font-medium text-muted-foreground">
                                                    Conductor
                                                </span>
                                                <span className="min-w-0 flex-1 text-[11px] font-medium text-muted-foreground">
                                                    Motivo
                                                </span>
                                                <span className="w-28 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                                                    Monto
                                                </span>
                                                <span className="w-24 shrink-0 text-[11px] font-medium text-muted-foreground">
                                                    Estado
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
                                                        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                            {a.jurisdiccion}
                                                        </span>
                                                    </span>
                                                    <span className="w-32 shrink-0 truncate text-sm text-foreground">
                                                        {a.conductor ? (
                                                            <Highlight
                                                                text={a.conductor}
                                                                query={search}
                                                            />
                                                        ) : (
                                                            <span className="text-muted-foreground italic">
                                                                Sin chofer
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex min-w-0 flex-1 flex-col">
                                                        <span className="text-sm text-foreground">
                                                            {a.motivo ?? '—'}
                                                        </span>
                                                        {a.acta && (
                                                            <span className="truncate font-mono text-[11px] text-muted-foreground">
                                                                {a.acta}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="w-28 shrink-0 text-left text-sm font-semibold whitespace-nowrap text-foreground tabular-nums sm:text-right">
                                                        {a.monto != null
                                                            ? formatARS(a.monto)
                                                            : '—'}
                                                    </span>
                                                    <span className="w-24 shrink-0">
                                                        <EstadoBadge acta={a} />
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
            </div>
        </>
    );
}

function StatCard({
    label,
    value,
    sub,
    tone,
    icon: Icon,
}: {
    label: string;
    value: string;
    sub: string;
    tone: 'amber' | 'emerald';
    icon: typeof TriangleAlert;
}) {
    const tones = {
        amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    }[tone];

    return (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <span
                className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    tones,
                )}
            >
                <Icon className="h-5 w-5" />
            </span>
            <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {label}
                </span>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                    {value}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {sub}
                </span>
            </div>
        </div>
    );
}

function EstadoBadge({ acta }: { acta: Acta }) {
    if (acta.estado === 'resuelta') {
        return (
            <span
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-400"
                title={
                    acta.resuelta_en
                        ? `Dejó de aparecer el ${formatFecha(acta.resuelta_en)}`
                        : undefined
                }
            >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Pagada
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-amber-700 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Vigente
        </span>
    );
}

function FilterButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex h-full items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                active
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            {children}
        </button>
    );
}

ActasIndex.layout = {
    breadcrumbs: [{ title: 'Multas (feed)', href: '/actas' }],
};
