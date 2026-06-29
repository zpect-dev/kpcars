import { Head, router, useForm } from '@inertiajs/react';
import { Car, Check, ChevronDown, FileText, Pencil, Plus, Search, Siren, User as UserIcon, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatARS } from '@/components/recaudaciones-tabla';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
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
import { cn } from '@/lib/utils';

interface Multa {
    id: number;
    vehiculo_id: number;
    patente: string;
    marca?: string | null;
    modelo?: string | null;
    conductor_id: number | null;
    conductor?: string | null;
    fecha: string;
    fecha_vencimiento: string | null;
    monto: number;
    descripcion: string;
    punto_rojo: boolean;
    jurisdiccion: 'CABA' | 'GBA' | null;
    pdf_url: string | null;
    pagado: boolean;
    cobrado: boolean;
}

/** Una multa está pendiente mientras no esté pagada al organismo o no esté cobrada al chofer. */
function pendiente(m: Multa): boolean {
    return !m.pagado || !m.cobrado;
}

interface VehiculoOpt {
    id: number;
    patente: string;
    marca: string;
    modelo: string;
}

interface Props {
    multas: Multa[];
    vehiculos: VehiculoOpt[];
}

type Tab = 'vehiculo' | 'chofer';

function formatFecha(d: string): string {
    const [y, m, day] = d.slice(0, 10).split('-');
    return `${day}/${m}/${y}`;
}

const HOY = new Date().toISOString().slice(0, 10);

/**
 * Antes (o el mismo día) del vencimiento la multa tiene un 50% de descuento.
 * Sin fecha de vencimiento no aplica descuento.
 */
function tieneDescuento(m: Multa): boolean {
    return !!m.fecha_vencimiento && HOY <= m.fecha_vencimiento;
}

/** Monto vigente hoy: 50% si todavía no venció, total en caso contrario. */
function montoEfectivo(m: Multa): number {
    return tieneDescuento(m) ? m.monto * 0.5 : m.monto;
}

interface Grupo {
    key: string;
    titulo: string;
    sub: string;
    multas: Multa[];
    pendientes: number;
    total: number;
}

