import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Gauge,
    HelpCircle,
    History,
    Trash2,
    UserRound,
    Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { FilterBar, FilterField, SearchInput } from '@/components/app/filter-bar';
import { FormDialog } from '@/components/app/form-dialog';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import type { StatusTone } from '@/components/app/status-badge';
import { ExportDropdown } from '@/components/export-dropdown';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
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
        tone: StatusTone;
        /** Franja de color al borde izquierdo de la tarjeta. */
        accent: string;
        iconWrap: string;
        icon: typeof CheckCircle2;
    }
> = {
    vencido: {
        label: 'Service vencido',
        tone: 'destructive',
        accent: 'border-l-destructive',
        iconWrap: 'bg-destructive-soft text-destructive-soft-foreground',
        icon: AlertTriangle,
    },
    al_dia: {
        label: 'Al día',
        tone: 'success',
        accent: 'border-l-success',
        iconWrap: 'bg-success-soft text-success-soft-foreground',
        icon: CheckCircle2,
    },
    sin_service: {
        label: 'Sin service',
        tone: 'warning',
        accent: 'border-l-warning',
        iconWrap: 'bg-warning-soft text-warning-soft-foreground',
        icon: Wrench,
    },
    sin_km: {
        label: 'Sin datos',
        tone: 'neutral',
        accent: 'border-l-border',
        iconWrap: 'bg-muted text-muted-foreground',
        icon: HelpCircle,
    },
};

