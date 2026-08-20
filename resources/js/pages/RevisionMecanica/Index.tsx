import { Head, router } from '@inertiajs/react';
import { Check, ChevronDown, Download, MessageSquareText, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/app/empty-state';
import { FilterBar, FilterField, SearchInput } from '@/components/app/filter-bar';
import { FormDialog } from '@/components/app/form-dialog';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import type { StatusTone } from '@/components/app/status-badge';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
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

/**
 * Escala de gravedad de 1 a 5. Es una rampa continua, no cinco categorías
 * sueltas: se arma bajando la intensidad de los tokens semánticos en los
 * escalones intermedios. El número y la etiqueta son lo que informa; el color
 * sólo ayuda a barrer la lista con la vista.
 */
const GRAVEDAD: {
    v: number;
    label: string;
    active: string;
    dot: string;
    tone: StatusTone;
    /** El escalón más alto va en sólido para no confundirse con el anterior. */
    solid: boolean;
}[] = [
    { v: 1, label: 'Bien',     active: 'border-success bg-success text-success-foreground',             dot: 'bg-success',        tone: 'success',     solid: false },
    { v: 2, label: 'Leve',     active: 'border-success/70 bg-success/70 text-success-foreground',       dot: 'bg-success/70',     tone: 'success',     solid: false },
    { v: 3, label: 'Moderado', active: 'border-warning bg-warning text-warning-foreground',             dot: 'bg-warning',        tone: 'warning',     solid: false },
    { v: 4, label: 'Grave',    active: 'border-destructive/70 bg-destructive/70 text-white',            dot: 'bg-destructive/70', tone: 'destructive', solid: false },
    { v: 5, label: 'Crítico',  active: 'border-destructive bg-destructive text-white',                  dot: 'bg-destructive',    tone: 'destructive', solid: true  },
];

const PRIORIDAD: Record<
    Prioridad,
    { label: string; tone: StatusTone; border: string }
> = {
    alta: { label: 'Alta', tone: 'destructive', border: 'border-l-destructive' },
    media: { label: 'Media', tone: 'warning', border: 'border-l-warning' },
    baja: { label: 'Baja', tone: 'success', border: 'border-l-success' },
};

const ITEM_ROW_BG: Record<number, string> = {
    1: '',
    2: '',
    3: 'bg-warning-soft/40',
    4: 'bg-destructive-soft/40',
    5: 'bg-destructive-soft/70',
};

const PESO: Record<Prioridad, number> = { alta: 3, media: 2, baja: 1 };

function prioridadDe(valores: Record<string, RevisionItem>): Prioridad {
    const maximo = Object.values(valores).reduce(
        (max, it) => Math.max(max, it.gravedad ?? 1),
        1,
    );

    return maximo <= 2 ? 'baja' : maximo === 3 ? 'media' : 'alta';
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);

    if (isNaN(d.getTime())) {
        return iso;
    }

    const pad = (n: number) => String(n).padStart(2, '0');

    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PrioridadBadge({ prioridad }: { prioridad: Prioridad }) {
    const p = PRIORIDAD[prioridad];

    return (
        <StatusBadge tone={p.tone} dot>
            {p.label}
        </StatusBadge>
    );
}

/** Etiqueta de un ítem con problema, con la gravedad puesta en el texto. */
function GravedadBadge({ gravedad, children }: { gravedad: number; children: React.ReactNode }) {
    const g = GRAVEDAD[gravedad - 1];

    return (
        <StatusBadge
            tone={g.tone}
            variant={g.solid ? 'solid' : 'soft'}
            size="sm"
        >
            {children}
        </StatusBadge>
    );
}

function GravedadSelector({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div className="flex gap-1" role="group" aria-label="Gravedad del ítem">
            {GRAVEDAD.map((g) => (
                <Tooltip key={g.v}>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => onChange(g.v)}
                            aria-pressed={value === g.v}
                            aria-label={`${g.v} — ${g.label}`}
                            className={cn(
                                'flex h-8 flex-1 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]',
                                value === g.v
                                    ? g.active
                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
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

    const stats = useMemo(
        () => ({
            alta: filas.filter((f) => f.revision?.prioridad === 'alta').length,
            media: filas.filter((f) => f.revision?.prioridad === 'media').length,
            baja: filas.filter((f) => f.revision?.prioridad === 'baja').length,
            pendiente: filas.filter((f) => !f.revision).length,
        }),
        [filas],
    );

    const filtradas = useMemo(() => {
        const q = search.toLowerCase().trim();
        const result = filas.filter((f) => {
            if (filtro === 'pendiente' && f.revision) {
                return false;
            }

            if (
                filtro !== 'all' &&
                filtro !== 'pendiente' &&
                f.revision?.prioridad !== filtro
            ) {
                return false;
            }

            if (q) {
                return (
                    f.patente.toLowerCase().includes(q) ||
                    f.chofer.toLowerCase().includes(q)
                );
            }

            return true;
        });

        return [...result].sort((a, b) => {
            const pa = a.revision ? PESO[a.revision.prioridad] : 0;
            const pb = b.revision ? PESO[b.revision.prioridad] : 0;

            if (pa !== pb) {
                return pb - pa;
            }

            const ma = a.revision?.promedio ?? -1;
            const mb = b.revision?.promedio ?? -1;

            if (ma !== mb) {
                return mb - ma;
            }

            return a.patente.localeCompare(b.patente, 'es', { numeric: true });
        });
    }, [filas, search, filtro]);

    function toggleFiltro(val: Filtro) {
        setFiltro((prev) => (prev === val ? 'all' : val));
    }

    const hayFiltros = search.trim() !== '' || filtro !== 'all';

    function limpiarFiltros() {
        setSearch('');
        setFiltro('all');
    }

    function buildPdfUrl() {
        const p = new URLSearchParams();

        if (search.trim()) {
            p.set('q', search.trim());
        }

        if (filtro !== 'all') {
            p.set('prioridad', filtro);
        }

        const qs = p.toString();

        return `/revision-mecanica/pdf${qs ? `?${qs}` : ''}`;
    }

    const chips = [
        { key: 'alta' as const, label: 'Alta', value: stats.alta, dot: 'bg-destructive' },
        { key: 'media' as const, label: 'Media', value: stats.media, dot: 'bg-warning' },
        { key: 'baja' as const, label: 'Baja', value: stats.baja, dot: 'bg-success' },
        { key: 'pendiente' as const, label: 'Sin revisar', value: stats.pendiente, dot: null },
    ];

    return (
        <>
            <Head title="Revisión Mecánica" />

            <PageContainer>
                <PageHeader
                    title="Revisión Mecánica"
                    count={{
                        value: filtradas.length,
                        singular: 'vehículo',
                        plural: 'vehículos',
                    }}
                    description="Vehículos con chofer asignado. Tocá uno para revisar su estado mecánico y definir la prioridad de reparación."
                    actions={
                        <Button variant="outline" size="sm" asChild>
                            <a
                                href={buildPdfUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Download className="size-4" />
                                <span className="hidden sm:inline">
                                    Exportar PDF
                                </span>
                            </a>
                        </Button>
                    }
                />

                <FilterBar
                    hasActiveFilters={hayFiltros}
                    onClear={limpiarFiltros}
                    gridClassName="lg:grid-cols-[minmax(240px,1fr)_auto_auto]"
                >
                    <FilterField label="Buscar" htmlFor="rm-search">
                        <SearchInput
                            id="rm-search"
                            value={search}
                            onChange={setSearch}
                            placeholder="Patente o chofer..."
                        />
                    </FilterField>

                    <FilterField label="Prioridad">
                        <div className="flex h-9 flex-wrap gap-1.5">
                            {chips.map((s) => {
                                const active = filtro === s.key;

                                return (
                                    <button
                                        key={s.key}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => toggleFiltro(s.key)}
                                        className={cn(
                                            'inline-flex h-full items-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            active
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-border bg-card text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {s.dot && (
                                            <span
                                                aria-hidden="true"
                                                className={cn(
                                                    'size-1.5 rounded-full',
                                                    active
                                                        ? 'bg-primary-foreground/60'
                                                        : s.dot,
                                                )}
                                            />
                                        )}
                                        {s.label}
                                        <span
                                            className={cn(
                                                'tabular-nums',
                                                active
                                                    ? 'opacity-70'
                                                    : 'text-foreground',
                                            )}
                                        >
                                            {s.value}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </FilterField>
                </FilterBar>

                {/* Lista */}
                {filtradas.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card shadow-sm">
                        <EmptyState
                            variant={hayFiltros ? 'filtered' : 'empty'}
                            icon={hayFiltros ? undefined : Wrench}
                            title={
                                hayFiltros
                                    ? 'Ningún vehículo coincide con los filtros'
                                    : 'No hay vehículos con chofer asignado'
                            }
                            description={
                                hayFiltros
                                    ? 'Probá con otra patente o quitá el filtro de prioridad.'
                                    : 'La revisión mecánica sólo lista vehículos que tengan un chofer asignado.'
                            }
                            action={
                                hayFiltros
                                    ? {
                                          label: 'Limpiar filtros',
                                          onClick: limpiarFiltros,
                                      }
                                    : undefined
                            }
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 pb-4">
                        {filtradas.map((f) => {
                            const p = f.revision
                                ? PRIORIDAD[f.revision.prioridad]
                                : null;
                            const problemas = f.revision
                                ? items
                                      .map((it) => ({
                                          label: it.label,
                                          g: f.revision!.items[it.key]?.gravedad ?? 1,
                                      }))
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
                                        'flex w-full items-center gap-3 rounded-xl border border-l-4 bg-card p-3 text-left shadow-sm transition-colors outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring',
                                        p ? p.border : 'border-l-border',
                                    )}
                                >
                                    <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-sm font-bold tracking-wide text-foreground uppercase">
                                        {f.patente}
                                    </span>

                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium text-foreground">
                                                {f.chofer}
                                            </span>
                                            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                                                {f.marca} {f.modelo}
                                            </span>
                                        </div>
                                        {problemas.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {problemas.map((pr) => (
                                                    <GravedadBadge
                                                        key={pr.label}
                                                        gravedad={pr.g}
                                                    >
                                                        {pr.label} ·{' '}
                                                        {GRAVEDAD[pr.g - 1].label}
                                                    </GravedadBadge>
                                                ))}
                                            </div>
                                        )}
                                        {!f.revision && (
                                            <span className="text-xs text-muted-foreground">
                                                Sin revisión registrada
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        {f.revision ? (
                                            <PrioridadBadge
                                                prioridad={f.revision.prioridad}
                                            />
                                        ) : (
                                            <StatusBadge tone="neutral">
                                                Sin revisar
                                            </StatusBadge>
                                        )}
                                        {f.revision && (
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {formatDateTime(
                                                    f.revision.fecha,
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    {f.revision?.observaciones && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span
                                                    className="shrink-0 text-muted-foreground"
                                                    aria-label="Tiene observaciones"
                                                >
                                                    <MessageSquareText className="size-4" />
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
            </PageContainer>

            <RevisionModal
                fila={abierto}
                items={items}
                onClose={() => setAbierto(null)}
            />
        </>
    );
}

function RevisionModal({
    fila,
    items,
    onClose,
}: {
    fila: Fila | null;
    items: ItemDef[];
    onClose: () => void;
}) {
    const [valores, setValores] = useState<Record<string, RevisionItem>>({});
    const [observaciones, setObservaciones] = useState('');
    const [processing, setProcessing] = useState(false);
    const [expandedDesc, setExpandedDesc] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!fila) {
            return;
        }

        const init: Record<string, RevisionItem> = {};
        const initExpanded = new Set<string>();

        for (const it of items) {
            const prev = fila.revision?.items?.[it.key];
            init[it.key] = {
                gravedad: prev?.gravedad ?? 1,
                descripcion: prev?.descripcion ?? '',
            };

            if ((prev?.gravedad ?? 1) > 1 || prev?.descripcion) {
                initExpanded.add(it.key);
            }
        }

        setValores(init);
        setObservaciones(fila.revision?.observaciones ?? '');
        setExpandedDesc(initExpanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fila?.vehiculo_id]);

    const promedio = useMemo(() => {
        if (items.length === 0) {
            return 0;
        }

        const suma = items.reduce(
            (acc, it) => acc + (valores[it.key]?.gravedad ?? 1),
            0,
        );

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

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    }

    function submit() {
        if (!fila) {
            return;
        }

        setProcessing(true);
        router.post(
            `/revision-mecanica/${fila.vehiculo_id}`,
            { items: valores, observaciones } as never,
            {
                preserveScroll: true,
                onSuccess: () => onClose(),
                onFinish: () => setProcessing(false),
            },
        );
    }

    const problemasCount = items.filter(
        (it) => (valores[it.key]?.gravedad ?? 1) >= 3,
    ).length;

    return (
        <FormDialog
            open={!!fila}
            onOpenChange={(open) => !open && onClose()}
            size="lg"
            icon={Wrench}
            title={
                <span className="flex items-center gap-2">
                    <span className="font-mono uppercase">{fila?.patente}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                        {fila?.marca} {fila?.modelo}
                    </span>
                </span>
            }
            description={`${fila?.chofer ?? ''} · Revisá cada ítem de 1 (Bien) a 5 (Crítico)`}
            footer={
                <DialogFooter className="flex-row items-center justify-between border-t border-border px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-xs tracking-wider text-muted-foreground uppercase">
                                Promedio
                            </span>
                            <span className="text-lg font-bold text-foreground tabular-nums">
                                {promedio.toFixed(2)}
                            </span>
                        </div>
                        <PrioridadBadge prioridad={prioridad} />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={processing}
                        >
                            <X className="size-4" /> Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={submit}
                            disabled={processing}
                        >
                            {processing ? (
                                'Guardando...'
                            ) : (
                                <>
                                    <Check className="size-4" /> Guardar
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            }
        >
            {/* Resumen rápido si hay problemas */}
            {problemasCount > 0 && (
                <div className="-mx-5 -mt-5 flex flex-wrap items-center gap-2 border-b border-border bg-warning-soft/40 px-5 py-2">
                    <span className="text-xs font-medium text-warning-soft-foreground">
                        {problemasCount} ítem{problemasCount !== 1 ? 's' : ''} con
                        atención requerida
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {items
                            .filter((it) => (valores[it.key]?.gravedad ?? 1) >= 3)
                            .sort(
                                (a, b) =>
                                    (valores[b.key]?.gravedad ?? 1) -
                                    (valores[a.key]?.gravedad ?? 1),
                            )
                            .map((it) => (
                                <GravedadBadge
                                    key={it.key}
                                    gravedad={valores[it.key]?.gravedad ?? 1}
                                >
                                    {it.label}
                                </GravedadBadge>
                            ))}
                    </div>
                </div>
            )}

            {/* Ítems */}
            <div className="-mx-5 flex flex-col divide-y divide-border">
                {items.map((it) => {
                    const g = valores[it.key]?.gravedad ?? 1;
                    const showDesc = expandedDesc.has(it.key);
                    const hasDesc = !!valores[it.key]?.descripcion;

                    return (
                        <div
                            key={it.key}
                            className={cn(
                                'flex flex-col gap-2 px-5 py-3 transition-colors',
                                ITEM_ROW_BG[g] ?? '',
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span
                                    className={cn(
                                        'text-sm font-medium',
                                        g >= 4
                                            ? 'text-destructive'
                                            : g === 3
                                              ? 'text-warning-soft-foreground'
                                              : 'text-foreground',
                                    )}
                                >
                                    {it.label}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                        {GRAVEDAD[g - 1]?.label}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => toggleDesc(it.key)}
                                        aria-expanded={showDesc}
                                        aria-label={
                                            showDesc
                                                ? `Ocultar la nota de ${it.label}`
                                                : `Agregar una nota a ${it.label}`
                                        }
                                        className={cn(
                                            'rounded text-muted-foreground/60 transition-colors outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
                                            hasDesc && 'text-muted-foreground',
                                        )}
                                    >
                                        <ChevronDown
                                            className={cn(
                                                'size-3.5 transition-transform',
                                                showDesc && 'rotate-180',
                                            )}
                                        />
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
                                    onChange={(e) =>
                                        setItem(it.key, {
                                            descripcion: e.target.value,
                                        })
                                    }
                                    autoFocus
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Observaciones generales */}
            <div className="flex flex-col gap-2">
                <Label
                    htmlFor="observaciones"
                    className="text-sm font-medium text-muted-foreground"
                >
                    Observaciones generales
                </Label>
                <textarea
                    id="observaciones"
                    rows={3}
                    placeholder="Observaciones generales (opcional)..."
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    maxLength={2000}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                />
            </div>
        </FormDialog>
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
