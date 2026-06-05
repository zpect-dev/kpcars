import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Gauge,
    HelpCircle,
    History,
    Search,
    Trash2,
    Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
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
import { cn } from '@/lib/utils';

type Estado = 'vencido' | 'al_dia' | 'sin_service' | 'sin_km';

interface ServiceHistorial {
    id: number;
    kilometraje: number;
    fecha: string;
    realizado_por: string | null;
}

interface ServiceRow {
    id: number;
    patente: string;
    marca: string;
    modelo: string;
    anio: string;
    empresa: string | null;
    inversion: string | null;
    conductor: string | null;
    km_actual: number | null;
    ultimo_service: {
        kilometraje: number;
        fecha: string;
        realizado_por: string | null;
    } | null;
    km_recorridos: number | null;
    km_restantes: number | null;
    estado: Estado;
    historial: ServiceHistorial[];
}

interface Props {
    vehiculos: ServiceRow[];
    intervaloKm: number;
}

const ESTADO_CONFIG: Record<
    Estado,
    { label: string; badge: string; border: string; icon: typeof CheckCircle2 }
> = {
    vencido: {
        label: 'Service vencido',
        badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        border: 'border-red-500/50 hover:border-red-500/80 dark:border-red-900/50',
        icon: AlertTriangle,
    },
    al_dia: {
        label: 'Al día',
        badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        border: 'border-green-500/50 hover:border-green-500/80 dark:border-green-900/50',
        icon: CheckCircle2,
    },
    sin_service: {
        label: 'Sin service',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        border: 'border-amber-500/50 hover:border-amber-500/80 dark:border-amber-900/50',
        icon: Wrench,
    },
    sin_km: {
        label: 'Sin datos',
        badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        border: 'border-border',
        icon: HelpCircle,
    },
};

function fmtKm(n: number | null | undefined): string {
    if (n == null) return '—';
    return `${n.toLocaleString('es-AR')} km`;
}

function fmtDate(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
}

const FILTROS: { val: Estado | 'all'; label: string }[] = [
    { val: 'all', label: 'Todos' },
    { val: 'vencido', label: 'Vencidos' },
    { val: 'al_dia', label: 'Al día' },
    { val: 'sin_service', label: 'Sin service' },
    { val: 'sin_km', label: 'Sin datos' },
];

