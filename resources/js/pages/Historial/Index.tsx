import { Head, router } from '@inertiajs/react';
import {
    ArrowRight,
    CalendarIcon,
    Car,
    UserMinus,
    UserPlus,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppointmentCalendar } from '@/pages/Appointments/AppointmentCalendar';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type EventoTipo = 'alta' | 'baja';

interface Vehiculo {
    patente: string;
    marca: string;
    modelo: string;
}

interface ChoferEvento {
    id: number;
    tipo: EventoTipo;
    chofer: string;
    chofer_dni?: string | null;
    fecha: string;
}

interface Cambio {
    id: number;
    conductor: string;
    conductor_dni?: string | null;
    vehiculo_anterior: Vehiculo | null;
    vehiculo: Vehiculo | null;
    fecha_inicio: string;
    fecha_fin?: string | null;
}

interface Filters {
    from?: string;
    to?: string;
    chofer?: string;
}

interface Props {
    filters: Filters;
    eventos: ChoferEvento[];
    cambios: Cambio[];
    choferes: { id: number; name: string }[];
    stats: { altas: number; bajas: number; cambios: number };
}

function formatDateRange(iso: string): string {
    const d = iso.length >= 10 ? iso.slice(0, 10) : iso;
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
}

function toDateInput(v?: string | null): string {
    return v ? v.split('T')[0].split(' ')[0] : '';
}

function getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function VehiculoChip({ vehiculo }: { vehiculo: Vehiculo | null }) {
    if (!vehiculo) {
        return (
            <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Sin vehículo
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Car className="h-3 w-3" />
            <span className="font-mono font-bold uppercase tracking-wide">{vehiculo.patente}</span>
            <span className="font-normal text-indigo-600/80 dark:text-indigo-400/80">{vehiculo.marca} {vehiculo.modelo}</span>
        </span>
    );
}

/** Input de fecha que guarda inline (al perder foco) si cambió. */
function InlineDate({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
    const initial = toDateInput(value);
    const [local, setLocal] = useState(initial);
    useEffect(() => setLocal(toDateInput(value)), [value]);

    return (
        <Input
            type="date"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => { if (local && local !== initial) onSave(local); }}
            className={cn('h-8 w-[9.5rem] text-xs', className)}
        />
    );
}

function EventoRow({ e }: { e: ChoferEvento }) {
    const esAlta = e.tipo === 'alta';

    function save(fecha: string) {
        router.patch(`/historial/chofer-evento/${e.id}`, { fecha }, { preserveScroll: true, preserveState: true });
    }

    return (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                esAlta ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400',
            )}>
                {esAlta ? <UserPlus className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{e.chofer}</span>
                {e.chofer_dni && <span className="font-mono text-xs text-muted-foreground">DNI {e.chofer_dni}</span>}
            </div>
            <InlineDate value={e.fecha} onSave={save} />
        </div>
    );
}

