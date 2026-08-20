import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    ChevronDown,
    ClipboardList,
    History,
    Loader2,
    Search,
    TrendingDown,
    TrendingUp,
    Warehouse,
    Wrench,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/app/empty-state';
import { SearchInput } from '@/components/app/filter-bar';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { movimientos as movimientosRoute, preview as previewRoute, store as storeRoute } from '@/routes/conteos';
import type { Articulo, ConteoHistorial, ConteoMovimiento, ConteoPreviewLinea } from '@/types';

type Zona = 'repuestos' | 'galpon';

type PreviewProp = { zona: Zona; lineas: ConteoPreviewLinea[] } | null;

interface Props {
    items: Pick<Articulo, 'id' | 'codigo' | 'descripcion' | 'repuestos' | 'min_stock'>[];
    motivos: Record<string, string>;
    historial: ConteoHistorial[];
    preview?: PreviewProp;
}

function formatFecha(iso: string): string {
    return new Date(iso).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ConteoIndex({ items, motivos, historial, preview }: Props) {
    const [zona, setZona] = useState<Zona>('repuestos');
    const [search, setSearch] = useState('');
    // Conteo físico por artículo (a ciegas: sin ver el esperado).
    const [fisico, setFisico] = useState<Record<number, string>>({});
    const [view, setView] = useState<'entrada' | 'revision'>('entrada');
    // Motivo + nota por línea con diferencia.
    const [ajustes, setAjustes] = useState<Record<number, { motivo: string; nota: string }>>({});
    const [observaciones, setObservaciones] = useState('');
    // Movimientos cargados para investigar (o 'loading').
    const [movs, setMovs] = useState<Record<number, ConteoMovimiento[] | 'loading'>>({});
    const [processing, setProcessing] = useState(false);
    const [showHistorial, setShowHistorial] = useState(false);

    const zonaItems = useMemo(
        () => items.filter((i) => (zona === 'repuestos' ? i.repuestos : !i.repuestos)),
        [items, zona],
    );

    const filteredItems = useMemo(() => {
        const q = search.toLowerCase().trim();

        if (!q) {
return zonaItems;
}

        return zonaItems.filter(
            (i) =>
                i.descripcion.toLowerCase().includes(q) ||
                (i.codigo ?? '').toLowerCase().includes(q),
        );
    }, [zonaItems, search]);

    const zonaItemIds = useMemo(() => new Set(zonaItems.map((i) => i.id)), [zonaItems]);

    // Líneas cargadas de la zona activa (físico no vacío).
    const enteredLines = useMemo(
        () =>
            Object.entries(fisico)
                .filter(([id, val]) => val !== '' && zonaItemIds.has(Number(id)))
                .map(([id, val]) => ({ articulo_id: Number(id), fisico: Number(val) })),
        [fisico, zonaItemIds],
    );

    function switchZona(z: Zona) {
        if (z === zona) {
return;
}

        setZona(z);
        setSearch('');
    }

    function setCount(id: number, value: string) {
        setFisico((prev) => ({ ...prev, [id]: value }));
    }

    function handlePreview() {
        if (enteredLines.length === 0) {
return;
}

        setProcessing(true);
        router.post(
            previewRoute.url(),
            { zona, lineas: enteredLines },
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setView('revision');
                    setMovs({});
                    window.scrollTo({ top: 0 });
                },
                onFinish: () => setProcessing(false),
            },
        );
    }

    const previewLineas = preview?.lineas ?? [];
    const diffLines = previewLineas.filter((l) => l.diferencia !== 0);
    const okCount = previewLineas.length - diffLines.length;

    const confirmValid = diffLines.every((l) => {
        const a = ajustes[l.articulo_id];

        return a && a.motivo !== '' && a.nota.trim() !== '';
    });

    function setAjuste(id: number, patch: Partial<{ motivo: string; nota: string }>) {
        setAjustes((prev) => ({
            ...prev,
            [id]: { motivo: prev[id]?.motivo ?? '', nota: prev[id]?.nota ?? '', ...patch },
        }));
    }

    function handleConfirm() {
        if (!confirmValid) {
return;
}

        setProcessing(true);
        const lineas = previewLineas.map((l) => ({
            articulo_id: l.articulo_id,
            fisico: l.fisico,
            motivo: l.diferencia !== 0 ? ajustes[l.articulo_id]?.motivo : undefined,
            nota: l.diferencia !== 0 ? ajustes[l.articulo_id]?.nota : undefined,
        }));
        router.post(
            storeRoute.url(),
            { zona, observaciones, lineas },
            {
                onFinish: () => setProcessing(false),
            },
        );
    }

    async function investigar(articuloId: number) {
        if (movs[articuloId]) {
            setMovs((prev) => {
                const next = { ...prev };
                delete next[articuloId];

                return next;
            });

            return;
        }

        setMovs((prev) => ({ ...prev, [articuloId]: 'loading' }));

        try {
            const res = await fetch(movimientosRoute.url(articuloId), {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const data = await res.json();
            setMovs((prev) => ({ ...prev, [articuloId]: data.movimientos ?? [] }));
        } catch {
            setMovs((prev) => ({ ...prev, [articuloId]: [] }));
        }
    }

    return (
        <>
            <Head title="Conteo de inventario" />

            <PageContainer>
                <PageHeader
                    title="Conteo de inventario"
                    meta={
                        <ClipboardList
                            aria-hidden="true"
                            className="size-5 text-primary"
                        />
                    }
                    description={
                        view === 'entrada'
                            ? 'Contá a ciegas: cargá lo que hay físicamente. El sistema calcula las diferencias al terminar.'
                            : 'Revisá las diferencias, investigá los movimientos y clasificá cada ajuste antes de confirmar.'
                    }
                />

                {view === 'entrada' ? (
                    <EntradaView
                        zona={zona}
                        switchZona={switchZona}
                        search={search}
                        setSearch={setSearch}
                        filteredItems={filteredItems}
                        counts={{
                            repuestos: items.filter((i) => i.repuestos).length,
                            galpon: items.filter((i) => !i.repuestos).length,
                        }}
                        fisico={fisico}
                        setCount={setCount}
                        enteredCount={enteredLines.length}
                        processing={processing}
                        onPreview={handlePreview}
                        historial={historial}
                        showHistorial={showHistorial}
                        setShowHistorial={setShowHistorial}
                    />
                ) : (
                    <RevisionView
                        previewLineas={previewLineas}
                        diffLines={diffLines}
                        okCount={okCount}
                        motivos={motivos}
                        ajustes={ajustes}
                        setAjuste={setAjuste}
                        movs={movs}
                        investigar={investigar}
                        observaciones={observaciones}
                        setObservaciones={setObservaciones}
                        confirmValid={confirmValid}
                        processing={processing}
                        onBack={() => setView('entrada')}
                        onConfirm={handleConfirm}
                    />
                )}
            </PageContainer>
        </>
    );
}

// ─── Entrada (conteo a ciegas) ───────────────────────────────────────────────

interface EntradaProps {
    zona: Zona;
    switchZona: (z: Zona) => void;
    search: string;
    setSearch: (v: string) => void;
    filteredItems: Props['items'];
    counts: { repuestos: number; galpon: number };
    fisico: Record<number, string>;
    setCount: (id: number, v: string) => void;
    enteredCount: number;
    processing: boolean;
    onPreview: () => void;
    historial: ConteoHistorial[];
    showHistorial: boolean;
    setShowHistorial: (v: boolean) => void;
}

function EntradaView({
    zona,
    switchZona,
    search,
    setSearch,
    filteredItems,
    counts,
    fisico,
    setCount,
    enteredCount,
    processing,
    onPreview,
    historial,
    showHistorial,
    setShowHistorial,
}: EntradaProps) {
    return (
        <>
            {/* Zona */}
            <div className="flex w-full gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:w-auto sm:self-start">
                {(['repuestos', 'galpon'] as const).map((z) => (
                    <button
                        key={z}
                        type="button"
                        onClick={() => switchZona(z)}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-none',
                            zona === z ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {z === 'repuestos' ? <Wrench className="h-4 w-4" /> : <Warehouse className="h-4 w-4" />}
                        {z === 'repuestos' ? 'Repuestos' : 'Galpón'}
                        <span className="ml-1 rounded-md bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                            {counts[z]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Buscador */}
            <SearchInput
                className="w-full sm:max-w-sm"
                value={search}
                onChange={setSearch}
                placeholder="Buscar por código o descripción..."
            />

            {/* Lista de artículos con input de físico */}
            <div className="flex flex-col gap-2 pb-2">
                {filteredItems.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card shadow-sm">
                        <EmptyState
                            variant={search.trim() ? 'filtered' : 'empty'}
                            icon={Warehouse}
                            title={
                                search.trim()
                                    ? 'Ningún artículo coincide'
                                    : 'No hay artículos en esta zona'
                            }
                            description={
                                search.trim()
                                    ? 'Probá con otro código o descripción.'
                                    : 'Cargá artículos en el inventario para poder contarlos.'
                            }
                            action={
                                search.trim()
                                    ? {
                                          label: 'Limpiar búsqueda',
                                          onClick: () => setSearch(''),
                                      }
                                    : undefined
                            }
                        />
                    </div>
                ) : (
                    filteredItems.map((item) => {
                        const counted = (fisico[item.id] ?? '') !== '';

                        return (
                            <div
                                key={item.id}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors',
                                    counted ? 'border-l-4 border-l-emerald-500' : 'border-border',
                                )}
                            >
                                {item.codigo && (
                                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-foreground">
                                        {item.codigo}
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">{item.descripcion}</p>
                                </div>
                                <Input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    placeholder="—"
                                    value={fisico[item.id] ?? ''}
                                    onChange={(e) => setCount(item.id, e.target.value)}
                                    className="h-9 w-20 bg-card text-center text-base font-semibold tabular-nums shadow-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                            </div>
                        );
                    })
                )}
            </div>

            {/* Historial reciente */}
            {historial.length > 0 && (
                <div className="rounded-xl border border-border bg-card shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowHistorial(!showHistorial)}
                        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
                    >
                        <span className="flex items-center gap-2">
                            <History className="h-4 w-4 text-muted-foreground" />
                            Conteos recientes
                        </span>
                        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showHistorial && 'rotate-180')} />
                    </button>
                    {showHistorial && (
                        <div className="divide-y divide-border border-t border-border">
                            {historial.map((c) => (
                                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{c.zona}</span>
                                    <span className="text-muted-foreground">{formatFecha(c.created_at)}</span>
                                    <span className="text-foreground">{c.user?.name ?? '—'}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {c.lineas_count} contados ·{' '}
                                        <span className={cn(c.ajustes_count > 0 ? 'font-semibold text-warning-soft-foreground' : '')}>
                                            {c.ajustes_count} ajustes
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Footer pegajoso: continuar al preview */}
            <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {enteredCount === 0 ? 'Cargá al menos un artículo' : `${enteredCount} contado(s)`}
                    </span>
                    <Button className="shrink-0" disabled={enteredCount === 0 || processing} onClick={onPreview}>
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ver diferencias'}
                    </Button>
                </div>
            </div>
        </>
    );
}

// ─── Revisión (diferencias + investigación + ajuste) ─────────────────────────

interface RevisionProps {
    previewLineas: ConteoPreviewLinea[];
    diffLines: ConteoPreviewLinea[];
    okCount: number;
    motivos: Record<string, string>;
    ajustes: Record<number, { motivo: string; nota: string }>;
    setAjuste: (id: number, patch: Partial<{ motivo: string; nota: string }>) => void;
    movs: Record<number, ConteoMovimiento[] | 'loading'>;
    investigar: (id: number) => void;
    observaciones: string;
    setObservaciones: (v: string) => void;
    confirmValid: boolean;
    processing: boolean;
    onBack: () => void;
    onConfirm: () => void;
}

function RevisionView({
    previewLineas,
    diffLines,
    okCount,
    motivos,
    ajustes,
    setAjuste,
    movs,
    investigar,
    observaciones,
    setObservaciones,
    confirmValid,
    processing,
    onBack,
    onConfirm,
}: RevisionProps) {
    return (
        <>
            {/* Resumen */}
            <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm shadow-sm">
                    <Check aria-hidden="true" className="size-4 text-success" />
                    <span className="font-semibold text-foreground tabular-nums">{okCount}</span>
                    <span className="text-muted-foreground">sin diferencia</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm shadow-sm">
                    <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
                    <span className="font-semibold text-foreground tabular-nums">{diffLines.length}</span>
                    <span className="text-muted-foreground">con diferencia</span>
                </div>
            </div>

            <div className="flex flex-col gap-2 pb-2">
                {previewLineas.map((l) => {
                    const isDiff = l.diferencia !== 0;
                    const faltante = l.diferencia < 0;
                    const lineMovs = movs[l.articulo_id];

                    return (
                        <div
                            key={l.articulo_id}
                            className={cn(
                                'rounded-xl border bg-card shadow-sm',
                                isDiff ? (faltante ? 'border-destructive/50' : 'border-warning/50') : 'border-border',
                            )}
                        >
                            <div className="flex items-center gap-3 p-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">{l.descripcion}</p>
                                    <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground tabular-nums">
                                        <span>Esperado: <span className="font-medium text-foreground">{l.esperado}</span></span>
                                        <span>Físico: <span className="font-medium text-foreground">{l.fisico}</span></span>
                                    </div>
                                </div>
                                {isDiff ? (
                                    <span
                                        className={cn(
                                            'flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold tabular-nums',
                                            faltante
                                                ? 'bg-destructive-soft text-destructive-soft-foreground'
                                                : 'bg-warning-soft text-warning-soft-foreground',
                                        )}
                                    >
                                        {faltante ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                                        {l.diferencia > 0 ? `+${l.diferencia}` : l.diferencia}
                                    </span>
                                ) : (
                                    <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
                                )}
                            </div>

                            {isDiff && (
                                <div className="flex flex-col gap-3 border-t border-border px-3 pt-3 pb-3">
                                    {/* Investigar */}
                                    <button
                                        type="button"
                                        onClick={() => investigar(l.articulo_id)}
                                        className="flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
                                    >
                                        <Search className="h-3.5 w-3.5" />
                                        {lineMovs ? 'Ocultar movimientos' : 'Investigar movimientos'}
                                    </button>

                                    {lineMovs === 'loading' ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
                                        </div>
                                    ) : lineMovs && lineMovs.length > 0 ? (
                                        <div className="overflow-hidden rounded-lg border border-border">
                                            {lineMovs.map((m) => (
                                                <div
                                                    key={m.id}
                                                    className={cn(
                                                        'flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5 text-xs',
                                                        m.inactiva && 'opacity-50 line-through',
                                                    )}
                                                >
                                                    <MovTipoBadge tipo={m.tipo} cantidad={m.cantidad} />
                                                    <span className="text-muted-foreground">{formatFecha(m.created_at)}</span>
                                                    {m.vehiculo?.patente && (
                                                        <span className="rounded bg-muted px-1.5 font-mono text-foreground">{m.vehiculo.patente}</span>
                                                    )}
                                                    {m.solicitante && <span className="text-muted-foreground">· {m.solicitante}</span>}
                                                    <span className="ml-auto text-muted-foreground">{m.user?.name ?? ''}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : lineMovs ? (
                                        <p className="text-xs text-muted-foreground">Sin movimientos registrados.</p>
                                    ) : null}

                                    {/* Motivo + nota */}
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <div className="flex flex-col gap-1 sm:w-52">
                                            <Label className="text-xs text-muted-foreground">Motivo</Label>
                                            <select
                                                value={ajustes[l.articulo_id]?.motivo ?? ''}
                                                onChange={(e) => setAjuste(l.articulo_id, { motivo: e.target.value })}
                                                className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground shadow-xs outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                <option value="" disabled>
                                                    Elegí un motivo…
                                                </option>
                                                {Object.entries(motivos).map(([value, label]) => (
                                                    <option key={value} value={value}>
                                                        {label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-1 flex-col gap-1">
                                            <Label className="text-xs text-muted-foreground">Nota (obligatoria)</Label>
                                            <Input
                                                type="text"
                                                value={ajustes[l.articulo_id]?.nota ?? ''}
                                                onChange={(e) => setAjuste(l.articulo_id, { nota: e.target.value })}
                                                placeholder="Qué encontraste al investigar…"
                                                className="h-9"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer pegajoso: volver / confirmar (apila en móvil) */}
            <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                <div className="flex flex-col gap-2">
                    <Input
                        type="text"
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Observaciones del conteo (opcional)"
                        className="h-9 w-full"
                    />
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={onBack} disabled={processing}>
                            <ArrowLeft className="h-4 w-4" /> Volver
                        </Button>
                        <Button className="ml-auto" disabled={!confirmValid || processing} onClick={onConfirm}>
                            {processing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Check className="h-4 w-4" /> Confirmar
                                </>
                            )}
                        </Button>
                    </div>
                    {!confirmValid && diffLines.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <X className="h-3.5 w-3.5 shrink-0" /> Completá motivo y nota de cada diferencia
                        </span>
                    )}
                </div>
            </div>
        </>
    );
}

function MovTipoBadge({ tipo, cantidad }: { tipo: ConteoMovimiento['tipo']; cantidad: number }) {
    const map = {
        IN: {
            label: `+${cantidad}`,
            cls: 'bg-success-soft text-success-soft-foreground',
        },
        OUT: {
            label: `-${cantidad}`,
            cls: 'bg-destructive-soft text-destructive-soft-foreground',
        },
        AJUSTE: {
            label: cantidad > 0 ? `+${cantidad}` : `${cantidad}`,
            cls: 'bg-info-soft text-info-soft-foreground',
        },
    } as const;
    const cfg = map[tipo];

    return (
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums', cfg.cls)}>
            {tipo === 'AJUSTE' ? 'AJ ' : tipo === 'IN' ? 'IN ' : 'OUT '}
            {cfg.label}
        </span>
    );
}
