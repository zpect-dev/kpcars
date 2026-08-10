import { Head, router, useForm } from '@inertiajs/react';
import {
    Building2,
    Check,
    ChevronDown,
    CircleCheck,
    FileText,
    Filter,
    HandCoins,
    RefreshCw,
    Search,
    Trash2,
    TriangleAlert,
    User as UserIcon,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatARS } from '@/components/money-dual';
import { useImageCropper } from '@/components/image-cropper';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
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
    posible_duplicado: boolean;
    pago_voluntario: boolean;
    punto_rojo: boolean;
    sin_importe: boolean;
    monto_efectivo: number;
    cobrado: boolean;
    cobrada_en: string | null;
    monto_cobrado: number;
    adeudado: number;
    pagos: Pago[];
}

interface Pago {
    id: number;
    fecha: string | null;
    monto: number;
    comprobante_url: string | null;
    es_transferencia: boolean;
}

/** Estado del cobro al chofer: sin cobrar / parcial / cobrada. */
function estadoCobro(a: Acta): 'sin' | 'parcial' | 'cobrada' {
    if (a.cobrado) return 'cobrada';
    if (a.monto_cobrado > 0) return 'parcial';
    return 'sin';
}

interface UltimaSync {
    ok: boolean;
    origen: string;
    error: string | null;
    cuando: string | null;
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
    diasResueltas: number;
    ultimaSync: UltimaSync | null;
}

type EstadoFiltro = 'todas' | 'vigente' | 'resuelta';
type JurisFiltro = 'todas' | 'BSAS' | 'CABA';
type ChoferFiltro = 'todos' | 'con' | 'sin';
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