function CambioRow({ c }: { c: Cambio }) {
    const inicioInit = toDateInput(c.fecha_inicio);
    const finInit = toDateInput(c.fecha_fin);
    const [inicio, setInicio] = useState(inicioInit);
    const [fin, setFin] = useState(finInit);

    useEffect(() => {
        setInicio(toDateInput(c.fecha_inicio));
        setFin(toDateInput(c.fecha_fin));
    }, [c.fecha_inicio, c.fecha_fin]);

    function save(nextInicio: string, nextFin: string) {
        if (!nextInicio) return;
        if (nextFin && nextFin < nextInicio) return; // guarda: fin no puede ser anterior al inicio
        router.patch(
            `/historial/asignacion/${c.id}`,
            { fecha_inicio: nextInicio, fecha_fin: nextFin || null },
            { preserveScroll: true, preserveState: true },
        );
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    {getInitials(c.conductor)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{c.conductor}</span>
                    <div className="flex flex-wrap items-center gap-2">
                        <VehiculoChip vehiculo={c.vehiculo_anterior} />
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <VehiculoChip vehiculo={c.vehiculo} />
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 items-end gap-3 pl-12 sm:pl-0">
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Inicio</Label>
                    <InlineDate value={c.fecha_inicio} onSave={(v) => { setInicio(v); save(v, fin); }} />
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fin</Label>
                    <InlineDate value={c.fecha_fin ?? ''} onSave={(v) => { setFin(v); save(inicio, v); }} />
                </div>
            </div>
        </div>
    );
}

type Vista = 'all' | 'alta' | 'baja' | 'cambio';

function VistaFiltro({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
    const opciones: { val: Vista; label: string; active: string }[] = [
        { val: 'all',    label: 'Todos',   active: 'border-primary/30 bg-primary/10 text-primary' },
        { val: 'alta',   label: 'Altas',   active: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' },
        { val: 'baja',   label: 'Bajas',   active: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400' },
        { val: 'cambio', label: 'Cambios', active: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' },
    ];
    return (
        <div className="flex flex-wrap gap-1.5">
            {opciones.map(({ val, label, active }) => (
                <button
                    key={val}
                    type="button"
                    onClick={() => onChange(val)}
                    className={cn(
                        'flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                        vista === val ? active : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

export default function HistorialIndex({ filters, eventos, cambios, choferes, stats }: Props) {
    const [from, setFrom] = useState(filters.from || '');
    const [to, setTo] = useState(filters.to || '');
    const [chofer, setChofer] = useState(filters.chofer || '');

    const isMounted = useRef(false);

    // Sincroniza filtros con la URL (debounce).
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        const hasChanges =
            from !== (filters.from || '') ||
            to !== (filters.to || '') ||
            chofer !== (filters.chofer || '');
        if (!hasChanges) return;

        const timeoutId = setTimeout(() => {
            const active: Record<string, string> = {};
            if (from) active.from = from;
            if (to) active.to = to;
            if (chofer) active.chofer = chofer;
            router.get('/historial', active, { preserveState: true, preserveScroll: true, replace: true });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [from, to, chofer, filters]);

    function clearFilters() {
        setFrom('');
        setTo('');
        setChofer('');
        router.get('/historial', {}, { preserveState: false, preserveScroll: true });
    }

    const hasActiveFilters = !!(from || to || chofer);

    const choferOptions: ComboboxOption[] = useMemo(
        () => choferes.map((c) => ({ value: String(c.id), label: c.name })),
        [choferes],
    );

    const altas = useMemo(() => eventos.filter((e) => e.tipo === 'alta'), [eventos]);
    const bajas = useMemo(() => eventos.filter((e) => e.tipo === 'baja'), [eventos]);

    const [vista, setVista] = useState<Vista>('all');

    return (
        <>
            <Head title="Historial" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-lg font-semibold text-foreground sm:text-xl">Historial</h1>
                    <p className="text-xs text-muted-foreground">
                        Ajustá las fechas de altas, bajas y cambios de vehículo. Los cambios se guardan automáticamente.
                    </p>
                </div>

                {/* Filtros */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="date">Rango de fechas</Label>
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
                                                ? formatDateRange(from)
                                                : `${formatDateRange(from)} - ${formatDateRange(to)}`
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
                                        isFilterMode
                                        showLegend={false}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="chofer">Chofer</Label>
                            <Combobox
                                id="chofer"
                                placeholder="Todos los choferes"
                                options={choferOptions}
                                value={chofer}
                                onSelect={(o) => setChofer(o.value)}
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

                {/* Stats */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <UserPlus className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-700 dark:text-green-400">Altas de choferes</span>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-foreground">{stats.altas}</span>
                    </div>
                    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <UserMinus className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-700 dark:text-red-400">Bajas de choferes</span>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-foreground">{stats.bajas}</span>
                    </div>
                    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <Car className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm text-indigo-700 dark:text-indigo-400">Cambios de vehículo</span>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-foreground">{stats.cambios}</span>
                    </div>
                </div>

                {/* Filtro de vista: todos / altas / bajas / cambios */}
                <VistaFiltro vista={vista} onChange={setVista} />

                {/* Altas */}
                {(vista === 'all' || vista === 'alta') && (
                <div className="flex flex-col gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <UserPlus className="h-4 w-4 text-green-500" />
                        Altas de choferes
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground tabular-nums">{altas.length}</span>
                    </h2>
                    {altas.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
                            Sin altas para los filtros aplicados.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {altas.map((e) => <EventoRow key={e.id} e={e} />)}
                        </div>
                    )}
                </div>
                )}

                {/* Bajas */}
                {(vista === 'all' || vista === 'baja') && (
                <div className="flex flex-col gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <UserMinus className="h-4 w-4 text-red-500" />
                        Bajas de choferes
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground tabular-nums">{bajas.length}</span>
                    </h2>
                    {bajas.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
                            Sin bajas para los filtros aplicados.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {bajas.map((e) => <EventoRow key={e.id} e={e} />)}
                        </div>
                    )}
                </div>
                )}

                {/* Cambios de vehículo */}
                {(vista === 'all' || vista === 'cambio') && (
                <div className="flex flex-col gap-3 pb-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Car className="h-4 w-4 text-indigo-500" />
                        Cambios de vehículo
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground tabular-nums">{cambios.length}</span>
                    </h2>
                    {cambios.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
                            Sin cambios de vehículo para los filtros aplicados.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {cambios.map((c) => <CambioRow key={c.id} c={c} />)}
                        </div>
                    )}
                </div>
                )}
            </div>
        </>
    );
}

HistorialIndex.layout = {
    breadcrumbs: [
        {
            title: 'Historial',
            href: '/historial',
        },
    ],
};
