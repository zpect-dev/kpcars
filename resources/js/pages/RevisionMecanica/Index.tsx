import { Head, router } from '@inertiajs/react';
import { Check, ChevronDown, Download, MessageSquareText, Search, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Prioridad = 'baja' | 'media' | 'alta';

interface ItemDef {
    key: string;
    label: string;
}

interface RevisionItem {
    gravedad: number;
    descripcion?: string | null;
}

interface Revision {
    promedio: number;
    prioridad: Prioridad;
    items: Record<string, RevisionItem>;
    observaciones?: string | null;
    revisor?: string | null;
    fecha: string;
}

interface Fila {
    vehiculo_id: number;
    patente: string;
    marca: string;
    modelo: string;
    chofer: string;
    inversion?: string | null;
    revision: Revision | null;
}

interface Props {
    filas: Fila[];
    items: ItemDef[];
}

const GRAVEDAD: { v: number; label: string; active: string; dot: string }[] = [
    { v: 1, label: 'Bien',     active: 'border-green-500 bg-green-500 text-white',     dot: 'bg-green-500' },
    { v: 2, label: 'Leve',     active: 'border-emerald-500 bg-emerald-500 text-white', dot: 'bg-emerald-400' },
    { v: 3, label: 'Moderado', active: 'border-amber-500 bg-amber-500 text-white',     dot: 'bg-amber-500' },
    { v: 4, label: 'Grave',    active: 'border-orange-500 bg-orange-500 text-white',   dot: 'bg-orange-500' },
    { v: 5, label: 'Crítico',  active: 'border-red-500 bg-red-500 text-white',         dot: 'bg-red-500' },
];

const PRIORIDAD: Record<Prioridad, { label: string; badge: string; dot: string; border: string; row: string }> = {
    alta:  { label: 'Alta',  badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         dot: 'bg-red-500',   border: 'border-l-red-500',   row: 'bg-red-500/5' },
    media: { label: 'Media', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-l-amber-500', row: 'bg-amber-500/5' },
    baja:  { label: 'Baja',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500', border: 'border-l-green-500', row: 'bg-green-500/5' },
};

const ITEM_ROW_BG: Record<number, string> = {
    1: '',
    2: '',
    3: 'bg-amber-500/5',
    4: 'bg-orange-500/8',
    5: 'bg-red-500/8',
};

const PESO: Record<Prioridad, number> = { alta: 3, media: 2, baja: 1 };

function prioridadDe(valores: Record<string, RevisionItem>): Prioridad {
    const maximo = Object.values(valores).reduce((max, it) => Math.max(max, it.gravedad ?? 1), 1);
    return maximo <= 2 ? 'baja' : maximo === 3 ? 'media' : 'alta';
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PrioridadBadge({ prioridad }: { prioridad: Prioridad }) {
    const p = PRIORIDAD[prioridad];
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', p.badge)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', p.dot)} />
            {p.label}
        </span>
    );
}

function GravedadSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="flex gap-1">
            {GRAVEDAD.map((g) => (
                <Tooltip key={g.v}>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => onChange(g.v)}
                            className={cn(
                                'flex h-8 flex-1 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-all active:scale-[0.97]',
                                value === g.v ? g.active : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            {g.v}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>{g.label}</TooltipContent>
                </Tooltip>
            ))}
        </div>
    );
}

type Filtro = 'all' | Prioridad | 'pendiente';