export default function MultasIndex({ multas, vehiculos }: Props) {
    const [tab, setTab] = useState<Tab>('vehiculo');
    const [search, setSearch] = useState('');
    const [soloPendientes, setSoloPendientes] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Multa | null>(null);

    const stats = useMemo(() => ({
        total: multas.length,
        pagadas: multas.filter((m) => m.pagado).length,
        noPagadas: multas.filter((m) => !m.pagado).length,
        cobradas: multas.filter((m) => m.cobrado).length,
        noCobradas: multas.filter((m) => !m.cobrado).length,
    }), [multas]);

    const grupos = useMemo<Grupo[]>(() => {
        const q = search.toLowerCase().trim();
        const visibles = multas.filter((m) => {
            if (!q) return true;
            return m.patente.toLowerCase().includes(q) || (m.conductor ?? '').toLowerCase().includes(q);
        });

        const map = new Map<string, Grupo>();
        for (const m of visibles) {
            let key: string, titulo: string, sub: string;
            if (tab === 'vehiculo') {
                key = String(m.vehiculo_id);
                titulo = m.patente;
                sub = [m.marca, m.modelo].filter(Boolean).join(' ');
            } else {
                key = m.conductor_id ? `c${m.conductor_id}` : 'sin';
                titulo = m.conductor ?? 'Sin chofer';
                sub = '';
            }
            if (!map.has(key)) map.set(key, { key, titulo, sub, multas: [], pendientes: 0, total: 0 });
            map.get(key)!.multas.push(m);
        }

        return Array.from(map.values())
            .map((g) => ({
                ...g,
                pendientes: g.multas.filter(pendiente).length,
                total: g.multas.reduce((s, m) => s + montoEfectivo(m), 0),
            }))
            .filter((g) => !soloPendientes || g.pendientes > 0)
            .sort((a, b) => b.pendientes - a.pendientes || b.total - a.total || a.titulo.localeCompare(b.titulo, 'es', { numeric: true }));
    }, [multas, tab, search, soloPendientes]);

    function toggleExpand(key: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    function togglePagado(id: number) {
        router.patch(`/multas/${id}/pagado`, {}, { preserveScroll: true, preserveState: true });
    }

    function toggleCobrado(id: number) {
        router.patch(`/multas/${id}/cobrado`, {}, { preserveScroll: true, preserveState: true });
    }

    return (
        <>
            <Head title="Multas" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">Multas</h1>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            La multa se imputa al chofer que tenía el vehículo en la fecha de la infracción.
                        </p>
                    </div>
                    <Button size="sm" onClick={() => setShowModal(true)} className="shrink-0">
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">Registrar multa</span>
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <Siren className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Total de multas</span>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-foreground">{stats.total}</span>
                    </div>
                    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                        <span className="text-sm text-muted-foreground">Pagadas al organismo</span>
                        <span className="text-sm font-semibold tabular-nums">
                            <span className="text-green-600 dark:text-green-400">{stats.pagadas}</span>
                            <span className="text-muted-foreground"> / {stats.noPagadas} sin pagar</span>
                        </span>
                    </div>
                    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                        <span className="text-sm text-muted-foreground">Cobradas al chofer</span>
                        <span className="text-sm font-semibold tabular-nums">
                            <span className="text-green-600 dark:text-green-400">{stats.cobradas}</span>
                            <span className="text-muted-foreground"> / {stats.noCobradas} sin cobrar</span>
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1.5">
                    {([
                        { val: 'vehiculo', label: 'Por vehículo', icon: Car },
                        { val: 'chofer',   label: 'Por chofer',   icon: UserIcon },
                    ] as const).map(({ val, label, icon: Icon }) => (
                        <button
                            key={val}
                            type="button"
                            onClick={() => setTab(val)}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.98]',
                                tab === val
                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Buscador + filtro */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex w-full flex-col gap-2 lg:min-w-[240px] lg:flex-1">
                            <Label htmlFor="multa-search">Buscar</Label>
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="multa-search"
                                    type="text"
                                    placeholder="Buscar patente o chofer..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSoloPendientes((v) => !v)}
                            className={cn(
                                'flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all active:scale-[0.97]',
                                soloPendientes
                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            Solo pendientes
                        </button>
                    </div>
                </div>

                {/* Lista agrupada */}
                {grupos.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-sm">
                        {multas.length === 0 ? 'Todavía no hay multas registradas.' : 'No hay multas que coincidan con los filtros.'}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 pb-4">
                        {grupos.map((g) => {
                            const isOpen = expanded.has(g.key);
                            return (
                                <div key={g.key} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(g.key)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                                    >
                                        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')} />
                                        {tab === 'vehiculo' ? (
                                            <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-sm font-bold uppercase tracking-wide text-foreground">
                                                {g.titulo}
                                            </span>
                                        ) : (
                                            <span className="truncate text-sm font-semibold text-foreground">{g.titulo}</span>
                                        )}
                                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{g.sub}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                            {g.multas.length} multa{g.multas.length !== 1 ? 's' : ''}
                                        </span>
                                        {g.pendientes > 0 ? (
                                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                {g.pendientes} pendiente{g.pendientes !== 1 ? 's' : ''}
                                            </span>
                                        ) : (
                                            <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                Al día
                                            </span>
                                        )}
                                        <span className="min-w-[90px] shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                                            {formatARS(g.total)}
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <div className="divide-y divide-border border-t border-border">
                                            {g.multas.map((m) => {
                                                const conDesc = tieneDescuento(m);
                                                return (
                                                <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:flex-nowrap">
                                                    <span className="flex w-20 shrink-0 flex-col text-xs tabular-nums">
                                                        <span className="text-muted-foreground">{formatFecha(m.fecha)}</span>
                                                        {m.fecha_vencimiento && (
                                                            <span className="text-[10px] text-muted-foreground/70" title="Vencimiento">
                                                                vto {formatFecha(m.fecha_vencimiento)}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {m.punto_rojo && (
                                                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" title="Punto rojo" />
                                                    )}
                                                    {m.jurisdiccion && (
                                                        <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                            {m.jurisdiccion}
                                                        </span>
                                                    )}
                                                    {tab === 'vehiculo' ? (
                                                        <span className="shrink-0 text-xs text-muted-foreground">
                                                            {m.conductor ?? <span className="italic text-muted-foreground/60">Sin chofer</span>}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase text-foreground">
                                                            {m.patente}
                                                        </span>
                                                    )}
                                                    <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={m.descripcion}>{m.descripcion}</span>
                                                    <span className="flex shrink-0 flex-col items-end leading-tight">
                                                        {m.punto_rojo ? (
                                                            <span className="text-sm font-medium text-muted-foreground" title="Punto rojo — sin importe">—</span>
                                                        ) : (
                                                            <span className={cn('text-sm font-semibold tabular-nums', m.pagado ? 'text-muted-foreground line-through' : 'text-foreground')}>
                                                                {formatARS(montoEfectivo(m))}
                                                            </span>
                                                        )}
                                                        {conDesc && (
                                                            <span className="text-[10px] font-medium text-green-600 dark:text-green-400" title={`Monto total ${formatARS(m.monto)} — 50% por pago antes del vencimiento`}>
                                                                -50% (${formatARS(m.monto)})
                                                            </span>
                                                        )}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setEditing(m); }}
                                                        title="Editar multa"
                                                        className="inline-flex shrink-0 items-center rounded-md border border-border px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </button>
                                                    <MultaPdf pdfUrl={m.pdf_url} />
                                                    <EstadoToggle activo={m.pagado} onToggle={() => togglePagado(m.id)} labelOn="Pagada" labelOff="No pagada" />
                                                    <EstadoToggle activo={m.cobrado} onToggle={() => toggleCobrado(m.id)} labelOn="Cobrada" labelOff="No cobrada" />
                                                </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <RegistrarMultaModal
                open={showModal}
                onClose={() => setShowModal(false)}
                vehiculos={vehiculos}
            />

            <EditarMultaModal
                multa={editing}
                onClose={() => setEditing(null)}
            />
        </>
    );
}

/** Link para ver el PDF de la multa (el cambio se hace desde el modal de editar). */
function MultaPdf({ pdfUrl }: { pdfUrl: string | null }) {
    if (!pdfUrl) return null;

    return (
        <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Ver PDF de la multa"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
            <FileText className="h-3 w-3" /> PDF
        </a>
    );
}

/** Toggle de un estado booleano (pagada / cobrada) con su opuesto. */
function EstadoToggle({ activo, onToggle, labelOn, labelOff }: { activo: boolean; onToggle: () => void; labelOn: string; labelOff: string }) {
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
                activo
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
            title={activo ? `Marcar como ${labelOff.toLowerCase()}` : `Marcar como ${labelOn.toLowerCase()}`}
        >
            {activo ? <><Check className="h-3 w-3" /> {labelOn}</> : labelOff}
        </button>
    );
}

function RegistrarMultaModal({ open, onClose, vehiculos }: { open: boolean; onClose: () => void; vehiculos: VehiculoOpt[] }) {
    const today = new Date().toISOString().slice(0, 10);
    const form = useForm({
        vehiculo_id: '' as string,
        fecha: today,
        fecha_vencimiento: '' as string,
        monto: '' as string,
        descripcion: '' as string,
        punto_rojo: false,
        jurisdiccion: '' as '' | 'CABA' | 'GBA',
        pdf: null as File | null,
    });

    const opciones: ComboboxOption[] = useMemo(
        () => vehiculos.map((v) => ({ value: String(v.id), label: v.patente, sub: `${v.marca} ${v.modelo}` })),
        [vehiculos],
    );

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/multas', {
            preserveScroll: true,
            onSuccess: () => { form.reset(); form.setData('fecha', today); onClose(); },
        });
    }

    const puntoRojo = form.data.punto_rojo;
    const canSubmit = form.data.vehiculo_id !== '' && form.data.fecha !== ''
        && form.data.descripcion.trim() !== '' && form.data.jurisdiccion !== ''
        && (puntoRojo || (form.data.fecha_vencimiento !== '' && form.data.monto !== ''));

    function setPuntoRojo(checked: boolean) {
        form.setData((prev) => ({
            ...prev,
            punto_rojo: checked,
            // Punto rojo no tiene importe ni vencimiento/descuento.
            monto: checked ? '' : prev.monto,
            fecha_vencimiento: checked ? '' : prev.fecha_vencimiento,
        }));
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) { form.clearErrors(); onClose(); } }}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                        <Siren className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                        <DialogTitle className="text-base font-semibold">Registrar multa</DialogTitle>
                        <DialogDescription className="text-xs">
                            El chofer se determina automáticamente según la fecha.
                        </DialogDescription>
                    </div>
                </div>

                <form onSubmit={submit}>
                    <div className="flex flex-col gap-4 px-5 py-5">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="multa-patente">Patente</Label>
                            <Combobox
                                id="multa-patente"
                                placeholder="Buscar patente..."
                                options={opciones}
                                value={form.data.vehiculo_id}
                                onSelect={(o) => form.setData('vehiculo_id', o.value)}
                                uppercase
                            />
                            {form.errors.vehiculo_id && <p className="text-xs text-red-600">{form.errors.vehiculo_id}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="multa-fecha">Fecha de infracción</Label>
                                <Input
                                    id="multa-fecha"
                                    type="date"
                                    value={form.data.fecha}
                                    max={today}
                                    onChange={(e) => form.setData('fecha', e.target.value)}
                                />
                                {form.errors.fecha && <p className="text-xs text-red-600">{form.errors.fecha}</p>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="multa-vto">Fecha de vencimiento</Label>
                                <Input
                                    id="multa-vto"
                                    type="date"
                                    value={form.data.fecha_vencimiento}
                                    min={form.data.fecha}
                                    disabled={puntoRojo}
                                    onChange={(e) => form.setData('fecha_vencimiento', e.target.value)}
                                    className={cn(puntoRojo && 'cursor-not-allowed opacity-50')}
                                />
                                {form.errors.fecha_vencimiento && <p className="text-xs text-red-600">{form.errors.fecha_vencimiento}</p>}
                            </div>
                        </div>

                        <p className="-mt-2 text-[11px] text-muted-foreground">
                            {puntoRojo
                                ? 'Las multas de punto rojo no tienen importe ni vencimiento.'
                                : 'Pagando antes del vencimiento, la multa tiene un 50% de descuento.'}
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="multa-monto">Monto total</Label>
                                <Input
                                    id="multa-monto"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder={puntoRojo ? 'Sin monto' : '0.00'}
                                    value={form.data.monto}
                                    disabled={puntoRojo}
                                    onChange={(e) => form.setData('monto', e.target.value)}
                                    className={cn(puntoRojo && 'cursor-not-allowed opacity-50')}
                                />
                                {form.errors.monto && <p className="text-xs text-red-600">{form.errors.monto}</p>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Jurisdicción</Label>
                                <div className="flex gap-1.5">
                                    {(['CABA', 'GBA'] as const).map((j) => (
                                        <button
                                            key={j}
                                            type="button"
                                            onClick={() => form.setData('jurisdiccion', j)}
                                            className={cn(
                                                'h-9 flex-1 rounded-lg border text-sm font-medium transition-all active:scale-[0.98]',
                                                form.data.jurisdiccion === j
                                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            {j}
                                        </button>
                                    ))}
                                </div>
                                {form.errors.jurisdiccion && <p className="text-xs text-red-600">{form.errors.jurisdiccion}</p>}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="multa-desc">Descripción</Label>
                            <textarea
                                id="multa-desc"
                                rows={3}
                                placeholder="Motivo de la multa..."
                                value={form.data.descripcion}
                                onChange={(e) => form.setData('descripcion', e.target.value)}
                                maxLength={1000}
                                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                            {form.errors.descripcion && <p className="text-xs text-red-600">{form.errors.descripcion}</p>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>PDF de la multa <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40">
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className={cn('min-w-0 flex-1 truncate', form.data.pdf ? 'text-foreground' : 'text-muted-foreground')}>
                                    {form.data.pdf ? form.data.pdf.name : 'Seleccionar archivo PDF...'}
                                </span>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={(e) => form.setData('pdf', e.target.files?.[0] ?? null)}
                                />
                            </label>
                            {form.errors.pdf && <p className="text-xs text-red-600">{form.errors.pdf}</p>}
                        </div>

                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/40">
                            <input
                                type="checkbox"
                                checked={form.data.punto_rojo}
                                onChange={(e) => setPuntoRojo(e.target.checked)}
                                className="h-4 w-4 rounded border-input accent-red-500"
                            />
                            <span className="flex items-center gap-1.5 text-sm text-foreground">
                                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                Punto rojo
                            </span>
                        </label>
                    </div>

                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            <X className="h-4 w-4" /> Cancelar
                        </Button>
                        <Button type="submit" disabled={!canSubmit || form.processing}>
                            {form.processing ? 'Guardando...' : <><Check className="h-4 w-4" /> Registrar</>}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Modal para editar el monto y la fecha de vencimiento de una multa. */
function EditarMultaModal({ multa, onClose }: { multa: Multa | null; onClose: () => void }) {
    return (
        <Dialog open={!!multa} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                {multa && <EditarMultaForm key={multa.id} multa={multa} onClose={onClose} />}
            </DialogContent>
        </Dialog>
    );
}

function EditarMultaForm({ multa, onClose }: { multa: Multa; onClose: () => void }) {
    const form = useForm({
        monto: String(multa.monto),
        fecha_vencimiento: multa.fecha_vencimiento ?? '',
        pdf: null as File | null,
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        // El PDF se sube por multipart; en rutas PATCH hay que falsear el método.
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post(`/multas/${multa.id}`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => onClose(),
        });
    }

    const camposOk = multa.punto_rojo
        ? form.data.pdf !== null
        : form.data.monto !== '' && form.data.fecha_vencimiento !== '';

    return (
        <>
            <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Pencil className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                    <DialogTitle className="text-base font-semibold">Editar multa</DialogTitle>
                    <DialogDescription className="text-xs">
                        <span className="font-mono font-semibold uppercase">{multa.patente}</span> · infracción del {formatFecha(multa.fecha)}
                    </DialogDescription>
                </div>
            </div>

            <form onSubmit={submit}>
                <div className="flex flex-col gap-4 px-5 py-5">
                    {multa.punto_rojo ? (
                        <p className="text-xs text-muted-foreground">
                            Multa de punto rojo: no tiene monto ni vencimiento. Solo podés cambiar el PDF.
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-monto">Monto total</Label>
                                <Input
                                    id="edit-monto"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={form.data.monto}
                                    onChange={(e) => form.setData('monto', e.target.value)}
                                />
                                {form.errors.monto && <p className="text-xs text-red-600">{form.errors.monto}</p>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-vto">Fecha de vencimiento</Label>
                                <Input
                                    id="edit-vto"
                                    type="date"
                                    value={form.data.fecha_vencimiento}
                                    min={multa.fecha}
                                    onChange={(e) => form.setData('fecha_vencimiento', e.target.value)}
                                />
                                {form.errors.fecha_vencimiento && <p className="text-xs text-red-600">{form.errors.fecha_vencimiento}</p>}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <Label>PDF de la multa</Label>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className={cn('min-w-0 flex-1 truncate', form.data.pdf ? 'text-foreground' : 'text-muted-foreground')}>
                                {form.data.pdf ? form.data.pdf.name : (multa.pdf_url ? 'Reemplazar PDF (opcional)...' : 'Subir PDF (opcional)...')}
                            </span>
                            <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={(e) => form.setData('pdf', e.target.files?.[0] ?? null)}
                            />
                        </label>
                        {multa.pdf_url && !form.data.pdf && (
                            <a href={multa.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                Ver PDF actual
                            </a>
                        )}
                        {form.errors.pdf && <p className="text-xs text-red-600">{form.errors.pdf}</p>}
                    </div>
                </div>

                <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                        <X className="h-4 w-4" /> Cancelar
                    </Button>
                    <Button type="submit" disabled={!camposOk || form.processing}>
                        {form.processing ? 'Guardando...' : <><Check className="h-4 w-4" /> Guardar</>}
                    </Button>
                </DialogFooter>
            </form>
        </>
    );
}

MultasIndex.layout = {
    breadcrumbs: [
        {
            title: 'Multas',
            href: '/multas',
        },
    ],
};