export default function ServiceIndex({ vehiculos, intervaloKm }: Props) {
    const { auth } = usePage<any>().props;
    const canManage = auth.permissions?.can_manage_service ?? false;

    const [search, setSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState<Estado | 'all'>('all');
    const [selected, setSelected] = useState<ServiceRow | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [kmRow, setKmRow] = useState<ServiceRow | null>(null);
    const [kmDialogOpen, setKmDialogOpen] = useState(false);

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const form = useForm({
        kilometraje: '',
        fecha: today,
    });

    const kmForm = useForm({
        kilometraje: '',
        fecha: today,
    });

    function openKmDialog(row: ServiceRow) {
        setKmRow(row);
        kmForm.reset();
        kmForm.clearErrors();
        kmForm.setData({
            kilometraje: row.km_actual != null ? String(row.km_actual) : '',
            fecha: today,
        });
        setKmDialogOpen(true);
    }

    function handleKmSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!kmRow) return;
        kmForm.post(`/services/${kmRow.id}/kilometraje`, {
            preserveScroll: true,
            onSuccess: () => setKmDialogOpen(false),
        });
    }

    function openDialog(row: ServiceRow) {
        setSelected(row);
        form.reset();
        form.clearErrors();
        form.setData({
            kilometraje: row.km_actual != null ? String(row.km_actual) : '',
            fecha: today,
        });
        setDialogOpen(true);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selected) return;
        form.post(`/services/${selected.id}`, {
            preserveScroll: true,
            onSuccess: () => setDialogOpen(false),
        });
    }

    function deleteService(id: number) {
        if (!confirm('¿Eliminar este registro de service?')) return;
        router.delete(`/services/${id}`, { preserveScroll: true });
    }

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return vehiculos.filter((v) => {
            const matchSearch =
                !q ||
                v.patente.toLowerCase().includes(q) ||
                v.marca.toLowerCase().includes(q) ||
                v.modelo.toLowerCase().includes(q) ||
                (v.conductor?.toLowerCase().includes(q) ?? false);
            const matchEstado =
                filterEstado === 'all' || v.estado === filterEstado;
            return matchSearch && matchEstado;
        });
    }, [vehiculos, search, filterEstado]);

    const counts = useMemo(
        () => ({
            vencido: vehiculos.filter((v) => v.estado === 'vencido').length,
            al_dia: vehiculos.filter((v) => v.estado === 'al_dia').length,
        }),
        [vehiculos],
    );

    return (
        <>
            <Head title="Service" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                            Service
                        </h1>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            {counts.vencido} vencidos
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            {counts.al_dia} al día
                        </span>
                    </div>
                </div>

                {/* Filtros */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex w-full flex-col gap-2 lg:min-w-[240px] lg:flex-1">
                            <Label htmlFor="search">Buscar</Label>
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="search"
                                    type="text"
                                    placeholder="Patente, marca, modelo o conductor..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="flex w-full flex-col gap-2 lg:w-auto">
                            <Label>Estado</Label>
                            <div className="flex h-9 flex-wrap gap-1.5">
                                {FILTROS.map(({ val, label }) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setFilterEstado(val)}
                                        className={cn(
                                            'flex h-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all active:scale-[0.97]',
                                            filterEstado === val
                                                ? 'border-primary/50 bg-primary/10 text-primary'
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

                {/* Lista en dos columnas */}
                {filtered.length === 0 ? (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-16 text-muted-foreground">
                        No hay vehículos que coincidan con los filtros.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {filtered.map((row) => {
                            const cfg = ESTADO_CONFIG[row.estado];
                            const Icon = cfg.icon;
                            const extra =
                                row.estado === 'vencido'
                                    ? {
                                          label: 'Excedido',
                                          value: fmtKm(
                                              (row.km_recorridos ?? 0) -
                                                  intervaloKm,
                                          ),
                                          tone: 'text-red-600 dark:text-red-400',
                                      }
                                    : row.estado === 'al_dia'
                                      ? {
                                            label: 'Próximo en',
                                            value: fmtKm(row.km_restantes),
                                            tone: 'text-green-700 dark:text-green-400',
                                        }
                                      : null;
                            return (
                                <div
                                    key={row.id}
                                    onClick={() => openDialog(row)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === 'Enter' ||
                                            e.key === ' '
                                        ) {
                                            e.preventDefault();
                                            openDialog(row);
                                        }
                                    }}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-3.5 shadow-sm transition-all duration-200 outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]',
                                        cfg.border,
                                    )}
                                >
                                    {/* Identidad */}
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-mono text-base leading-none font-bold text-foreground">
                                                {row.patente}
                                            </h3>
                                            <span
                                                className={cn(
                                                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                                                    cfg.badge,
                                                )}
                                            >
                                                <Icon className="h-3 w-3" />
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                            {row.marca} {row.modelo}
                                            {row.conductor
                                                ? ` · ${row.conductor}`
                                                : ''}
                                        </p>
                                    </div>

                                    {/* Métricas */}
                                    <div className="flex shrink-0 items-center gap-4 text-right text-xs">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] text-muted-foreground">
                                                Km actual
                                            </span>
                                            <span className="font-medium text-foreground">
                                                {fmtKm(row.km_actual)}
                                            </span>
                                        </div>
                                        <div className="hidden flex-col sm:flex">
                                            <span className="text-[11px] text-muted-foreground">
                                                Últ. service
                                            </span>
                                            <span className="font-medium text-foreground">
                                                {fmtKm(
                                                    row.ultimo_service
                                                        ?.kilometraje,
                                                )}
                                            </span>
                                        </div>
                                        {extra && (
                                            <div
                                                className={cn(
                                                    'flex w-20 flex-col',
                                                    extra.tone,
                                                )}
                                            >
                                                <span className="text-[11px] opacity-80">
                                                    {extra.label}
                                                </span>
                                                <span className="font-semibold">
                                                    {extra.value}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {canManage && (
                                        <button
                                            type="button"
                                            title="Cargar kilometraje"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openKmDialog(row);
                                            }}
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                            <Gauge className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Dialog: info + registrar + historial */}
            <Dialog
                open={dialogOpen}
                onOpenChange={(o) => !o && setDialogOpen(false)}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
                    <DialogHeader className="flex-row items-start gap-3 space-y-0 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                            <Gauge className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                            <DialogTitle className="text-base font-semibold">
                                Service — {selected?.patente}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                {selected?.marca} {selected?.modelo}
                                {selected?.empresa
                                    ? ` · ${selected.empresa}`
                                    : ''}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-5 py-5">
                        {/* Resumen */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2">
                                <p className="text-[11px] text-muted-foreground">
                                    Km actual
                                </p>
                                <p className="text-sm font-semibold">
                                    {fmtKm(selected?.km_actual)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2">
                                <p className="text-[11px] text-muted-foreground">
                                    Último service
                                </p>
                                <p className="text-sm font-semibold">
                                    {fmtKm(
                                        selected?.ultimo_service?.kilometraje,
                                    )}
                                </p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2">
                                <p className="text-[11px] text-muted-foreground">
                                    Recorridos
                                </p>
                                <p className="text-sm font-semibold">
                                    {fmtKm(selected?.km_recorridos)}
                                </p>
                            </div>
                        </div>

                        {/* Km hasta el próximo service */}
                        {selected &&
                            (() => {
                                if (selected.estado === 'al_dia') {
                                    return (
                                        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2.5 text-center text-sm font-medium text-green-700 dark:text-green-400">
                                            Faltan{' '}
                                            {fmtKm(selected.km_restantes)} para
                                            el próximo service
                                        </div>
                                    );
                                }
                                if (selected.estado === 'vencido') {
                                    return (
                                        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-center text-sm font-medium text-red-700 dark:text-red-400">
                                            Service vencido — excedido por{' '}
                                            {fmtKm(
                                                (selected.km_recorridos ?? 0) -
                                                    intervaloKm,
                                            )}
                                        </div>
                                    );
                                }
                                if (selected.estado === 'sin_service') {
                                    return (
                                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-center text-sm font-medium text-amber-700 dark:text-amber-400">
                                            Sin service registrado — registrá el
                                            primero para calcular el próximo
                                        </div>
                                    );
                                }
                                return (
                                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center text-sm text-muted-foreground">
                                        Sin kilometraje registrado (falta una
                                        revisión)
                                    </div>
                                );
                            })()}

                        {/* Registrar service */}
                        {canManage && (
                            <form
                                id="service-form"
                                onSubmit={handleSubmit}
                                className="flex flex-col gap-3 rounded-lg border border-border p-3"
                            >
                                <p className="text-sm font-medium">
                                    Registrar nuevo service
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="km_service">
                                            Kilometraje
                                        </Label>
                                        <Input
                                            id="km_service"
                                            type="number"
                                            min={0}
                                            placeholder="Ej. 45000"
                                            value={form.data.kilometraje}
                                            onChange={(e) =>
                                                form.setData(
                                                    'kilometraje',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.kilometraje}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="fecha_service">
                                            Fecha
                                        </Label>
                                        <Input
                                            id="fecha_service"
                                            type="date"
                                            value={form.data.fecha}
                                            onChange={(e) =>
                                                form.setData(
                                                    'fecha',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.fecha}
                                        />
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Historial */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                                <History className="h-4 w-4 text-muted-foreground" />
                                Historial de services
                            </div>
                            {selected && selected.historial.length === 0 ? (
                                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                                    Sin services registrados.
                                </p>
                            ) : (
                                <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
                                    {selected?.historial.map((s) => (
                                        <div
                                            key={s.id}
                                            className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-foreground">
                                                    {fmtKm(s.kilometraje)}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {fmtDate(s.fecha)}
                                                    {s.realizado_por
                                                        ? ` · ${s.realizado_por}`
                                                        : ''}
                                                </span>
                                            </div>
                                            {canManage && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        deleteService(s.id)
                                                    }
                                                    title="Eliminar registro"
                                                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {canManage && (
                        <DialogFooter className="border-t border-border px-5 py-4">
                            <Button
                                type="submit"
                                form="service-form"
                                disabled={
                                    form.processing ||
                                    form.data.kilometraje === ''
                                }
                            >
                                {form.processing
                                    ? 'Guardando...'
                                    : 'Registrar service'}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Carga rápida de kilometraje */}
            <Dialog open={kmDialogOpen} onOpenChange={(o) => !o && setKmDialogOpen(false)}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                            <Gauge className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Cargar kilometraje — {kmRow?.patente}</DialogTitle>
                            <DialogDescription className="text-xs">Se usará como km actual si es la lectura más reciente por fecha.</DialogDescription>
                        </div>
                    </div>
                    <form id="km-form" onSubmit={handleKmSubmit} className="grid gap-4 px-5 py-5">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="km_lectura">Kilometraje</Label>
                                <Input
                                    id="km_lectura"
                                    type="number"
                                    min={0}
                                    placeholder="Ej. 65000"
                                    value={kmForm.data.kilometraje}
                                    onChange={(e) => kmForm.setData('kilometraje', e.target.value)}
                                    autoFocus
                                />
                                <InputError message={kmForm.errors.kilometraje} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="km_fecha">Fecha</Label>
                                <Input
                                    id="km_fecha"
                                    type="date"
                                    value={kmForm.data.fecha}
                                    onChange={(e) => kmForm.setData('fecha', e.target.value)}
                                />
                                <InputError message={kmForm.errors.fecha} />
                            </div>
                        </div>
                    </form>
                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button type="button" variant="outline" onClick={() => setKmDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" form="km-form" disabled={kmForm.processing || kmForm.data.kilometraje === ''}>
                            {kmForm.processing ? 'Guardando...' : 'Guardar km'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

ServiceIndex.layout = {
    breadcrumbs: [{ title: 'Service', href: '/services' }],
};
