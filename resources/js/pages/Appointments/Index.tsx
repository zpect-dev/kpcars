import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Ban,
    CalendarIcon,
    CalendarPlus,
    CheckCircle2,
    Clock,
    FileDown,
    MoreHorizontal,
    Wrench,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Vehiculo } from '@/types';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';
import { AppointmentCalendar } from './AppointmentCalendar';

type AppointmentStatus = 'agendado' | 'en_proceso' | 'completado' | 'cancelado';
type AppointmentType = 'normal' | 'emergencia';

interface AppointmentRow {
    id: number;
    service: string;
    type: AppointmentType;
    license_plate: string;
    conductor?: { id: number; name: string } | null;
    scheduled_date: string;
    status: AppointmentStatus;
    completed_by?: { name: string } | null;
    completed_at?: string | null;
    completion_description?: string | null;
}

interface PaginationInfo {
    data: AppointmentRow[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Filters {
    from?: string;
    to?: string;
    status?: string;
    plate?: string;
}

interface Props {
    appointments: PaginationInfo;
    filters: Filters;
    vehiculos: Pick<Vehiculo, 'id' | 'patente' | 'marca' | 'modelo' | 'user_id'>[];
    conductores: { id: number; name: string }[];
    mecanicos: { id: number; name: string }[];
    dailySlots: Record<string, number>;
    remainingToday: number;
    maxSlots: number;
}

const STATUS_STYLES: Record<AppointmentStatus, string> = {
    agendado: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    en_proceso: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
    agendado: 'Agendado',
    en_proceso: 'En curso',
    completado: 'Completado',
    cancelado: 'Cancelado',
};

const TYPE_STYLES: Record<AppointmentType, string> = {
    normal: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    emergencia: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const TYPE_LABEL: Record<AppointmentType, string> = {
    normal: 'Normal',
    emergencia: 'Emergencia',
};

// Dot color + active bg/text per status tab
const TAB_CONFIG: Record<'all' | AppointmentStatus, { dot: string; active: string }> = {
    all:        { dot: 'bg-zinc-400 dark:bg-zinc-500',  active: 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' },
    agendado:   { dot: 'bg-amber-400',                   active: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    en_proceso: { dot: 'bg-blue-400',                    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    completado: { dot: 'bg-green-400',                   active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    cancelado:  { dot: 'bg-red-400',                     active: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

const TABS: { key: 'all' | AppointmentStatus; label: string }[] = [
    { key: 'all',        label: 'Todos' },
    { key: 'agendado',   label: 'Agendados' },
    { key: 'en_proceso', label: 'En curso' },
    { key: 'completado', label: 'Completados' },
    { key: 'cancelado',  label: 'Cancelados' },
];

function formatDate(iso: string): string {
    const d = iso.length >= 10 ? iso.slice(0, 10) : iso;
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AppointmentsIndex({
    appointments,
    filters,
    vehiculos,
    conductores,
    mecanicos,
    dailySlots,
    remainingToday,
    maxSlots,
}: Props) {
    const today = useRef(new Date().toISOString().slice(0, 10)).current;

    const [from, setFrom] = useState(filters.from || '');
    const [to, setTo] = useState(filters.to || '');
    const [plate, setPlate] = useState(filters.plate || '');
    const [statusTab, setStatusTab] = useState<'all' | AppointmentStatus>('all');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [completeDialog, setCompleteDialog] = useState<{ id: number } | null>(null);
    const [selectedMecanicoId, setSelectedMecanicoId] = useState('');
    const [completionDescription, setCompletionDescription] = useState('');

    const isMounted = useRef(false);

    const { auth } = usePage<any>().props;
    const isMechanic = auth.user.role === 'mecanico';
    const isInversor = auth.user.role === 'inversor';

    const mecanicosVisibles = useMemo(
        () => mecanicos.filter((m) => m.id !== auth.user.id),
        [mecanicos, auth.user.id],
    );

    const form = useForm({
        service: '' as string,
        license_plate: '' as string,
        conductor_id: '' as string | number,
        preferred_date: today,
        type: 'normal' as AppointmentType,
    });

    const patenteOptions: ComboboxOption[] = useMemo(
        () => vehiculos.map((v) => ({ value: v.patente, label: v.patente, sub: `${v.marca} ${v.modelo}` })),
        [vehiculos],
    );

    const conductorOptions: ComboboxOption[] = useMemo(
        () => conductores.map((c) => ({ value: String(c.id), label: c.name })),
        [conductores],
    );

    // Sync date/plate filters to URL (status is client-side)
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        const hasChanges =
            from !== (filters.from || '') ||
            to !== (filters.to || '') ||
            plate !== (filters.plate || '');
        if (!hasChanges) return;

        const timeoutId = setTimeout(() => {
            const active: Record<string, string> = { from, to };
            if (plate) active.plate = plate;
            router.get('/appointments', active, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [from, to, plate, filters]);

    // Reset tab when server data changes (new filter applied)
    useEffect(() => {
        setStatusTab('all');
    }, [appointments.data]);

    const tabCounts = useMemo(() => ({
        all:        appointments.data.length,
        agendado:   appointments.data.filter((a) => a.status === 'agendado').length,
        en_proceso: appointments.data.filter((a) => a.status === 'en_proceso').length,
        completado: appointments.data.filter((a) => a.status === 'completado').length,
        cancelado:  appointments.data.filter((a) => a.status === 'cancelado').length,
    }), [appointments.data]);

    const filteredAppointments = useMemo(() => {
        if (statusTab === 'all') return appointments.data;
        return appointments.data.filter((a) => a.status === statusTab);
    }, [appointments.data, statusTab]);

    function clearFilters() {
        setFrom('');
        setTo('');
        setPlate('');
        setStatusTab('all');
        router.get('/appointments', { from: '', to: '' }, { preserveState: false, preserveScroll: true });
    }

    const hasActiveFilters = !!(from || to || plate);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/appointments', {
            preserveScroll: true,
            onSuccess: () => setIsDialogOpen(false),
        });
    }

    const canSubmit =
        !form.processing &&
        form.data.service.trim() !== '' &&
        form.data.license_plate.trim() !== '' &&
        form.data.conductor_id !== '' &&
        form.data.preferred_date !== '';

    function changeStatus(id: number, next: AppointmentStatus) {
        if (next === 'completado') {
            setSelectedMecanicoId('');
            setCompletionDescription('');
            setTimeout(() => setCompleteDialog({ id }), 10);
            return;
        }
        router.patch(`/appointments/${id}/status`, { status: next }, {
            preserveScroll: true,
            preserveState: true,
        });
    }

    function submitComplete() {
        if (!completeDialog || !selectedMecanicoId || completionDescription.trim() === '') return;
        router.patch(
            `/appointments/${completeDialog.id}/status`,
            {
                status: 'completado',
                completed_by_id: Number(selectedMecanicoId),
                completion_description: completionDescription.trim(),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setCompleteDialog(null);
                    setSelectedMecanicoId('');
                    setCompletionDescription('');
                },
            },
        );
    }

    return (
        <>
            <Head title="Turnos" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                            Turnos Asignados
                        </h1>
                        <span className={cn(
                            'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                            remainingToday > 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
                        )}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', remainingToday > 0 ? 'bg-green-500' : 'bg-red-500')} />
                            {remainingToday === 0
                                ? 'Sin cupos disponibles para hoy'
                                : `${remainingToday} ${remainingToday === 1 ? 'cupo disponible' : 'cupos disponibles'} para hoy`}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const params = new URLSearchParams();
                                if (from) params.set('from', from);
                                if (to) params.set('to', to);
                                if (plate) params.set('plate', plate);
                                const qs = params.toString();
                                window.open('/pdf/appointments' + (qs ? '?' + qs : ''), '_blank');
                            }}
                        >
                            <FileDown className="h-4 w-4" />
                            <span className="hidden sm:inline">Exportar PDF</span>
                        </Button>

                        {!isMechanic && !isInversor && (
                            <Dialog
                                open={isDialogOpen}
                                onOpenChange={(open) => {
                                    setIsDialogOpen(open);
                                    if (!open) {
                                        form.reset();
                                        form.clearErrors();
                                    }
                                }}
                            >
                                <DialogTrigger asChild>
                                    <Button size="sm">
                                        <CalendarPlus className="h-4 w-4" />
                                        <span className="hidden sm:inline">Agendar Turno</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Agendar Turno</DialogTitle>
                                        <DialogDescription className="sr-only">
                                            Completa los datos para agendar un turno
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
                                        <div className={cn(
                                            'flex items-center gap-3 rounded-md border p-3 transition-colors',
                                            form.data.type === 'emergencia'
                                                ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                                                : 'border-border bg-card',
                                        )}>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={form.data.type === 'emergencia'}
                                                onClick={() => form.setData('type', form.data.type === 'normal' ? 'emergencia' : 'normal')}
                                                className={cn(
                                                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                    form.data.type === 'emergencia' ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700',
                                                )}
                                            >
                                                <span className={cn(
                                                    'pointer-events-none mt-0.5 ml-0.5 block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform',
                                                    form.data.type === 'emergencia' && 'translate-x-4',
                                                )} />
                                            </button>
                                            <div className="flex items-center gap-1.5">
                                                <AlertTriangle className={cn('h-4 w-4', form.data.type === 'emergencia' ? 'text-red-600' : 'text-muted-foreground')} />
                                                <Label className="cursor-pointer select-none text-sm">Turno de emergencia</Label>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="service">Servicio</Label>
                                            <Input
                                                id="service"
                                                type="text"
                                                placeholder="Ej. Cambio de aceite"
                                                value={form.data.service}
                                                onChange={(e) => form.setData('service', e.target.value)}
                                            />
                                            <InputError message={form.errors.service} />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="license_plate">Patente</Label>
                                            <Combobox
                                                id="license_plate"
                                                placeholder="Buscar patente..."
                                                options={patenteOptions}
                                                value={form.data.license_plate}
                                                onSelect={(o) => {
                                                    form.setData('license_plate', o.value);
                                                    const v = vehiculos.find((veh) => veh.patente === o.value);
                                                    if (v && v.user_id) form.setData('conductor_id', v.user_id);
                                                }}
                                                uppercase
                                            />
                                            <InputError message={form.errors.license_plate} />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="conductor_id">Solicitante</Label>
                                            <Combobox
                                                id="conductor_id"
                                                placeholder="Seleccionar chofer..."
                                                options={conductorOptions}
                                                value={String(form.data.conductor_id)}
                                                onSelect={(o) => form.setData('conductor_id', o.value)}
                                            />
                                            <InputError message={form.errors.conductor_id} />
                                        </div>

                                        <div className="col-span-full grid gap-2">
                                            <AppointmentCalendar
                                                value={form.data.preferred_date}
                                                onChange={(val) => form.setData('preferred_date', val)}
                                                minDate={today}
                                                dailySlots={dailySlots}
                                                maxSlots={form.data.type === 'emergencia' ? 9999 : maxSlots}
                                                viewMode="week"
                                            />
                                            <InputError message={form.errors.preferred_date} />
                                        </div>

                                        <DialogFooter>
                                            <Button type="submit" disabled={!canSubmit}>
                                                {form.processing ? 'Procesando...' : 'Guardar Turno'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                {/* Date + plate filters */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="date">Rango de Fechas</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant="outline"
                                        className={cn('w-full justify-start text-left font-normal', !from && !to && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {from && to
                                            ? from === to
                                                ? formatDate(from)
                                                : `${formatDate(from)} - ${formatDate(to)}`
                                            : <span>Seleccionar rango</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <AppointmentCalendar
                                        mode="range"
                                        rangeValue={{ from, to }}
                                        onRangeChange={(range) => { setFrom(range.from); setTo(range.to); }}
                                        title={null}
                                        className="border-0 bg-popover"
                                        dailySlots={dailySlots}
                                        maxSlots={maxSlots}
                                        isFilterMode={true}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="plate">Patente</Label>
                            <Combobox
                                id="plate"
                                placeholder="Buscar patente..."
                                options={patenteOptions}
                                value={plate}
                                onSelect={(o) => setPlate(o.value)}
                                onInputChange={(text) => setPlate(text)}
                                uppercase
                            />
                        </div>

                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={clearFilters}
                                disabled={!hasActiveFilters}
                                title="Limpiar filtros"
                                className={cn(
                                    'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all lg:w-9 lg:px-0',
                                    hasActiveFilters
                                        ? 'border-border text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97]'
                                        : 'cursor-not-allowed border-border/40 text-muted-foreground/30',
                                )}
                            >
                                <X className="h-4 w-4" />
                                <span className="lg:hidden">Limpiar filtros</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status tabs */}
                <div className="flex flex-wrap gap-2">
                    {TABS.map(({ key, label }) => {
                        const count = tabCounts[key];
                        const isActive = statusTab === key;
                        const cfg = TAB_CONFIG[key];
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setStatusTab(key)}
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
                                    isActive
                                        ? cfg.active
                                        : 'bg-muted text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <span className={cn(
                                    'h-1.5 w-1.5 rounded-full transition-opacity',
                                    cfg.dot,
                                    isActive ? 'opacity-100' : 'opacity-40',
                                )} />
                                {label}
                                <span className={cn(
                                    'min-w-[1.25rem] rounded-full px-1 py-px text-center text-[10px] font-bold tabular-nums',
                                    isActive
                                        ? 'bg-black/10 dark:bg-white/20'
                                        : 'bg-background text-foreground/60',
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Appointment cards */}
                <div className="flex flex-col gap-3 pb-4">
                    {filteredAppointments.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-sm">
                            No hay turnos que coincidan con los filtros.
                        </div>
                    ) : (
                        filteredAppointments.map((a) => (
                            <div
                                key={a.id}
                                className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
                            >
                                {/* Number badge */}
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                                    <span className="text-xs font-bold text-muted-foreground">#{a.id}</span>
                                </div>

                                {/* Content */}
                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                    {/* Row 1: service + badges + actions */}
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-semibold leading-snug text-foreground">
                                                {a.service}
                                            </span>
                                            <span className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                                                TYPE_STYLES[a.type],
                                            )}>
                                                {TYPE_LABEL[a.type]}
                                            </span>
                                            <span className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                                                STATUS_STYLES[a.status],
                                            )}>
                                                {STATUS_LABEL[a.status]}
                                            </span>
                                        </div>

                                        {!isInversor && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 shrink-0"
                                                        disabled={isMechanic && a.status === 'completado'}
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Acciones</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        disabled={a.status === 'agendado'}
                                                        onSelect={() => changeStatus(a.id, 'agendado')}
                                                    >
                                                        <Clock className="h-4 w-4" />
                                                        Marcar agendado
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={a.status === 'en_proceso'}
                                                        onSelect={() => changeStatus(a.id, 'en_proceso')}
                                                    >
                                                        <Wrench className="h-4 w-4" />
                                                        Marcar en proceso
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={a.status === 'completado'}
                                                        onSelect={() => changeStatus(a.id, 'completado')}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Marcar completado
                                                    </DropdownMenuItem>
                                                    {!isMechanic && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                disabled={a.status === 'cancelado'}
                                                                onSelect={() => changeStatus(a.id, 'cancelado')}
                                                                className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                                                            >
                                                                <Ban className="h-4 w-4" />
                                                                Cancelar turno
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>

                                    {/* Row 2: date + plate + conductor */}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                        <span className="text-xs text-muted-foreground">
                                            {formatDate(a.scheduled_date)}
                                        </span>
                                        <span className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                                            {a.license_plate}
                                        </span>
                                        {a.conductor?.name && (
                                            <span className="text-xs text-muted-foreground">
                                                {a.conductor.name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Row 3: completed by */}
                                    {a.completed_by && (
                                        <p className="text-xs text-muted-foreground">
                                            Realizado por{' '}
                                            <span className="font-medium text-foreground">{a.completed_by.name}</span>
                                            {a.completed_at && (
                                                <span className="text-muted-foreground/70"> · {formatDateTime(a.completed_at)}</span>
                                            )}
                                        </p>
                                    )}

                                    {/* Row 4: description */}
                                    {a.completion_description && (
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            {a.completion_description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Complete dialog */}
            <Dialog
                open={completeDialog !== null}
                onOpenChange={(o) => {
                    if (!o) {
                        setCompleteDialog(null);
                        setSelectedMecanicoId('');
                        setCompletionDescription('');
                    }
                }}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Marcar turno como completado</DialogTitle>
                        <DialogDescription>
                            Selecciona el mecánico e ingresa una descripción del trabajo realizado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-2">
                            <Label>Mecánico</Label>
                            {mecanicosVisibles.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No hay mecánicos disponibles.</p>
                            ) : (
                                <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border">
                                    {mecanicosVisibles.map((m) => {
                                        const isSelected = selectedMecanicoId === String(m.id);
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setSelectedMecanicoId(String(m.id))}
                                                className={cn(
                                                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                                                    isSelected
                                                        ? 'bg-primary/10 font-medium text-foreground'
                                                        : 'text-muted-foreground hover:bg-muted/60',
                                                )}
                                            >
                                                <span>{m.name}</span>
                                                {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="completion_description">Descripción del trabajo realizado</Label>
                            <textarea
                                id="completion_description"
                                rows={4}
                                placeholder="Describí el trabajo realizado..."
                                value={completionDescription}
                                onChange={(e) => setCompletionDescription(e.target.value)}
                                maxLength={2000}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            onClick={submitComplete}
                            disabled={!selectedMecanicoId || completionDescription.trim() === ''}
                        >
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

AppointmentsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Turnos',
            href: '/appointments',
        },
    ],
};
