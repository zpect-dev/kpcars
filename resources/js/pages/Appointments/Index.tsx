import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Ban,
    CalendarPlus,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    FileDown,
    MoreHorizontal,
    X,
    Wrench,
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
import InputError from '@/components/input-error';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type AppointmentStatus = 'agendado' | 'en_proceso' | 'completado' | 'cancelado';
type AppointmentType = 'normal' | 'emergencia';

interface AppointmentRow {
    id: number;
    service: string;
    type: AppointmentType;
    license_plate: string;
    conductor?: {
        id: number;
        name: string;
    } | null;
    scheduled_date: string;
    status: AppointmentStatus;
    completed_by?: {
        name: string;
    } | null;
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
    dailySlots: Record<string, number>;
    remainingToday: number;
    maxSlots: number;
}

const STATUS_STYLES: Record<AppointmentStatus, string> = {
    agendado:
        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    en_proceso:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completado:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
    agendado: 'Agendado',
    en_proceso: 'En proceso',
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

function formatDate(iso: string): string {
    const d = iso.length >= 10 ? iso.slice(0, 10) : iso;
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
}

export default function AppointmentsIndex({
    appointments,
    filters,
    vehiculos,
    conductores,
    dailySlots,
    remainingToday,
    maxSlots,
}: Props) {
    const [from, setFrom] = useState(filters.from || '');
    const [to, setTo] = useState(filters.to || '');
    const [status, setStatus] = useState(filters.status || '');
    const [plate, setPlate] = useState(filters.plate || '');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { auth } = usePage<any>().props;
    const isMechanic = auth.user.role === 'mecanico';

    const today = useRef(new Date().toISOString().slice(0, 10)).current;

    const form = useForm({
        service: '' as string,
        license_plate: '' as string,
        conductor_id: '' as string | number,
        preferred_date: today,
        type: 'normal' as AppointmentType,
    });

    const isMounted = useRef(false);

    const patenteOptions: ComboboxOption[] = useMemo(
        () =>
            vehiculos.map((v) => ({
                value: v.patente,
                label: v.patente,
                sub: `${v.marca} ${v.modelo}`,
            })),
        [vehiculos],
    );

    const conductorOptions: ComboboxOption[] = useMemo(
        () =>
            conductores.map((c) => ({
                value: String(c.id),
                label: c.name,
            })),
        [conductores],
    );

    /**
     * Check if a given date string (YYYY-MM-DD) has exhausted normal slots.
     */
    const isDateFull = (dateStr: string): boolean => {
        return (dailySlots[dateStr] ?? 0) >= maxSlots;
    };

    /**
     * Get the slot usage text for the selected date.
     */
    const selectedDateSlots = useMemo(() => {
        const date = form.data.preferred_date;
        if (!date) return null;
        const used = dailySlots[date] ?? 0;
        return { used, max: maxSlots, full: used >= maxSlots };
    }, [form.data.preferred_date, dailySlots, maxSlots]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/appointments', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset('license_plate', 'conductor_id', 'service');
                form.setData('type', 'normal');
                setIsDialogOpen(false);
            },
        });
    }

    const canSubmit =
        !form.processing &&
        form.data.service.trim() !== '' &&
        form.data.license_plate.trim() !== '' &&
        form.data.conductor_id !== '' &&
        form.data.preferred_date !== '';

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }

        const hasChanges =
            from !== (filters.from || '') ||
            to !== (filters.to || '') ||
            status !== (filters.status || '') ||
            plate !== (filters.plate || '');

        if (!hasChanges) return;

        const timeoutId = setTimeout(() => {
            const active: Record<string, string> = {
                from: from,
                to: to,
            };
            if (status) active.status = status;
            if (plate) active.plate = plate;

            router.get('/appointments', active, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [from, to, status, plate, filters]);

    function clearFilters() {
        setFrom('');
        setTo('');
        setStatus('');
        setPlate('');
        // Enviar explícitamente from y to vacíos con preserveState: false
        router.get(
            '/appointments',
            { from: '', to: '' },
            { preserveState: false, preserveScroll: true },
        );
    }

    const hasActiveFilters = !!(from || to || status || plate);

    function changeStatus(id: number, next: AppointmentStatus) {
        router.patch(
            `/appointments/${id}/status`,
            { status: next },
            {
                preserveScroll: true,
                preserveState: true,
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
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                                remainingToday > 0 
                                    ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                            )}>
                                <span className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    remainingToday > 0 ? "bg-green-500" : "bg-red-500"
                                )} />
                                {remainingToday === 0 
                                    ? "Sin cupos disponibles para hoy" 
                                    : `${remainingToday} ${remainingToday === 1 ? 'cupo disponible' : 'cupos disponibles'} para hoy`
                                }
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const params = new URLSearchParams();
                                if (from) params.set('from', from);
                                if (to) params.set('to', to);
                                if (status) params.set('status', status);
                                if (plate) params.set('plate', plate);
                                const qs = params.toString();
                                window.open('/pdf/appointments' + (qs ? '?' + qs : ''), '_blank');
                            }}
                        >
                            <FileDown className="h-4 w-4" />
                            <span className="hidden sm:inline">Exportar PDF</span>
                        </Button>

                    {!isMechanic && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <CalendarPlus className="h-4 w-4" />
                                    <span className="hidden sm:inline">
                                        Agendar Turno
                                    </span>
                                </Button>
                            </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Agendar Turno</DialogTitle>
                                <DialogDescription className="sr-only">
                                    Completa los datos para agendar un turno
                                </DialogDescription>
                            </DialogHeader>

                            <form
                                onSubmit={handleSubmit}
                                className="grid gap-4 py-4"
                            >
                                {/* Toggle emergencia */}
                                <div
                                    className={cn(
                                        'flex items-center gap-3 rounded-md border p-3 transition-colors',
                                        form.data.type === 'emergencia'
                                            ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                                            : 'border-border bg-card',
                                    )}
                                >
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={
                                            form.data.type === 'emergencia'
                                        }
                                        onClick={() =>
                                            form.setData(
                                                'type',
                                                form.data.type === 'normal'
                                                    ? 'emergencia'
                                                    : 'normal',
                                            )
                                        }
                                        className={cn(
                                            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                            form.data.type === 'emergencia'
                                                ? 'bg-red-600'
                                                : 'bg-gray-200 dark:bg-gray-700',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'pointer-events-none mt-0.5 ml-0.5 block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform',
                                                form.data.type ===
                                                    'emergencia' &&
                                                    'translate-x-4',
                                            )}
                                        />
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                        <AlertTriangle
                                            className={cn(
                                                'h-4 w-4',
                                                form.data.type === 'emergencia'
                                                    ? 'text-red-600'
                                                    : 'text-muted-foreground',
                                            )}
                                        />
                                        <Label className="cursor-pointer text-sm select-none">
                                            Turno de emergencia
                                        </Label>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="service">Servicio</Label>
                                    <Input
                                        id="service"
                                        type="text"
                                        placeholder="Ej. Cambio de aceite"
                                        value={form.data.service}
                                        onChange={(e) =>
                                            form.setData(
                                                'service',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={form.errors.service} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="license_plate">
                                        Patente
                                    </Label>
                                    <Combobox
                                        id="license_plate"
                                        placeholder="Buscar patente..."
                                        options={patenteOptions}
                                        value={form.data.license_plate}
                                        onSelect={(o) => {
                                            form.setData('license_plate', o.value);
                                            // Autocompletar conductor asignado
                                            const v = vehiculos.find(v => v.patente === o.value);
                                            if (v && v.user_id) {
                                                form.setData('conductor_id', v.user_id);
                                            }
                                        }}
                                        uppercase
                                    />
                                    <InputError
                                        message={form.errors.license_plate}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="conductor_id">
                                        Solicitante
                                    </Label>
                                    <Combobox
                                        id="conductor_id"
                                        placeholder="Seleccionar chofer..."
                                        options={conductorOptions}
                                        value={String(form.data.conductor_id)}
                                        onSelect={(o) =>
                                            form.setData(
                                                'conductor_id',
                                                o.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={form.errors.conductor_id}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="preferred_date">
                                        Fecha Solicitada
                                    </Label>
                                    <Input
                                        id="preferred_date"
                                        type="date"
                                        min={today}
                                        value={form.data.preferred_date}
                                        onChange={(e) =>
                                            form.setData(
                                                'preferred_date',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    {/* Slot usage indicator */}
                                    {selectedDateSlots && (
                                        <div
                                            className={cn(
                                                'flex items-center gap-1.5 text-xs',
                                                selectedDateSlots.full
                                                    ? 'text-red-600'
                                                    : selectedDateSlots.used >=
                                                        maxSlots - 1
                                                      ? 'text-amber-600'
                                                      : 'text-muted-foreground',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'inline-block h-2 w-2 rounded-full',
                                                    selectedDateSlots.full
                                                        ? 'bg-red-500'
                                                        : selectedDateSlots.used >=
                                                            maxSlots - 1
                                                          ? 'bg-amber-500'
                                                          : 'bg-green-500',
                                                )}
                                            />
                                            {selectedDateSlots.full ? (
                                                form.data.type ===
                                                'emergencia' ? (
                                                    <span>
                                                        Cupos normales agotados
                                                        — emergencia disponible
                                                    </span>
                                                ) : (
                                                    <span>
                                                        Sin cupos normales
                                                        disponibles — active
                                                        emergencia
                                                    </span>
                                                )
                                            ) : (
                                                <span>
                                                    {selectedDateSlots.used}/
                                                    {selectedDateSlots.max}{' '}
                                                    cupos normales usados
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <InputError
                                        message={form.errors.preferred_date}
                                    />
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={!canSubmit}>
                                        {form.processing
                                            ? 'Procesando...'
                                            : 'Guardar Turno'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                    )}
                    </div>
                </div>

                {/* Filtros */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="from">Desde</Label>
                            <Input
                                id="from"
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="to">Hasta</Label>
                            <Input
                                id="to"
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="status">Estado</Label>
                            <Select
                                value={status || 'all'}
                                onValueChange={(v) =>
                                    setStatus(v === 'all' ? '' : v)
                                }
                            >
                                <SelectTrigger id="status" className="w-full">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="agendado">
                                        Agendado
                                    </SelectItem>
                                    <SelectItem value="en_proceso">
                                        En proceso
                                    </SelectItem>
                                    <SelectItem value="completado">
                                        Completado
                                    </SelectItem>
                                    <SelectItem value="cancelado">
                                        Cancelado
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="plate">Patente</Label>
                            <Input
                                id="plate"
                                type="text"
                                placeholder="Buscar patente..."
                                value={plate}
                                onChange={(e) =>
                                    setPlate(e.target.value.toUpperCase())
                                }
                            />
                        </div>

                        <div className="col-span-full flex items-end sm:col-span-2 lg:col-span-1">
                            <button
                                type="button"
                                onClick={clearFilters}
                                disabled={!hasActiveFilters}
                                title="Limpiar filtros"
                                className={cn(
                                    'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-150 lg:w-9 lg:px-0',
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

                {/* Tabla + cards */}
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    {/* Desktop */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full table-fixed text-left text-sm text-muted-foreground">
                            <thead className="border-b border-border bg-muted/40 text-xs uppercase">
                                <tr>
                                    <th className="w-[8%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        # Turno
                                    </th>
                                    <th className="w-[10%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Fecha
                                    </th>
                                    <th className="w-[20%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Servicio
                                    </th>
                                    <th className="w-[10%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Patente
                                    </th>
                                    <th className="w-[12%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Solicitante
                                    </th>
                                    <th className="w-[10%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Tipo
                                    </th>
                                    <th className="w-[10%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Estado
                                    </th>
                                    <th className="w-[12%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Completado por
                                    </th>
                                    <th className="w-[8%] px-4 py-3 text-right font-medium tracking-wider sm:px-6 sm:py-4">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {appointments.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="px-6 py-12 text-center text-muted-foreground"
                                        >
                                            No hay turnos que coincidan con los
                                            filtros.
                                        </td>
                                    </tr>
                                ) : (
                                    appointments.data.map((a) => {
                                        return (
                                            <tr
                                                key={a.id}
                                                className="bg-card transition-colors hover:bg-muted/40"
                                            >
                                                <td className="px-4 py-3 font-medium text-foreground sm:px-6 sm:py-4">
                                                    #{a.id}
                                                </td>
                                                <td
                                                    className="truncate px-4 py-3 font-medium text-muted-foreground sm:px-6 sm:py-4"
                                                    title={formatDate(
                                                        a.scheduled_date,
                                                    )}
                                                >
                                                    {formatDate(
                                                        a.scheduled_date,
                                                    )}
                                                </td>
                                                <td
                                                    className="truncate px-4 py-3 sm:px-6 sm:py-4"
                                                    title={a.service}
                                                >
                                                    {a.service}
                                                </td>
                                                <td
                                                    className="truncate px-4 py-3 font-mono text-foreground sm:px-6 sm:py-4"
                                                    title={a.license_plate}
                                                >
                                                    {a.license_plate}
                                                </td>
                                                <td
                                                    className="truncate px-4 py-3 sm:px-6 sm:py-4"
                                                    title={a.conductor?.name || '-'}
                                                >
                                                    {a.conductor?.name || '-'}
                                                </td>
                                                <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                                            TYPE_STYLES[a.type],
                                                        )}
                                                    >
                                                        {TYPE_LABEL[a.type]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                                            STATUS_STYLES[
                                                                a.status
                                                            ],
                                                        )}
                                                    >
                                                        {STATUS_LABEL[a.status]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs sm:px-6 sm:py-4">
                                                    {a.status ===
                                                        'completado' &&
                                                    a.completed_by ? (
                                                        <span
                                                            className="font-medium text-foreground"
                                                            title={
                                                                a.completed_by
                                                                    .name
                                                            }
                                                        >
                                                            {
                                                                a.completed_by
                                                                    .name
                                                            }
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40 italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="truncate px-4 py-3 text-right sm:px-6 sm:py-4">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                            asChild
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                                <span className="sr-only">
                                                                    Acciones
                                                                </span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>
                                                                Cambiar estado
                                                            </DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                disabled={
                                                                    a.status ===
                                                                    'agendado'
                                                                }
                                                                onSelect={() =>
                                                                    changeStatus(
                                                                        a.id,
                                                                        'agendado',
                                                                    )
                                                                }
                                                            >
                                                                <Clock className="h-4 w-4" />
                                                                Marcar agendado
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                disabled={
                                                                    a.status ===
                                                                    'en_proceso'
                                                                }
                                                                onSelect={() =>
                                                                    changeStatus(
                                                                        a.id,
                                                                        'en_proceso',
                                                                    )
                                                                }
                                                            >
                                                                <Wrench className="h-4 w-4" />
                                                                Marcar en
                                                                proceso
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                disabled={
                                                                    a.status ===
                                                                    'completado'
                                                                }
                                                                onSelect={() =>
                                                                    changeStatus(
                                                                        a.id,
                                                                        'completado',
                                                                    )
                                                                }
                                                            >
                                                                <CheckCircle2 className="h-4 w-4" />
                                                                Marcar
                                                                completado
                                                            </DropdownMenuItem>
                                                            {!isMechanic && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        disabled={
                                                                            a.status ===
                                                                            'cancelado'
                                                                        }
                                                                        onSelect={() =>
                                                                            changeStatus(
                                                                                a.id,
                                                                                'cancelado',
                                                                            )
                                                                        }
                                                                        className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                                                                    >
                                                                        <Ban className="h-4 w-4" />
                                                                        Cancelar turno
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <ul className="divide-y divide-border md:hidden">
                        {appointments.data.length === 0 ? (
                            <li className="px-4 py-12 text-center text-sm text-muted-foreground">
                                No hay turnos que coincidan con los filtros.
                            </li>
                        ) : (
                            appointments.data.map((a) => (
                                <li
                                    key={a.id}
                                    className="flex flex-col gap-2 p-4"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-foreground">
                                                #{a.id}
                                            </span>
                                            <span
                                                className={cn(
                                                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                                    STATUS_STYLES[a.status],
                                                )}
                                            >
                                                {STATUS_LABEL[a.status]}
                                            </span>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="-mr-2 -mt-1 shrink-0"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">
                                                        Acciones
                                                    </span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>
                                                    Cambiar estado
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    disabled={
                                                        a.status === 'agendado'
                                                    }
                                                    onSelect={() =>
                                                        changeStatus(
                                                            a.id,
                                                            'agendado',
                                                        )
                                                    }
                                                >
                                                    <Clock className="h-4 w-4" />
                                                    Marcar agendado
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={
                                                        a.status ===
                                                        'en_proceso'
                                                    }
                                                    onSelect={() =>
                                                        changeStatus(
                                                            a.id,
                                                            'en_proceso',
                                                        )
                                                    }
                                                >
                                                    <Wrench className="h-4 w-4" />
                                                    Marcar en proceso
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={
                                                        a.status ===
                                                        'completado'
                                                    }
                                                    onSelect={() =>
                                                        changeStatus(
                                                            a.id,
                                                            'completado',
                                                        )
                                                    }
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Marcar completado
                                                </DropdownMenuItem>
                                                {!isMechanic && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            disabled={
                                                                a.status ===
                                                                'cancelado'
                                                            }
                                                            onSelect={() =>
                                                                changeStatus(
                                                                    a.id,
                                                                    'cancelado',
                                                                )
                                                            }
                                                            className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                                                        >
                                                            <Ban className="h-4 w-4" />
                                                            Cancelar turno
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>
                                            {formatDate(a.scheduled_date)}
                                        </span>
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                                                TYPE_STYLES[a.type],
                                            )}
                                        >
                                            {TYPE_LABEL[a.type]}
                                        </span>
                                    </div>
                                    <p className="line-clamp-2 text-sm text-foreground">
                                        {a.service}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span className="font-mono font-medium text-foreground">
                                            {a.license_plate}
                                        </span>
                                        {a.conductor?.name && (
                                            <span>
                                                Solicitante:{' '}
                                                <span className="text-foreground">
                                                    {a.conductor.name}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                    {a.status === 'completado' &&
                                        a.completed_by && (
                                            <div className="text-xs text-muted-foreground">
                                                Completado por{' '}
                                                <span className="font-medium text-foreground">
                                                    {a.completed_by.name}
                                                </span>
                                            </div>
                                        )}
                                </li>
                            ))
                        )}
                    </ul>

                    {/* Paginación */}
                    {appointments.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
                            <span className="text-xs text-muted-foreground">
                                Página {appointments.current_page} de{' '}
                                {appointments.last_page}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!appointments.prev_page_url}
                                    onClick={() =>
                                        appointments.prev_page_url &&
                                        router.get(
                                            appointments.prev_page_url,
                                            {},
                                            {
                                                preserveState: true,
                                                preserveScroll: true,
                                            },
                                        )
                                    }
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!appointments.next_page_url}
                                    onClick={() =>
                                        appointments.next_page_url &&
                                        router.get(
                                            appointments.next_page_url,
                                            {},
                                            {
                                                preserveState: true,
                                                preserveScroll: true,
                                            },
                                        )
                                    }
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