export default function RevisionMecanicaIndex({ filas, items }: Props) {
    const [search, setSearch] = useState('');
    const [filtro, setFiltro] = useState<Filtro>('all');
    const [abierto, setAbierto] = useState<Fila | null>(null);

    const stats = useMemo(() => ({
        alta:      filas.filter((f) => f.revision?.prioridad === 'alta').length,
        media:     filas.filter((f) => f.revision?.prioridad === 'media').length,
        baja:      filas.filter((f) => f.revision?.prioridad === 'baja').length,
        pendiente: filas.filter((f) => !f.revision).length,
    }), [filas]);

    const filtradas = useMemo(() => {
        const q = search.toLowerCase().trim();
        const result = filas.filter((f) => {
            if (filtro === 'pendiente' && f.revision) return false;
            if (filtro !== 'all' && filtro !== 'pendiente' && f.revision?.prioridad !== filtro) return false;
            if (q) return f.patente.toLowerCase().includes(q) || f.chofer.toLowerCase().includes(q);
            return true;
        });
        return [...result].sort((a, b) => {
            const pa = a.revision ? PESO[a.revision.prioridad] : 0;
            const pb = b.revision ? PESO[b.revision.prioridad] : 0;
            if (pa !== pb) return pb - pa;
            const ma = a.revision?.promedio ?? -1;
            const mb = b.revision?.promedio ?? -1;
            if (ma !== mb) return mb - ma;
            return a.patente.localeCompare(b.patente, 'es', { numeric: true });
        });
    }, [filas, search, filtro]);

    function toggleFiltro(val: Filtro) {
        setFiltro((prev) => prev === val ? 'all' : val);
    }

    function buildPdfUrl() {
        const p = new URLSearchParams();
        if (search.trim()) p.set('q', search.trim());
        if (filtro !== 'all') p.set('prioridad', filtro);
        const qs = p.toString();
        return `/revision-mecanica/pdf${qs ? `?${qs}` : ''}`;
    }

    return (
        <>
            <Head title="Revisión Mecánica" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">Revisión Mecánica</h1>
                        <p className="text-xs text-muted-foreground">
                            Vehículos con chofer asignado. Tocá uno para revisar su estado mecánico y definir la prioridad de reparación.
                        </p>
                    </div>
                    <a
                        href={buildPdfUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Exportar PDF</span>
                    </a>
                </div>

                {/* Stats — clickeables para filtrar */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {([
                        { key: 'alta',      label: 'Prioridad alta',  value: stats.alta,      cls: 'border-red-500/20 bg-red-500/5',     active: 'ring-2 ring-red-500/40',   text: 'text-red-700 dark:text-red-400' },
                        { key: 'media',     label: 'Prioridad media', value: stats.media,     cls: 'border-amber-500/20 bg-amber-500/5', active: 'ring-2 ring-amber-500/40', text: 'text-amber-700 dark:text-amber-400' },
                        { key: 'baja',      label: 'Prioridad baja',  value: stats.baja,      cls: 'border-green-500/20 bg-green-500/5', active: 'ring-2 ring-green-500/40', text: 'text-green-700 dark:text-green-400' },
                        { key: 'pendiente', label: 'Sin revisar',     value: stats.pendiente, cls: 'border-border bg-card',              active: 'ring-2 ring-border',        text: 'text-muted-foreground' },
                    ] as const).map((s) => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => toggleFiltro(s.key)}
                            className={cn(
                                'flex flex-col gap-0.5 overflow-hidden rounded-xl border px-4 py-3 shadow-sm text-left transition-all active:scale-[0.98]',
                                s.cls,
                                filtro === s.key && s.active,
                            )}
                        >
                            <span className={cn('text-xs', s.text)}>{s.label}</span>
                            <span className="text-lg font-bold tabular-nums text-foreground">{s.value}</span>
                        </button>
                    ))}
                </div>

                {/* Buscador */}
                <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Buscar patente o chofer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Lista */}
                {filtradas.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-sm">
                        No hay vehículos que coincidan.
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 pb-4">
                        {filtradas.map((f) => {
                            const p = f.revision ? PRIORIDAD[f.revision.prioridad] : null;
                            const problemas = f.revision
                                ? items
                                    .map((it) => ({ label: it.label, g: f.revision!.items[it.key]?.gravedad ?? 1 }))
                                    .filter((x) => x.g >= 3)
                                    .sort((a, b) => b.g - a.g)
                                    .slice(0, 4)
                                : [];

                            return (
                                <button
                                    key={f.vehiculo_id}
                                    type="button"
                                    onClick={() => setAbierto(f)}
                                    className={cn(
                                        'flex w-full items-center gap-3 rounded-xl border border-l-4 bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40',
                                        p ? p.border : 'border-l-border',
                                    )}
                                >
                                    <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-sm font-bold uppercase tracking-wide text-foreground">
                                        {f.patente}
                                    </span>

                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium text-foreground">{f.chofer}</span>
                                            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{f.marca} {f.modelo}</span>
                                        </div>
                                        {problemas.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {problemas.map((pr) => (
                                                    <span
                                                        key={pr.label}
                                                        className={cn(
                                                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                                                            pr.g === 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                            : pr.g === 4 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                                        )}
                                                    >
                                                        <span className={cn('h-1.5 w-1.5 rounded-full', GRAVEDAD[pr.g - 1].dot)} />
                                                        {pr.label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {!f.revision && (
                                            <span className="text-xs text-muted-foreground">Sin revisión registrada</span>
                                        )}
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        {f.revision
                                            ? <PrioridadBadge prioridad={f.revision.prioridad} />
                                            : <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Sin revisar</span>
                                        }
                                        {f.revision && (
                                            <span className="text-[11px] tabular-nums text-muted-foreground">{formatDateTime(f.revision.fecha)}</span>
                                        )}
                                    </div>

                                    {f.revision?.observaciones && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="shrink-0 text-muted-foreground">
                                                    <MessageSquareText className="h-4 w-4" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs whitespace-pre-wrap">
                                                {f.revision.observaciones}
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <RevisionModal
                fila={abierto}
                items={items}
                onClose={() => setAbierto(null)}
            />
        </>
    );
}

function RevisionModal({ fila, items, onClose }: { fila: Fila | null; items: ItemDef[]; onClose: () => void }) {
    const [valores, setValores] = useState<Record<string, RevisionItem>>({});
    const [observaciones, setObservaciones] = useState('');
    const [processing, setProcessing] = useState(false);
    const [expandedDesc, setExpandedDesc] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!fila) return;
        const init: Record<string, RevisionItem> = {};
        const initExpanded = new Set<string>();
        for (const it of items) {
            const prev = fila.revision?.items?.[it.key];
            init[it.key] = { gravedad: prev?.gravedad ?? 1, descripcion: prev?.descripcion ?? '' };
            if ((prev?.gravedad ?? 1) > 1 || prev?.descripcion) initExpanded.add(it.key);
        }
        setValores(init);
        setObservaciones(fila.revision?.observaciones ?? '');
        setExpandedDesc(initExpanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fila?.vehiculo_id]);

    const promedio = useMemo(() => {
        if (items.length === 0) return 0;
        const suma = items.reduce((acc, it) => acc + (valores[it.key]?.gravedad ?? 1), 0);
        return suma / items.length;
    }, [valores, items]);

    const prioridad = prioridadDe(valores);

    function setItem(key: string, patch: Partial<RevisionItem>) {
        setValores((v) => {
            const next = { ...v, [key]: { ...v[key], ...patch } };
            if (patch.gravedad !== undefined && patch.gravedad > 1) {
                setExpandedDesc((s) => new Set([...s, key]));
            }
            return next;
        });
    }

    function toggleDesc(key: string) {
        setExpandedDesc((s) => {
            const next = new Set(s);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    function submit() {
        if (!fila) return;
        setProcessing(true);
        router.post(`/revision-mecanica/${fila.vehiculo_id}`, { items: valores, observaciones } as never, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setProcessing(false),
        });
    }

    const problemasCount = items.filter((it) => (valores[it.key]?.gravedad ?? 1) >= 3).length;

    return (
        <Dialog open={!!fila} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                {/* Header */}
                <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
                        <Wrench className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div className="flex-1">
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                            <span className="font-mono uppercase">{fila?.patente}</span>
                            <span className="text-sm font-normal text-muted-foreground">{fila?.marca} {fila?.modelo}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {fila?.chofer} · Revisá cada ítem de 1 (Bien) a 5 (Crítico)
                        </DialogDescription>
                    </div>
                </div>

                {/* Resumen rápido si hay problemas */}
                {problemasCount > 0 && (
                    <div className="flex items-center gap-2 border-b border-border bg-amber-500/5 px-5 py-2">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                            {problemasCount} ítem{problemasCount !== 1 ? 's' : ''} con atención requerida
                        </span>
                        <div className="flex flex-wrap gap-1">
                            {items
                                .filter((it) => (valores[it.key]?.gravedad ?? 1) >= 3)
                                .sort((a, b) => (valores[b.key]?.gravedad ?? 1) - (valores[a.key]?.gravedad ?? 1))
                                .map((it) => {
                                    const g = valores[it.key]?.gravedad ?? 1;
                                    return (
                                        <span
                                            key={it.key}
                                            className={cn(
                                                'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                                g === 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                : g === 4 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                            )}
                                        >
                                            {it.label}
                                        </span>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {/* Ítems */}
                <div className="flex max-h-[55vh] flex-col divide-y divide-border overflow-y-auto">
                    {items.map((it) => {
                        const g = valores[it.key]?.gravedad ?? 1;
                        const showDesc = expandedDesc.has(it.key);
                        const hasDesc = !!(valores[it.key]?.descripcion);
                        return (
                            <div
                                key={it.key}
                                className={cn(
                                    'flex flex-col gap-2 px-5 py-3 transition-colors',
                                    ITEM_ROW_BG[g] ?? '',
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        'text-sm font-medium',
                                        g >= 5 ? 'text-red-700 dark:text-red-400'
                                        : g >= 4 ? 'text-orange-700 dark:text-orange-400'
                                        : g >= 3 ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-foreground',
                                    )}>
                                        {it.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            {GRAVEDAD[g - 1]?.label}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => toggleDesc(it.key)}
                                            className={cn(
                                                'text-muted-foreground/60 transition-colors hover:text-muted-foreground',
                                                hasDesc && 'text-muted-foreground',
                                            )}
                                            title={showDesc ? 'Ocultar nota' : 'Agregar nota'}
                                        >
                                            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showDesc && 'rotate-180')} />
                                        </button>
                                    </div>
                                </div>
                                <GravedadSelector
                                    value={g}
                                    onChange={(v) => setItem(it.key, { gravedad: v })}
                                />
                                {showDesc && (
                                    <Input
                                        type="text"
                                        placeholder="Nota (opcional)..."
                                        className="h-8 text-sm"
                                        value={valores[it.key]?.descripcion ?? ''}
                                        onChange={(e) => setItem(it.key, { descripcion: e.target.value })}
                                        autoFocus
                                    />
                                )}
                            </div>
                        );
                    })}

                    {/* Observaciones generales */}
                    <div className="flex flex-col gap-2 px-5 py-3">
                        <Label className="text-sm font-medium text-muted-foreground">Observaciones generales</Label>
                        <textarea
                            rows={3}
                            placeholder="Observaciones generales (opcional)..."
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            maxLength={2000}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                </div>

                <DialogFooter className="flex-row items-center justify-between border-t border-border px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Promedio</span>
                            <span className="text-lg font-bold tabular-nums text-foreground">{promedio.toFixed(2)}</span>
                        </div>
                        <PrioridadBadge prioridad={prioridad} />
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            <X className="h-4 w-4" /> Cancelar
                        </Button>
                        <Button type="button" onClick={submit} disabled={processing}>
                            {processing ? 'Guardando...' : <><Check className="h-4 w-4" /> Guardar</>}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

RevisionMecanicaIndex.layout = {
    breadcrumbs: [
        {
            title: 'Revisión Mecánica',
            href: '/revision-mecanica',
        },
    ],
};
