import { Head, router, useForm } from '@inertiajs/react';
import { Car, Check, ChevronDown, Plus, Search, Siren, User as UserIcon, X } from 'lucide-react';
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
    monto: number;
    descripcion: string;
    pagada: boolean;
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

interface Grupo {
    key: string;
    titulo: string;
    sub: string;
    multas: Multa[];
    deuda: number;
    total: number;
}

export default function MultasIndex({ multas, vehiculos }: Props) {
    const [tab, setTab] = useState<Tab>('vehiculo');
    const [search, setSearch] = useState('');
    const [soloDeuda, setSoloDeuda] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [showModal, setShowModal] = useState(false);

    const stats = useMemo(() => ({
        deuda: multas.filter((m) => !m.pagada).reduce((s, m) => s + m.monto, 0),
        impagas: multas.filter((m) => !m.pagada).length,
        pagadas: multas.filter((m) => m.pagada).length,
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
            if (!map.has(key)) map.set(key, { key, titulo, sub, multas: [], deuda: 0, total: 0 });
            map.get(key)!.multas.push(m);
        }

        return Array.from(map.values())
            .map((g) => ({
                ...g,
                deuda: g.multas.filter((m) => !m.pagada).reduce((s, m) => s + m.monto, 0),
                total: g.multas.reduce((s, m) => s + m.monto, 0),
            }))
            .filter((g) => !soloDeuda || g.deuda > 0)
            .sort((a, b) => b.deuda - a.deuda || b.total - a.total || a.titulo.localeCompare(b.titulo, 'es', { numeric: true }));
    }, [multas, tab, search, soloDeuda]);

    function toggleExpand(key: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    function togglePago(id: number) {
        router.patch(`/multas/${id}/pago`, {}, { preserveScroll: true, preserveState: true });
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
                    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <Siren className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-700 dark:text-red-400">Deuda total</span>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-foreground">{formatARS(stats.deuda)}</span>
                    </div>
                    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                        <span className="text-sm text-muted-foreground">Multas impagas</span>
                        <span className="text-lg font-bold tabular-nums text-foreground">{stats.impagas}</span>
                    </div>
                    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                        <span className="text-sm text-muted-foreground">Multas pagadas</span>
                        <span className="text-lg font-bold tabular-nums text-foreground">{stats.pagadas}</span>
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
                            onClick={() => setSoloDeuda((v) => !v)}
                            className={cn(
                                'flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all active:scale-[0.97]',
                                soloDeuda
                                    ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            Solo con deuda
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
                                        <span className={cn(
                                            'min-w-[90px] shrink-0 text-right text-sm font-bold tabular-nums',
                                            g.deuda > 0 ? 'text-foreground' : 'text-muted-foreground',
                                        )}>
                                            {g.deuda > 0 ? formatARS(g.deuda) : 'Saldada'}
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <div className="divide-y divide-border border-t border-border">
                                            {g.multas.map((m) => (
                                                <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:flex-nowrap">
                                                    <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">{formatFecha(m.fecha)}</span>
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
                                                    <span className={cn('shrink-0 text-sm font-semibold tabular-nums', m.pagada ? 'text-muted-foreground line-through' : 'text-foreground')}>
                                                        {formatARS(m.monto)}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => togglePago(m.id)}
                                                        className={cn(
                                                            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
                                                            m.pagada
                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                                                                : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400',
                                                        )}
                                                        title={m.pagada ? 'Marcar como impaga' : 'Marcar como pagada'}
                                                    >
                                                        {m.pagada ? <><Check className="h-3 w-3" /> Pagada</> : 'Impaga'}
                                                    </button>
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

            <RegistrarMultaModal
                open={showModal}
                onClose={() => setShowModal(false)}
                vehiculos={vehiculos}
            />
        </>
    );
}

function RegistrarMultaModal({ open, onClose, vehiculos }: { open: boolean; onClose: () => void; vehiculos: VehiculoOpt[] }) {
    const today = new Date().toISOString().slice(0, 10);
    const form = useForm({
        vehiculo_id: '' as string,
        fecha: today,
        monto: '' as string,
        descripcion: '' as string,
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

    const canSubmit = form.data.vehiculo_id !== '' && form.data.fecha !== '' && form.data.monto !== '' && form.data.descripcion.trim() !== '';

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
                                <Label htmlFor="multa-monto">Monto</Label>
                                <Input
                                    id="multa-monto"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={form.data.monto}
                                    onChange={(e) => form.setData('monto', e.target.value)}
                                />
                                {form.errors.monto && <p className="text-xs text-red-600">{form.errors.monto}</p>}
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

MultasIndex.layout = {
    breadcrumbs: [
        {
            title: 'Multas',
            href: '/multas',
        },
    ],
};
