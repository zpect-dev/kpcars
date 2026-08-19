import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    Download,
    FileSpreadsheet,
    Gauge,
    HelpCircle,
    History,
    Search,
    Trash2,
    UserRound,
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    {
        label: string;
        accent: string;
        iconWrap: string;
        icon: typeof CheckCircle2;
    }
> = {
    vencido: {
        label: 'Service vencido',
        accent: 'border-l-red-500 dark:border-l-red-600',
        iconWrap: 'bg-red-500/15 text-red-600 dark:text-red-400',
        icon: AlertTriangle,
    },
    al_dia: {
        label: 'Al día',
        accent: 'border-l-green-500 dark:border-l-green-600',
        iconWrap: 'bg-green-500/15 text-green-600 dark:text-green-400',
        icon: CheckCircle2,
    },
    sin_service: {
        label: 'Sin service',
        accent: 'border-l-amber-500 dark:border-l-amber-600',
        iconWrap: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        icon: Wrench,
    },
    sin_km: {
        label: 'Sin datos',
        accent: 'border-l-border',
        iconWrap: 'bg-muted text-muted-foreground',
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

/** Orden de urgencia: vencido primero, sin datos al final. */
const ESTADO_PRIORIDAD: Record<Estado, number> = {
    vencido: 0,
    sin_service: 1,
    al_dia: 2,
    sin_km: 3,
};

export default function ServiceIndex({ vehiculos, intervaloKm }: Props) {
    const { auth } = usePage<any>().props;
    const canManage = auth.permissions?.can_manage_service ?? false;

    const [search, setSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState<Estado | 'all'>('all');
    const [selected, setSelected] = useState<ServiceRow | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const form = useForm({
        kilometraje: '',
        fecha: today,
    });

    const kmForm = useForm({
        kilometraje: '',
        fecha: today,
    });

    function handleKmSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!selected) {
            return;
        }

        kmForm.post(`/services/${selected.id}/kilometraje`, {
            preserveScroll: true,
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
        kmForm.reset();
        kmForm.clearErrors();
        kmForm.setData({
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
        const result = vehiculos.filter((v) => {
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

        // Más urgente primero: vencidos por mayor excedido, al día por menor restante.
        return [...result].sort((a, b) => {
            const prioridad =
                ESTADO_PRIORIDAD[a.estado] - ESTADO_PRIORIDAD[b.estado];

            if (prioridad !== 0) {
                return prioridad;
            }

            if (a.estado === 'vencido') {
                return (b.km_recorridos ?? 0) - (a.km_recorridos ?? 0);
            }

            if (a.estado === 'al_dia') {
                return (a.km_restantes ?? 0) - (b.km_restantes ?? 0);
            }

            return a.patente.localeCompare(b.patente, 'es', {
                numeric: true,
            });
        });
    }, [vehiculos, search, filterEstado]);

    /** Los exportes salen con los mismos filtros que se ven en pantalla. */
    function exportQuery(): string {
        const params = new URLSearchParams();

        if (search.trim()) {
            params.set('q', search.trim());
        }

        if (filterEstado !== 'all') {
            params.set('estado', filterEstado);
        }

        const qs = params.toString();

        return qs ? `?${qs}` : '';
    }

    const counts = useMemo(
        () => ({
            all: vehiculos.length,
            vencido: vehiculos.filter((v) => v.estado === 'vencido').length,
            al_dia: vehiculos.filter((v) => v.estado === 'al_dia').length,
            sin_service: vehiculos.filter((v) => v.estado === 'sin_service')
                .length,
            sin_km: vehiculos.filter((v) => v.estado === 'sin_km').length,
        }),
        [vehiculos],
    );

    return (
        <>
            <Head title="Service" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                        Service
                    </h1>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={filtered.length === 0}
                            >
                                <Download className="mr-1.5 h-4 w-4" />
                                Exportar
                                <ChevronDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() =>
                                    window.open(
                                        '/pdf/services' + exportQuery(),
                                        '_blank',
                                    )
                                }
                            >
                                <Download className="mr-2 h-4 w-4" />
                                PDF (según filtros)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    window.open(
                                        '/excel/services' + exportQuery(),
                                        '_blank',
                                    )
                                }
                            >
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Excel (según filtros)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                                        <span className="font-bold tabular-nums">
                                            {counts[val]}
                                        </span>
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
                                        'flex cursor-pointer items-center gap-3 rounded-xl border border-l-4 border-border bg-card p-3.5 shadow-sm transition-all duration-200 outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]',
                                        cfg.accent,
                                    )}
                                >
                                    {/* Avatar de estado */}
                                    <div
                                        className={cn(
                                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                            cfg.iconWrap,
                                        )}
                                        title={cfg.label}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </div>

                                    {/* Identidad */}
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <h3 className="font-mono text-base leading-none font-bold text-foreground">
                                            {row.patente}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            {row.conductor ? (
                                                <span className="truncate text-muted-foreground">
                                                    {row.conductor}
                                                </span>
                                            ) : (
                                                <span className="truncate text-muted-foreground/50 italic">
                                                    Sin conductor asignado
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Km actual/último service + urgencia (el resto del detalle queda en el modal) */}
                                    <div className="flex shrink-0 items-center gap-4 text-right text-xs">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] text-muted-foreground">
                                                Km actual
                                            </span>
                                            <span className="text-sm font-bold text-foreground">
                                                {fmtKm(row.km_actual)}
                                            </span>
                                        </div>
                                        <div className="hidden flex-col sm:flex">
                                            <span className="text-[11px] text-muted-foreground">
                                                Último service
                                            </span>
                                            <span className="text-sm font-medium text-muted-foreground">
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
                        {/* Kilometraje: km actual como dato principal, el resto como contexto */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                                <Gauge className="h-4 w-4 text-muted-foreground" />
                                Kilometraje
                            </div>
                            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
                                <p className="text-[11px] text-muted-foreground">
                                    Km actual
                                </p>
                                <p className="text-xl font-bold text-foreground">
                                    {fmtKm(selected?.km_actual)}
                                </p>
                            </div>
                            {selected?.ultimo_service && (
                                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-center text-xs text-muted-foreground">
                                    Último service a los{' '}
                                    <span className="font-medium text-foreground">
                                        {fmtKm(
                                            selected.ultimo_service
                                                .kilometraje,
                                        )}
                                    </span>
                                    {selected.km_recorridos != null && (
                                        <>
                                            {' '}
                                            ·{' '}
                                            <span className="font-medium text-foreground">
                                                {fmtKm(
                                                    selected.km_recorridos,
                                                )}
                                            </span>{' '}
                                            recorridos desde entonces
                                        </>
                                    )}
                                </div>
                            )}
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

                        {/* Actualizar kilometraje: solo la lectura del odómetro, no crea historial */}
                        {canManage && (
                            <form
                                onSubmit={handleKmSubmit}
                                className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        Actualizar kilometraje
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Solo guarda la lectura del odómetro.
                                        No queda en el historial de services.
                                    </p>
                                </div>
                                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="km_lectura">
                                            Kilometraje
                                        </Label>
                                        <Input
                                            id="km_lectura"
                                            type="number"
                                            min={0}
                                            placeholder="Ej. 65000"
                                            value={kmForm.data.kilometraje}
                                            onChange={(e) =>
                                                kmForm.setData(
                                                    'kilometraje',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={
                                                kmForm.errors.kilometraje
                                            }
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="km_fecha">
                                            Fecha
                                        </Label>
                                        <Input
                                            id="km_fecha"
                                            type="date"
                                            value={kmForm.data.fecha}
                                            onChange={(e) =>
                                                kmForm.setData(
                                                    'fecha',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={kmForm.errors.fecha}
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            kmForm.processing ||
                                            kmForm.data.kilometraje === ''
                                        }
                                    >
                                        {kmForm.processing
                                            ? 'Guardando...'
                                            : 'Guardar km'}
                                    </Button>
                                </div>
                            </form>
                        )}

                        {/* Registrar service */}
                        {canManage && (
                            <form
                                id="service-form"
                                onSubmit={handleSubmit}
                                className="flex flex-col gap-3 rounded-lg border border-border p-3"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        Registrar nuevo service
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Crea un registro en el historial y
                                        recalcula el próximo vencimiento.
                                    </p>
                                </div>
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
        </>
    );
}

ServiceIndex.layout = {
    breadcrumbs: [{ title: 'Service', href: '/services' }],
};
