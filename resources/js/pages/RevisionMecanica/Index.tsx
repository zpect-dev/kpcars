import { Head, router } from '@inertiajs/react';
import { Check, Download, MessageSquareText, Search, Wrench, X } from 'lucide-react';
import { useMemo, useState } from 'react';
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

const GRAVEDAD: { v: number; label: string; active: string }[] = [
    { v: 1, label: 'Bien',     active: 'border-green-500 bg-green-500 text-white' },
    { v: 2, label: 'Leve',     active: 'border-emerald-500 bg-emerald-500 text-white' },
    { v: 3, label: 'Moderado', active: 'border-amber-500 bg-amber-500 text-white' },
    { v: 4, label: 'Grave',    active: 'border-orange-500 bg-orange-500 text-white' },
    { v: 5, label: 'Crítico',  active: 'border-red-500 bg-red-500 text-white' },
];

const PRIORIDAD: Record<Prioridad, { label: string; badge: string; dot: string }> = {
    alta:  { label: 'Alta',  badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',       dot: 'bg-red-500' },
    media: { label: 'Media', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
    baja:  { label: 'Baja',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',  dot: 'bg-green-500' },
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
                <button
                    key={g.v}
                    type="button"
                    onClick={() => onChange(g.v)}
                    title={g.label}
                    className={cn(
                        'flex h-8 flex-1 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-all active:scale-[0.97]',
                        value === g.v ? g.active : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                >
                    {g.v}
                </button>
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

                {/* Filtros */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex w-full flex-col gap-2 lg:min-w-[240px] lg:flex-1">
                            <Label htmlFor="rm-search">Buscar</Label>
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="rm-search"
                                    type="text"
                                    placeholder="Buscar patente o chofer..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2 lg:w-auto">
                            <Label>Prioridad</Label>
                            <div className="flex h-9 flex-wrap gap-1.5">
                                {([
                                    { val: 'all',       label: 'Todos' },
                                    { val: 'alta',      label: 'Alta' },
                                    { val: 'media',     label: 'Media' },
                                    { val: 'baja',      label: 'Baja' },
                                    { val: 'pendiente', label: 'Pendiente' },
                                ] as const).map(({ val, label }) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setFiltro(val)}
                                        className={cn(
                                            'flex h-full items-center justify-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                                            filtro === val
                                                ? val === 'alta'      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                                                : val === 'media'     ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                : val === 'baja'      ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                                                : val === 'pendiente' ? 'border-border bg-muted text-foreground'
                                                : 'border-primary/30 bg-primary/10 text-primary'
                                                : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {([
                        { key: 'alta',      label: 'Prioridad alta',  value: stats.alta,      cls: 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-400' },
                        { key: 'media',     label: 'Prioridad media', value: stats.media,     cls: 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400' },
                        { key: 'baja',      label: 'Prioridad baja',  value: stats.baja,      cls: 'border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-400' },
                        { key: 'pendiente', label: 'Sin revisar',     value: stats.pendiente, cls: 'border-border bg-card text-muted-foreground' },
                    ] as const).map((s) => (
                        <div key={s.key} className={cn('flex flex-col gap-0.5 overflow-hidden rounded-xl border px-4 py-3 shadow-sm', s.cls)}>
                            <span className="text-xs">{s.label}</span>
                            <span className="text-lg font-bold tabular-nums text-foreground">{s.value}</span>
                        </div>
                    ))}
                </div>

                {/* Grid de vehículos */}
                {filtradas.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-sm">
                        No hay vehículos que coincidan con los filtros.
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 pb-4">
                        {filtradas.map((f) => (
                            <button
                                key={f.vehiculo_id}
                                type="button"
                                onClick={() => setAbierto(f)}
                                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40"
                            >
                                <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-sm font-bold uppercase tracking-wide text-foreground">
                                    {f.patente}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-medium text-foreground">{f.chofer}</span>
                                    <span className="truncate text-xs text-muted-foreground">{f.marca} {f.modelo}{f.inversion ? ` · ${f.inversion}` : ''}</span>
                                </div>
                                {f.revision && (
                                    <div className="hidden shrink-0 flex-col items-end sm:flex">
                                        <span className="text-xs text-muted-foreground">
                                            Prom. <span className="font-semibold tabular-nums text-foreground">{f.revision.promedio.toFixed(2)}</span>
                                        </span>
                                        <span className="text-[11px] text-muted-foreground tabular-nums">{formatDateTime(f.revision.fecha)}</span>
                                    </div>
                                )}
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
                                <div className="shrink-0">
                                    {f.revision
                                        ? <PrioridadBadge prioridad={f.revision.prioridad} />
                                        : <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Sin revisar</span>}
                                </div>
                            </button>
                        ))}
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

    // Reinicia el form cada vez que se abre (o cambia de vehículo), tomando la
    // última revisión como valores iniciales.
    const [lastId, setLastId] = useState<number | null>(null);
    if (!fila) {
        if (lastId !== null) setLastId(null);
    } else if (fila.vehiculo_id !== lastId) {
        const init: Record<string, RevisionItem> = {};
        for (const it of items) {
            const prev = fila.revision?.items?.[it.key];
            init[it.key] = { gravedad: prev?.gravedad ?? 1, descripcion: prev?.descripcion ?? '' };
        }
        setValores(init);
        setObservaciones(fila.revision?.observaciones ?? '');
        setLastId(fila.vehiculo_id);
    }

    const promedio = useMemo(() => {
        if (items.length === 0) return 0;
        const suma = items.reduce((acc, it) => acc + (valores[it.key]?.gravedad ?? 1), 0);
        return suma / items.length;
    }, [valores, items]);

    const prioridad = prioridadDe(valores);

    function setItem(key: string, patch: Partial<RevisionItem>) {
        setValores((v) => ({ ...v, [key]: { ...v[key], ...patch } }));
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

    return (
        <Dialog open={!!fila} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
                        <Wrench className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div className="flex-1">
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                            <span className="font-mono uppercase">{fila?.patente}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {fila?.chofer} · Gravedad 1 (Bien) a 5 (Crítico) por ítem.
                        </DialogDescription>
                    </div>
                </div>

                <div className="flex max-h-[60vh] flex-col divide-y divide-border overflow-y-auto">
                    {items.map((it) => (
                        <div key={it.key} className="flex flex-col gap-2 px-5 py-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">{it.label}</Label>
                                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    {GRAVEDAD[(valores[it.key]?.gravedad ?? 1) - 1]?.label}
                                </span>
                            </div>
                            <GravedadSelector
                                value={valores[it.key]?.gravedad ?? 1}
                                onChange={(v) => setItem(it.key, { gravedad: v })}
                            />
                            <Input
                                type="text"
                                placeholder="Descripción (opcional)..."
                                className="h-8 text-sm"
                                value={valores[it.key]?.descripcion ?? ''}
                                onChange={(e) => setItem(it.key, { descripcion: e.target.value })}
                            />
                        </div>
                    ))}

                    {/* Observaciones generales */}
                    <div className="flex flex-col gap-2 px-5 py-3">
                        <Label className="text-sm font-medium">Observaciones</Label>
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