export default function ActasIndex({
    actas,
    stats,
    ultimoSnapshot,
    diasResueltas,
    ultimaSync,
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
                if (orden === 'monto') return b.total - a.total || alfa(a, b);
                if (orden === 'cantidad')
                    return b.actas.length - a.actas.length || alfa(a, b);
                if (orden === 'alfabetico') return alfa(a, b);

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
                            className={cn(
                                'h-4 w-4',
                                sincronizando && 'animate-spin',
                            )}
                        />
                        {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
                    </button>
                </div>

                {/* Aviso: última sincronización falló */}
                {ultimaSync && !ultimaSync.ok && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
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
                                                <span className="w-28 shrink-0 text-[11px] font-medium text-muted-foreground">
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
                                                        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
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
                                                                    className="inline-flex shrink-0 items-center rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                                                >
                                                                    ¿Dup.
                                                                    manual?
                                                                </span>
                                                            )}
                                                        </span>
                                                        {a.acta && (
                                                            <span className="truncate font-mono text-[11px] text-muted-foreground">
                                                                {a.acta}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex w-28 shrink-0 flex-col items-start sm:items-end">
                                                        {a.punto_rojo ? (
                                                            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
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
                                                                <span className="text-sm font-semibold text-green-600 tabular-nums dark:text-green-400">
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
            </div>

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

function CobroButton({ acta, onClick }: { acta: Acta; onClick: () => void }) {
    if (acta.sin_importe) {
        return (
            <span className="text-[11px] text-muted-foreground/60 italic">
                Sin importe
            </span>
        );
    }

    const estado = estadoCobro(acta);

    const estilos = {
        sin: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
        parcial:
            'border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400',
        cobrada:
            'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400',
    }[estado];

    const label = {
        sin: 'Cobrar',
        parcial: 'Parcial',
        cobrada: 'Cobrada',
    }[estado];

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                estilos,
            )}
        >
            <HandCoins className="h-3.5 w-3.5" />
            {label}
        </button>
    );
}

function CobrarActaForm({
    acta,
    onClose,
}: {
    acta: Acta;
    onClose: () => void;
}) {
    const today = new Date().toISOString().slice(0, 10);
    const total = acta.monto_efectivo;
    const pagado = acta.monto_cobrado;
    const falta = Math.max(total - pagado, 0);
    const fully = acta.cobrado;

    const form = useForm({
        monto: fully ? '' : String(falta.toFixed(2)),
        fecha_cobro: today,
        comprobante: null as File | null,
        es_transferencia: false,
    });

    const { cropImage, cropperElement } = useImageCropper();

    async function handleComprobante(f: File | null) {
        // Solo las imágenes pasan por el editor de recorte; los PDF van directo.
        if (f && f.type.startsWith('image/')) {
            try {
                form.setData('comprobante', await cropImage(f));
            } catch {
                // recorte cancelado
            }
            return;
        }
        form.setData('comprobante', f);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        // Comprobante por multipart; la ruta es PATCH, hay que falsear el método.
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post(`/actas/${acta.id}/cobrado`, {
            preserveScroll: true,
            preserveState: true,
            only: ['actas', 'stats', 'flash'],
            forceFormData: true,
            onSuccess: () => onClose(),
        });
    }

    function reiniciar() {
        router.patch(
            `/actas/${acta.id}/cobrado`,
            { reset: true },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['actas', 'stats', 'flash'],
                onSuccess: () => onClose(),
            },
        );
    }

    function eliminarPago(pagoId: number) {
        router.delete(`/actas/${acta.id}/pagos/${pagoId}`, {
            preserveScroll: true,
            preserveState: true,
            only: ['actas', 'stats', 'flash'],
            onSuccess: () => onClose(),
        });
    }

    const montoNum = Number(form.data.monto);
    const puedeRegistrar =
        montoNum > 0 && form.data.fecha_cobro !== '' && !form.processing;

    return (
        <form onSubmit={submit}>
            {cropperElement}
            <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/15">
                    <UserIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                    <DialogTitle className="text-base font-semibold">
                        Cobro al chofer
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        <span className="font-mono font-semibold uppercase">
                            {acta.patente}
                        </span>
                        {acta.conductor ? ` · ${acta.conductor}` : ''}
                    </DialogDescription>
                </div>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5">
                {/* Resumen del cobro */}
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center">
                    <div>
                        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                            Total
                        </p>
                        <p className="text-sm font-bold text-foreground tabular-nums">
                            {formatARS(total)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                            Pagado
                        </p>
                        <p className="text-sm font-bold text-green-600 tabular-nums dark:text-green-400">
                            {formatARS(pagado)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                            Falta
                        </p>
                        <p
                            className={cn(
                                'text-sm font-bold tabular-nums',
                                falta > 0
                                    ? 'text-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {formatARS(falta)}
                        </p>
                    </div>
                </div>

                {/* Pagos registrados */}
                {acta.pagos.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                            Pagos registrados
                        </p>
                        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                            {acta.pagos.map((p) => (
                                <div
                                    key={p.id}
                                    className="flex items-center gap-2 px-3 py-2"
                                >
                                    <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                                        {formatFecha(p.fecha)}
                                    </span>
                                    <span className="text-sm font-semibold text-foreground tabular-nums">
                                        {formatARS(p.monto)}
                                    </span>
                                    <span className="flex-1">
                                        {p.es_transferencia ? (
                                            <span
                                                className="inline-flex items-center rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400"
                                                title="Pagado por transferencia"
                                            >
                                                Transferencia
                                            </span>
                                        ) : (
                                            <span
                                                className="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                                                title="Pagado en efectivo"
                                            >
                                                Efectivo
                                            </span>
                                        )}
                                    </span>
                                    {p.comprobante_url ? (
                                        <a
                                            href={p.comprobante_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Ver comprobante"
                                            className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                            <FileText className="h-3 w-3" />{' '}
                                            Comp.
                                        </a>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground/60">
                                            sin comprobante
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => eliminarPago(p.id)}
                                        title="Eliminar pago"
                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {fully ? (
                    <p className="text-center text-sm font-medium text-green-600 dark:text-green-400">
                        Cobrada por completo
                        {acta.cobrada_en
                            ? ` el ${formatFecha(acta.cobrada_en)}`
                            : ''}
                        .
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cobro-monto">
                                    Monto que pagó
                                </Label>
                                <MoneyInput
                                    id="cobro-monto"
                                    value={
                                        form.data.monto === ''
                                            ? null
                                            : Number(form.data.monto)
                                    }
                                    onValueChange={(n) =>
                                        form.setData(
                                            'monto',
                                            n == null ? '' : String(n),
                                        )
                                    }
                                />
                                {form.errors.monto && (
                                    <p className="text-xs text-red-600">
                                        {form.errors.monto}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cobro-fecha">
                                    Fecha del pago
                                </Label>
                                <Input
                                    id="cobro-fecha"
                                    type="date"
                                    value={form.data.fecha_cobro}
                                    max={today}
                                    onChange={(e) =>
                                        form.setData(
                                            'fecha_cobro',
                                            e.target.value,
                                        )
                                    }
                                />
                                {form.errors.fecha_cobro && (
                                    <p className="text-xs text-red-600">
                                        {form.errors.fecha_cobro}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Método de pago: efectivo (sin comprobante) o transferencia. */}
                        <div className="flex flex-col gap-1.5">
                            <Label>Método de pago</Label>
                            <div className="inline-flex overflow-hidden rounded-lg border border-border">
                                <button
                                    type="button"
                                    onClick={() => {
                                        form.setData('es_transferencia', false);
                                        form.setData('comprobante', null);
                                    }}
                                    className={cn(
                                        'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                                        !form.data.es_transferencia
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-transparent text-muted-foreground hover:bg-muted',
                                    )}
                                >
                                    Efectivo
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        form.setData('es_transferencia', true)
                                    }
                                    className={cn(
                                        'flex-1 border-l border-border px-3 py-2 text-sm font-medium transition-colors',
                                        form.data.es_transferencia
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-transparent text-muted-foreground hover:bg-muted',
                                    )}
                                >
                                    Transferencia
                                </button>
                            </div>
                        </div>

                        {/* El comprobante solo aplica a la transferencia; en efectivo no se pide. */}
                        {form.data.es_transferencia && (
                            <div className="flex flex-col gap-1.5">
                                <Label>
                                    Comprobante{' '}
                                    <span className="font-normal text-muted-foreground">
                                        (opcional)
                                    </span>
                                </Label>
                                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40">
                                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span
                                        className={cn(
                                            'min-w-0 flex-1 truncate',
                                            form.data.comprobante
                                                ? 'text-foreground'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {form.data.comprobante
                                            ? form.data.comprobante.name
                                            : 'Adjuntar comprobante (PDF o imagen)...'}
                                    </span>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            handleComprobante(
                                                e.target.files?.[0] ?? null,
                                            );
                                            e.target.value = '';
                                        }}
                                    />
                                </label>
                                {form.errors.comprobante && (
                                    <p className="text-xs text-red-600">
                                        {form.errors.comprobante}
                                    </p>
                                )}
                            </div>
                        )}

                        <p className="-mt-1 text-[11px] text-muted-foreground">
                            Si el pago no cubre el total, el acta queda como
                            cobro parcial (pendiente).
                        </p>
                    </>
                )}
            </div>

            <DialogFooter className="flex flex-row flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
                {pagado > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={reiniciar}
                        className="mr-auto text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                        Reiniciar cobro
                    </Button>
                )}
                <Button type="button" variant="outline" onClick={onClose}>
                    <X className="h-4 w-4" /> Cerrar
                </Button>
                {!fully && (
                    <Button type="submit" disabled={!puedeRegistrar}>
                        {form.processing ? (
                            'Guardando...'
                        ) : (
                            <>
                                <Check className="h-4 w-4" /> Registrar pago
                            </>
                        )}
                    </Button>
                )}
            </DialogFooter>
        </form>
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