function fmtKm(n: number | null | undefined): string {
    if (n == null) {
        return '—';
    }

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
    const [deletingService, setDeletingService] =
        useState<ServiceHistorial | null>(null);

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

        if (!selected) {
            return;
        }

        form.post(`/services/${selected.id}`, {
            preserveScroll: true,
            onSuccess: () => setDialogOpen(false),
        });
    }

    function confirmDeleteService() {
        if (!deletingService) {
            return;
        }

        router.delete(`/services/${deletingService.id}`, {
            preserveScroll: true,
            onFinish: () => setDeletingService(null),
        });
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

    const hayFiltros = search.trim() !== '' || filterEstado !== 'all';

    function limpiarFiltros() {
        setSearch('');
        setFilterEstado('all');
    }

    const selectedConfig = selected ? ESTADO_CONFIG[selected.estado] : null;

    return (
        <>
            <Head title="Service" />

            <PageContainer>
                <PageHeader
                    title="Service"
                    count={{
                        value: filtered.length,
                        singular: 'vehículo',
                        plural: 'vehículos',
                    }}
                    actions={
                        <ExportDropdown
                            disabled={filtered.length === 0}
                            onExportPdf={() =>
                                window.open(
                                    '/pdf/services' + exportQuery(),
                                    '_blank',
                                )
                            }
                            onExportExcel={() =>
                                window.open(
                                    '/excel/services' + exportQuery(),
                                    '_blank',
                                )
                            }
                        />
                    }
                />

                <FilterBar
                    hasActiveFilters={hayFiltros}
                    onClear={limpiarFiltros}
                    gridClassName="lg:grid-cols-[minmax(240px,1fr)_auto_auto]"
                >
                    <FilterField label="Buscar" htmlFor="search">
                        <SearchInput
                            id="search"
                            value={search}
                            onChange={setSearch}
                            placeholder="Patente, marca, modelo o conductor..."
                        />
                    </FilterField>

                    <FilterField label="Estado">
                        <div className="flex h-9 flex-wrap gap-1.5">
                            {FILTROS.map(({ val, label }) => (
                                <button
                                    key={val}
                                    type="button"
                                    aria-pressed={filterEstado === val}
                                    onClick={() => setFilterEstado(val)}
                                    className={cn(
                                        'flex h-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]',
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
                    </FilterField>
                </FilterBar>

                {/* Lista en dos columnas */}
                {filtered.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border">
                        <EmptyState
                            variant={hayFiltros ? 'filtered' : 'empty'}
                            icon={hayFiltros ? undefined : Wrench}
                            title={
                                hayFiltros
                                    ? 'Ningún vehículo coincide con los filtros'
                                    : 'Todavía no hay vehículos'
                            }
                            description={
                                hayFiltros
                                    ? 'Probá con otra patente o quitá el filtro de estado.'
                                    : 'Cuando haya vehículos cargados, su estado de service aparece acá.'
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
                                          tone: 'text-destructive',
                                      }
                                    : row.estado === 'al_dia'
                                      ? {
                                            label: 'Próximo en',
                                            value: fmtKm(row.km_restantes),
                                            tone: 'text-success',
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
                                    {/* Avatar de estado. El texto lo pone el badge de abajo. */}
                                    <div
                                        aria-hidden="true"
                                        className={cn(
                                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                            cfg.iconWrap,
                                        )}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </div>

                                    {/* Identidad */}
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-mono text-base leading-none font-bold text-foreground">
                                                {row.patente}
                                            </h3>
                                            <StatusBadge
                                                tone={cfg.tone}
                                                size="sm"
                                            >
                                                {cfg.label}
                                            </StatusBadge>
                                        </div>
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
                                            <span className="text-xs text-muted-foreground">
                                                Km actual
                                            </span>
                                            <span className="text-sm font-bold text-foreground tabular-nums">
                                                {fmtKm(row.km_actual)}
                                            </span>
                                        </div>
                                        <div className="hidden flex-col sm:flex">
                                            <span className="text-xs text-muted-foreground">
                                                Último service
                                            </span>
                                            <span className="text-sm font-medium text-muted-foreground tabular-nums">
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
                                                <span className="text-xs opacity-80">
                                                    {extra.label}
                                                </span>
                                                <span className="font-semibold tabular-nums">
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
            </PageContainer>

            {/* Dialog: info + registrar + historial */}
            <FormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                size="md"
                icon={Gauge}
                tone={selectedConfig?.tone === 'neutral' ? 'primary' : (selectedConfig?.tone ?? 'primary')}
                title={`Service — ${selected?.patente ?? ''}`}
                description={
                    <>
                        {selected?.marca} {selected?.modelo}
                        {selected?.empresa ? ` · ${selected.empresa}` : ''}
                    </>
                }
                cancelLabel="Cerrar"
                footer={
                    canManage ? (
                        <DialogFooter className="border-t border-border px-5 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                            >
                                Cerrar
                            </Button>
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
                    ) : undefined
                }
            >
                {/* Kilometraje: km actual como dato principal, el resto como contexto */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        Kilometraje
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
                        <p className="text-xs text-muted-foreground">
                            Km actual
                        </p>
                        <p className="text-xl font-bold text-foreground tabular-nums">
                            {fmtKm(selected?.km_actual)}
                        </p>
                    </div>
                    {selected?.ultimo_service && (
                        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-center text-xs text-muted-foreground">
                            Último service a los{' '}
                            <span className="font-medium text-foreground">
                                {fmtKm(selected.ultimo_service.kilometraje)}
                            </span>
                            {selected.km_recorridos != null && (
                                <>
                                    {' '}
                                    ·{' '}
                                    <span className="font-medium text-foreground">
                                        {fmtKm(selected.km_recorridos)}
                                    </span>{' '}
                                    recorridos desde entonces
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Km hasta el próximo service */}
                {selected && selected.estado === 'al_dia' && (
                    <div className="rounded-lg border border-success/40 bg-success-soft px-3 py-2.5 text-center text-sm font-medium text-success-soft-foreground">
                        Faltan {fmtKm(selected.km_restantes)} para el próximo
                        service
                    </div>
                )}
                {selected && selected.estado === 'vencido' && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2.5 text-center text-sm font-medium text-destructive-soft-foreground">
                        Service vencido — excedido por{' '}
                        {fmtKm((selected.km_recorridos ?? 0) - intervaloKm)}
                    </div>
                )}
                {selected && selected.estado === 'sin_service' && (
                    <div className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 text-center text-sm font-medium text-warning-soft-foreground">
                        Sin service registrado — registrá el primero para
                        calcular el próximo
                    </div>
                )}
                {selected && selected.estado === 'sin_km' && (
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center text-sm text-muted-foreground">
                        Sin kilometraje registrado (falta una revisión)
                    </div>
                )}

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
                                Solo guarda la lectura del odómetro. No queda en
                                el historial de services.
                            </p>
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="km_lectura">Kilometraje</Label>
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
                                    message={kmForm.errors.kilometraje}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="km_fecha">Fecha</Label>
                                <Input
                                    id="km_fecha"
                                    type="date"
                                    value={kmForm.data.fecha}
                                    onChange={(e) =>
                                        kmForm.setData('fecha', e.target.value)
                                    }
                                />
                                <InputError message={kmForm.errors.fecha} />
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
                                Crea un registro en el historial y recalcula el
                                próximo vencimiento.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="km_service">Kilometraje</Label>
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
                                <InputError message={form.errors.kilometraje} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="fecha_service">Fecha</Label>
                                <Input
                                    id="fecha_service"
                                    type="date"
                                    value={form.data.fecha}
                                    onChange={(e) =>
                                        form.setData('fecha', e.target.value)
                                    }
                                />
                                <InputError message={form.errors.fecha} />
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
                                        <span className="font-medium text-foreground tabular-nums">
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
                                            onClick={() => setDeletingService(s)}
                                            title="Eliminar registro"
                                            aria-label="Eliminar este registro de service"
                                            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deletingService !== null}
                onOpenChange={(open) => !open && setDeletingService(null)}
                title="¿Eliminar este registro de service?"
                description={
                    deletingService
                        ? `Se borra el service de ${fmtKm(deletingService.kilometraje)} del ${fmtDate(deletingService.fecha)}${selected ? ` (${selected.patente})` : ''}. Esta acción no se puede deshacer.`
                        : undefined
                }
                confirmLabel="Eliminar service"
                onConfirm={confirmDeleteService}
            />
        </>
    );
}

ServiceIndex.layout = {
    breadcrumbs: [{ title: 'Service', href: '/services' }],
};
