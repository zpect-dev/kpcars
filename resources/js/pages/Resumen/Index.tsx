import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarIcon,
    ChevronDown,
    ChevronsUpDown,
    ChevronUp,
    Download,
    Scale,
    Search,
    TrendingDown,
    TrendingUp,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AppointmentCalendar } from '@/pages/Appointments/AppointmentCalendar';

interface Filters {
    desde: string;
    hasta: string;
    empresa_id: number | null;
    inversion_id: number | null;
    vehiculo_ids: number[];
    tipo: string | null;
    incluir_abierto: boolean;
}

interface FilaVehiculo {
    vehiculo_id: number;
    patente: string;
    marca: string | null;
    modelo: string | null;
    chofer_nombre: string | null;
    inversion_nombre: string | null;
    empresa_nombre: string | null;
    ingresos: number;
    gastos: number;
    repuestos: number;
    egresos: number;
    neto: number;
}

interface FilaTipo {
    tipo: string;
    label: string;
    total: number;
    porcentaje: number;
}

interface Resumen {
    totales: { ingresos: number; egresos: number; neto: number };
    abierto: { total: number; incluido: boolean };
    cierres_en_rango: number;
    por_vehiculo: FilaVehiculo[];
    por_tipo: FilaTipo[];
}

type SortVehiculoCol =
    | 'patente'
    | 'chofer'
    | 'inversion'
    | 'empresa'
    | 'ingresos'
    | 'gastos'
    | 'repuestos'
    | 'egresos'
    | 'neto';
type SortTipoCol = 'categoria' | 'total' | 'porcentaje';

interface Props {
    filters: Filters;
    resumen: Resumen;
    empresas: { id: number; nombre: string }[];
    inversiones: {
        id: number;
        nombre: string;
        empresa_nombre: string | null;
    }[];
    tipos: Record<string, string>;
}

function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

function formatDateRange(iso: string): string {
    const d = iso.length >= 10 ? iso.slice(0, 10) : iso;
    const [y, m, day] = d.split('-');

    return `${day}/${m}/${y}`;
}

function SortHeader<T extends string>({
    label,
    col,
    sortKey,
    sortDir,
    onSort,
    right = false,
}: {
    label: string;
    col: T;
    sortKey: T | null;
    sortDir: 'asc' | 'desc';
    onSort: (col: T) => void;
    right?: boolean;
}) {
    const active = sortKey === col;
    const Icon = active
        ? sortDir === 'asc'
            ? ChevronUp
            : ChevronDown
        : ChevronsUpDown;
    return (
        <th className={cn('px-3 py-2 font-medium', right && 'text-right')}>
            <button
                type="button"
                onClick={() => onSort(col)}
                className={cn(
                    'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                    right && 'w-full justify-end',
                    active ? 'text-foreground' : 'text-muted-foreground',
                )}
            >
                {label}
                <Icon className="h-3 w-3 shrink-0" />
            </button>
        </th>
    );
}

function StatCard({
    label,
    value,
    icon: Icon,
    negative = false,
}: {
    label: string;
    value: number;
    icon: typeof TrendingUp;
    negative?: boolean;
}) {
    return (
        <div className="flex items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <span
                className={cn(
                    'text-lg font-bold tabular-nums',
                    negative ? 'text-red-600' : 'text-foreground',
                )}
            >
                {formatARS(value)}
            </span>
        </div>
    );
}

export default function ResumenIndex({
    filters,
    resumen,
    empresas,
    inversiones,
    tipos,
}: Props) {
    const [desde, setDesde] = useState(filters.desde);
    const [hasta, setHasta] = useState(filters.hasta);
    const [empresaId, setEmpresaId] = useState(
        filters.empresa_id ? String(filters.empresa_id) : '',
    );
    const [inversionId, setInversionId] = useState(
        filters.inversion_id ? String(filters.inversion_id) : '',
    );
    const [tipo, setTipo] = useState(filters.tipo ?? '');
    const [incluirAbierto, setIncluirAbierto] = useState(
        filters.incluir_abierto,
    );

    // Búsqueda rápida (client-side) sobre las filas por vehículo ya cargadas:
    // filtra por patente o nombre de chofer, al estilo del buscador de una planilla.
    const [busquedaVehiculo, setBusquedaVehiculo] = useState('');

    // Selección de filas tildadas en las tablas (independiente de los
    // filtros): permite pedir un reporte de exactamente lo que se eligió,
    // al estilo "seleccionar filas y exportar" de una planilla de cálculo.
    const [selectedVehiculos, setSelectedVehiculos] = useState<Set<number>>(
        new Set(),
    );
    const [selectedTipos, setSelectedTipos] = useState<Set<string>>(new Set());

    // Si cambian los filtros (nuevos datos del servidor), la selección deja
    // de tener sentido: se limpia para no exportar filas que ya no se ven.
    useEffect(() => {
        setSelectedVehiculos(new Set());
        setSelectedTipos(new Set());
    }, [resumen]);

    function toggleVehiculo(id: number) {
        setSelectedVehiculos((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    // Selecciona/deselecciona sólo las filas visibles (respeta la búsqueda activa).
    function toggleAllVehiculos() {
        const visibleIds = sortedPorVehiculo.map((f) => f.vehiculo_id);
        setSelectedVehiculos((prev) => {
            const next = new Set(prev);
            if (visibleIds.every((id) => next.has(id))) {
                visibleIds.forEach((id) => next.delete(id));
            } else {
                visibleIds.forEach((id) => next.add(id));
            }
            return next;
        });
    }

    function toggleTipo(t: string) {
        setSelectedTipos((prev) => {
            const next = new Set(prev);
            if (next.has(t)) next.delete(t);
            else next.add(t);
            return next;
        });
    }

    function toggleAllTipos() {
        setSelectedTipos((prev) =>
            prev.size === resumen.por_tipo.length
                ? new Set()
                : new Set(resumen.por_tipo.map((t) => t.tipo)),
        );
    }

    function clearSelection() {
        setSelectedVehiculos(new Set());
        setSelectedTipos(new Set());
    }

    const seleccionVehiculo = useMemo(() => {
        const filas = resumen.por_vehiculo.filter((f) =>
            selectedVehiculos.has(f.vehiculo_id),
        );
        return {
            ingresos: filas.reduce((s, f) => s + f.ingresos, 0),
            egresos: filas.reduce((s, f) => s + f.egresos, 0),
            neto: filas.reduce((s, f) => s + f.neto, 0),
        };
    }, [resumen.por_vehiculo, selectedVehiculos]);

    const seleccionTipoTotal = useMemo(
        () =>
            resumen.por_tipo
                .filter((t) => selectedTipos.has(t.tipo))
                .reduce((s, t) => s + t.total, 0),
        [resumen.por_tipo, selectedTipos],
    );

    const totalSeleccionados = selectedVehiculos.size + selectedTipos.size;

    // Orden de las tablas (client-side, sobre las filas ya filtradas por el servidor).
    const [sortVehiculoKey, setSortVehiculoKey] =
        useState<SortVehiculoCol | null>(null);
    const [sortVehiculoDir, setSortVehiculoDir] = useState<'asc' | 'desc'>(
        'asc',
    );
    const [sortTipoKey, setSortTipoKey] = useState<SortTipoCol | null>(null);
    const [sortTipoDir, setSortTipoDir] = useState<'asc' | 'desc'>('asc');

    function toggleSortVehiculo(col: SortVehiculoCol) {
        if (sortVehiculoKey === col) {
            setSortVehiculoDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortVehiculoKey(col);
            setSortVehiculoDir(
                col === 'ingresos' ||
                    col === 'gastos' ||
                    col === 'repuestos' ||
                    col === 'egresos' ||
                    col === 'neto'
                    ? 'desc'
                    : 'asc',
            );
        }
    }

    function toggleSortTipo(col: SortTipoCol) {
        if (sortTipoKey === col) {
            setSortTipoDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortTipoKey(col);
            setSortTipoDir(col === 'categoria' ? 'asc' : 'desc');
        }
    }

    const sortedPorVehiculo = useMemo(() => {
        const q = busquedaVehiculo.trim().toLowerCase();
        const base = q
            ? resumen.por_vehiculo.filter(
                  (f) =>
                      f.patente.toLowerCase().includes(q) ||
                      (f.chofer_nombre ?? '').toLowerCase().includes(q),
              )
            : resumen.por_vehiculo;
        if (!sortVehiculoKey) return base;
        const dir = sortVehiculoDir === 'asc' ? 1 : -1;
        return [...base].sort((a, b) => {
            let cmp = 0;
            switch (sortVehiculoKey) {
                case 'patente':
                    cmp = a.patente.localeCompare(b.patente, 'es', {
                        numeric: true,
                    });
                    break;
                case 'chofer':
                    cmp = (a.chofer_nombre ?? '').localeCompare(
                        b.chofer_nombre ?? '',
                        'es',
                    );
                    break;
                case 'inversion':
                    cmp = (a.inversion_nombre ?? '').localeCompare(
                        b.inversion_nombre ?? '',
                        'es',
                        { numeric: true },
                    );
                    break;
                case 'empresa':
                    cmp = (a.empresa_nombre ?? '').localeCompare(
                        b.empresa_nombre ?? '',
                        'es',
                        { numeric: true },
                    );
                    break;
                case 'ingresos':
                    cmp = a.ingresos - b.ingresos;
                    break;
                case 'gastos':
                    cmp = a.gastos - b.gastos;
                    break;
                case 'repuestos':
                    cmp = a.repuestos - b.repuestos;
                    break;
                case 'egresos':
                    cmp = a.egresos - b.egresos;
                    break;
                case 'neto':
                    cmp = a.neto - b.neto;
                    break;
            }
            return cmp * dir;
        });
    }, [
        resumen.por_vehiculo,
        sortVehiculoKey,
        sortVehiculoDir,
        busquedaVehiculo,
    ]);

    // Estado del "seleccionar todos" referido a las filas visibles (post-búsqueda).
    const visibleVehiculoIds = useMemo(
        () => sortedPorVehiculo.map((f) => f.vehiculo_id),
        [sortedPorVehiculo],
    );
    const allVisibleSelected =
        visibleVehiculoIds.length > 0 &&
        visibleVehiculoIds.every((id) => selectedVehiculos.has(id));
    const someVisibleSelected = visibleVehiculoIds.some((id) =>
        selectedVehiculos.has(id),
    );

    const sortedPorTipo = useMemo(() => {
        if (!sortTipoKey) return resumen.por_tipo;
        const dir = sortTipoDir === 'asc' ? 1 : -1;
        return [...resumen.por_tipo].sort((a, b) => {
            let cmp = 0;
            switch (sortTipoKey) {
                case 'categoria':
                    cmp = a.label.localeCompare(b.label, 'es');
                    break;
                case 'total':
                    cmp = a.total - b.total;
                    break;
                case 'porcentaje':
                    cmp = a.porcentaje - b.porcentaje;
                    break;
            }
            return cmp * dir;
        });
    }, [resumen.por_tipo, sortTipoKey, sortTipoDir]);

    const isMounted = useRef(false);

    // Sincroniza filtros con la URL (debounce), como en Historial.
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;

            return;
        }

        const serverState = JSON.stringify({
            desde: filters.desde,
            hasta: filters.hasta,
            empresa: filters.empresa_id ? String(filters.empresa_id) : '',
            inversion: filters.inversion_id ? String(filters.inversion_id) : '',
            tipo: filters.tipo ?? '',
            abierto: filters.incluir_abierto,
        });
        const localState = JSON.stringify({
            desde,
            hasta,
            empresa: empresaId,
            inversion: inversionId,
            tipo,
            abierto: incluirAbierto,
        });

        if (serverState === localState) {
            return;
        }

        if (!desde || !hasta || hasta < desde) {
            return;
        }

        const timeoutId = setTimeout(() => {
            const params: Record<string, string | number | string[]> = {
                desde,
                hasta,
            };

            if (empresaId) {
                params.empresa_id = empresaId;
            }

            if (inversionId) {
                params.inversion_id = inversionId;
            }

            if (tipo) {
                params.tipo = tipo;
            }

            if (incluirAbierto) {
                params.incluir_abierto = 1;
            }

            router.get('/resumen', params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 350);

        return () => clearTimeout(timeoutId);
    }, [desde, hasta, empresaId, inversionId, tipo, incluirAbierto, filters]);

    function clearFilters() {
        setEmpresaId('');
        setInversionId('');
        setTipo('');
        setIncluirAbierto(false);
        router.get(
            '/resumen',
            { desde, hasta },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    const hasActiveFilters = !!(
        empresaId ||
        inversionId ||
        tipo ||
        incluirAbierto
    );

    // Query string para las exportaciones: exactamente los filtros vigentes.
    const exportQs = useMemo(() => {
        const p = new URLSearchParams({ desde, hasta });

        if (empresaId) {
            p.set('empresa_id', empresaId);
        }

        if (inversionId) {
            p.set('inversion_id', inversionId);
        }

        if (tipo) {
            p.set('tipo', tipo);
        }

        if (incluirAbierto) {
            p.set('incluir_abierto', '1');
        }

        return p.toString();
    }, [desde, hasta, empresaId, inversionId, tipo, incluirAbierto]);

    // Igual que exportQs, pero agregando la selección tildada: el backend
    // recorta el reporte a exactamente esas filas.
    const selectionExportQs = useMemo(() => {
        const p = new URLSearchParams(exportQs);
        selectedVehiculos.forEach((id) =>
            p.append('sel_vehiculo_ids[]', String(id)),
        );
        selectedTipos.forEach((t) => p.append('sel_tipos[]', t));
        return p.toString();
    }, [exportQs, selectedVehiculos, selectedTipos]);

    const filtroFlota = !!inversionId;

    return (
        <>
            <Head title="Resumen" />

            <div
                className={cn(
                    'flex h-full flex-1 flex-col gap-4 p-4',
                    totalSeleccionados > 0 && 'pb-24',
                )}
            >
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                            Resumen
                        </h1>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Ingresos por recaudaciones cerradas y egresos por
                            gastos, según los filtros aplicados.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={`/pdf/resumen?${exportQs}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">PDF</span>
                        </a>
                        <a
                            href={`/excel/resumen?${exportQs}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Excel</span>
                        </a>
                    </div>
                </div>

                {/* Filtros */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="rango">Rango de fechas</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="rango"
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !desde &&
                                                !hasta &&
                                                'text-muted-foreground',
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {desde && hasta ? (
                                            desde === hasta ? (
                                                formatDateRange(desde)
                                            ) : (
                                                `${formatDateRange(desde)} - ${formatDateRange(hasta)}`
                                            )
                                        ) : (
                                            <span>Seleccionar rango</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-auto p-0"
                                    align="start"
                                >
                                    <AppointmentCalendar
                                        mode="range"
                                        rangeValue={{ from: desde, to: hasta }}
                                        onRangeChange={(range) => {
                                            setDesde(range.from);
                                            setHasta(range.to);
                                        }}
                                        title={null}
                                        className="border-0 bg-popover"
                                        isFilterMode
                                        showLegend={false}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="empresa">Empresa</Label>
                            <Select
                                value={empresaId || 'all'}
                                onValueChange={(v) =>
                                    setEmpresaId(v === 'all' ? '' : v)
                                }
                            >
                                <SelectTrigger id="empresa" className="w-full">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {empresas.map((e) => (
                                        <SelectItem
                                            key={e.id}
                                            value={String(e.id)}
                                        >
                                            {e.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="inversion">Inversión</Label>
                            <Select
                                value={inversionId || 'all'}
                                onValueChange={(v) =>
                                    setInversionId(v === 'all' ? '' : v)
                                }
                            >
                                <SelectTrigger
                                    id="inversion"
                                    className="w-full"
                                >
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {inversiones.map((i) => (
                                        <SelectItem
                                            key={i.id}
                                            value={String(i.id)}
                                        >
                                            {i.empresa_nombre
                                                ? `${i.nombre} — ${i.empresa_nombre}`
                                                : i.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="tipo">Categoría (egresos)</Label>
                            <Select
                                value={tipo || 'all'}
                                onValueChange={(v) =>
                                    setTipo(v === 'all' ? '' : v)
                                }
                            >
                                <SelectTrigger id="tipo" className="w-full">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {Object.entries(tipos).map(
                                        ([value, label]) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                                checked={incluirAbierto}
                                onCheckedChange={(v) =>
                                    setIncluirAbierto(v === true)
                                }
                            />
                            Incluir período de recaudación en curso
                        </label>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* Cards de totales */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatCard
                        label="Ingresos"
                        value={resumen.totales.ingresos}
                        icon={TrendingUp}
                    />
                    <StatCard
                        label="Egresos"
                        value={resumen.totales.egresos}
                        icon={TrendingDown}
                    />
                    <StatCard
                        label="Neto"
                        value={resumen.totales.neto}
                        icon={Scale}
                        negative={resumen.totales.neto < 0}
                    />
                </div>

                <p className="text-xs text-muted-foreground">
                    {resumen.cierres_en_rango}{' '}
                    {resumen.cierres_en_rango === 1
                        ? 'cierre de recaudación'
                        : 'cierres de recaudación'}{' '}
                    dentro del rango. Los ingresos se atribuyen por la fecha del
                    cierre del período.
                    {resumen.abierto.total > 0 && !resumen.abierto.incluido && (
                        <>
                            {' '}
                            Hay {formatARS(resumen.abierto.total)} recaudados en
                            el período en curso que no están incluidos.
                        </>
                    )}
                    {resumen.abierto.total > 0 && resumen.abierto.incluido && (
                        <>
                            {' '}
                            Incluye {formatARS(resumen.abierto.total)} del
                            período en curso (sin cierre).
                        </>
                    )}
                </p>

                {/* Por vehículo */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-sm font-semibold text-foreground">
                            Por vehículo
                        </h2>
                        {resumen.por_vehiculo.length > 0 && (
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    value={busquedaVehiculo}
                                    onChange={(e) =>
                                        setBusquedaVehiculo(e.target.value)
                                    }
                                    placeholder="Buscar por patente o chofer…"
                                    className="pl-8"
                                />
                            </div>
                        )}
                    </div>
                    {resumen.por_vehiculo.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
                            Sin movimientos por vehículo para los filtros
                            aplicados.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                                    <tr>
                                        <th className="w-8 px-3 py-2">
                                            <Checkbox
                                                aria-label="Seleccionar todos los vehículos"
                                                checked={
                                                    allVisibleSelected
                                                        ? true
                                                        : someVisibleSelected
                                                          ? 'indeterminate'
                                                          : false
                                                }
                                                onCheckedChange={
                                                    toggleAllVehiculos
                                                }
                                            />
                                        </th>
                                        <SortHeader
                                            label="Patente"
                                            col="patente"
                                            sortKey={sortVehiculoKey}
                                            sortDir={sortVehiculoDir}
                                            onSort={toggleSortVehiculo}
                                        />
                                        <SortHeader
                                            label="Chofer"
                                            col="chofer"
                                            sortKey={sortVehiculoKey}
                                            sortDir={sortVehiculoDir}
                                            onSort={toggleSortVehiculo}
                                        />
                                        <SortHeader
                                            label="Inversión"
                                            col="inversion"
                                            sortKey={sortVehiculoKey}
                                            sortDir={sortVehiculoDir}
                                            onSort={toggleSortVehiculo}
                                        />
                                        <SortHeader
                                            label="Empresa"
                                            col="empresa"
                                            sortKey={sortVehiculoKey}
                                            sortDir={sortVehiculoDir}
                                            onSort={toggleSortVehiculo}
                                        />
                                        <SortHeader
                                            label="Ingresos"
                                            col="ingresos"
                                            sortKey={sortVehiculoKey}
                                            sortDir={sortVehiculoDir}
                                            onSort={toggleSortVehiculo}
                                            right
                                        />
                                        <SortHeader
                                            label="Gastos"
                                            col="gastos"
                                            sortKey={sortVehiculoKey}
                                            sortDir={sortVehiculoDir}
                                            onSort={toggleSortVehiculo}
                                            right
                                        />
                                        <SortHeader
                                            label="Repuestos"
                                            col="repuestos"
                                            sortKey={sortVehiculoKey}
                                            sortDir={sortVehiculoDir}
                                            onSort={toggleSortVehiculo}
                                            right
                                        />
                                        <SortHeader
                                            label="Egresos"
                                            col="egresos"
                                            sortKey={sortVehiculoKey}
                                            sortDir={sortVehiculoDir}
                                            onSort={toggleSortVehiculo}
                                            right
                                        />
                                        <SortHeader
                                            label="Neto"
                                            col="neto"
                                            sortKey={sortVehiculoKey}
                                            sortDir={sortVehiculoDir}
                                            onSort={toggleSortVehiculo}
                                            right
                                        />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {sortedPorVehiculo.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={10}
                                                className="px-3 py-8 text-center text-sm text-muted-foreground"
                                            >
                                                Sin resultados para «
                                                {busquedaVehiculo}».
                                            </td>
                                        </tr>
                                    )}
                                    {sortedPorVehiculo.map((f) => (
                                        <tr
                                            key={f.vehiculo_id}
                                            className={cn(
                                                'hover:bg-muted/20',
                                                selectedVehiculos.has(
                                                    f.vehiculo_id,
                                                ) &&
                                                    'bg-primary/5 hover:bg-primary/10',
                                            )}
                                        >
                                            <td className="px-3 py-2">
                                                <Checkbox
                                                    aria-label={`Seleccionar ${f.patente}`}
                                                    checked={selectedVehiculos.has(
                                                        f.vehiculo_id,
                                                    )}
                                                    onCheckedChange={() =>
                                                        toggleVehiculo(
                                                            f.vehiculo_id,
                                                        )
                                                    }
                                                />
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs font-semibold whitespace-nowrap uppercase">
                                                <Link
                                                    href={`/resumen/vehiculo/${f.vehiculo_id}?${exportQs}`}
                                                    className="text-primary underline-offset-2 hover:underline"
                                                    title="Ver detalle de ingresos y egresos"
                                                >
                                                    {f.patente}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-foreground">
                                                {f.chofer_nombre ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-foreground">
                                                {f.inversion_nombre ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                                {f.empresa_nombre ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap text-foreground tabular-nums">
                                                {formatARS(f.ingresos)}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                                                {formatARS(f.gastos)}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                                                {formatARS(f.repuestos)}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap text-foreground tabular-nums">
                                                {formatARS(f.egresos)}
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-3 py-2 text-right font-bold whitespace-nowrap tabular-nums',
                                                    f.neto < 0
                                                        ? 'text-red-600'
                                                        : 'text-foreground',
                                                )}
                                            >
                                                {formatARS(f.neto)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                        El egreso de cada vehículo suma sus gastos propios más
                        los repuestos que se le colocaron desde inventario,
                        valuados a precio de venta.
                        {!filtroFlota &&
                            ' Los gastos de galpón no se reparten por vehículo: cuentan en los totales y en el desglose por categoría.'}
                    </p>
                </div>

                {/* Por tipo de gasto */}
                <div className="flex flex-col gap-3 pb-4">
                    <h2 className="text-sm font-semibold text-foreground">
                        Egresos por categoría
                    </h2>
                    {resumen.por_tipo.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
                            Sin egresos para los filtros aplicados.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                                    <tr>
                                        <th className="w-8 px-3 py-2">
                                            <Checkbox
                                                aria-label="Seleccionar todas las categorías"
                                                checked={
                                                    selectedTipos.size === 0
                                                        ? false
                                                        : selectedTipos.size ===
                                                            resumen.por_tipo
                                                                .length
                                                          ? true
                                                          : 'indeterminate'
                                                }
                                                onCheckedChange={toggleAllTipos}
                                            />
                                        </th>
                                        <SortHeader
                                            label="Categoría"
                                            col="categoria"
                                            sortKey={sortTipoKey}
                                            sortDir={sortTipoDir}
                                            onSort={toggleSortTipo}
                                        />
                                        <SortHeader
                                            label="Monto"
                                            col="total"
                                            sortKey={sortTipoKey}
                                            sortDir={sortTipoDir}
                                            onSort={toggleSortTipo}
                                            right
                                        />
                                        <SortHeader
                                            label="% del total"
                                            col="porcentaje"
                                            sortKey={sortTipoKey}
                                            sortDir={sortTipoDir}
                                            onSort={toggleSortTipo}
                                            right
                                        />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {sortedPorTipo.map((t) => (
                                        <tr
                                            key={t.tipo}
                                            className={cn(
                                                'hover:bg-muted/20',
                                                selectedTipos.has(t.tipo) &&
                                                    'bg-primary/5 hover:bg-primary/10',
                                            )}
                                        >
                                            <td className="px-3 py-2">
                                                <Checkbox
                                                    aria-label={`Seleccionar ${t.label}`}
                                                    checked={selectedTipos.has(
                                                        t.tipo,
                                                    )}
                                                    onCheckedChange={() =>
                                                        toggleTipo(t.tipo)
                                                    }
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-foreground">
                                                {t.label}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap text-foreground tabular-nums">
                                                {formatARS(t.total)}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                                                {t.porcentaje.toLocaleString(
                                                    'es-AR',
                                                )}
                                                %
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Barra flotante: aparece con selección activa, para pedir el reporte de exactamente lo tildado */}
            {totalSeleccionados > 0 && (
                <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
                        <span className="text-sm font-medium text-foreground">
                            {selectedVehiculos.size > 0 && (
                                <>
                                    {selectedVehiculos.size}{' '}
                                    {selectedVehiculos.size === 1
                                        ? 'vehículo'
                                        : 'vehículos'}
                                </>
                            )}
                            {selectedVehiculos.size > 0 &&
                                selectedTipos.size > 0 &&
                                ' y '}
                            {selectedTipos.size > 0 && (
                                <>
                                    {selectedTipos.size}{' '}
                                    {selectedTipos.size === 1
                                        ? 'categoría'
                                        : 'categorías'}
                                </>
                            )}
                            {' seleccionados'}
                        </span>

                        {selectedVehiculos.size > 0 && (
                            <span
                                className={cn(
                                    'text-sm font-bold tabular-nums',
                                    seleccionVehiculo.neto < 0
                                        ? 'text-red-600'
                                        : 'text-foreground',
                                )}
                            >
                                Neto: {formatARS(seleccionVehiculo.neto)}
                            </span>
                        )}
                        {selectedTipos.size > 0 && (
                            <span className="text-sm font-bold text-foreground tabular-nums">
                                Categorías: {formatARS(seleccionTipoTotal)}
                            </span>
                        )}

                        <div className="h-5 w-px bg-border" />

                        <a
                            href={`/pdf/resumen?${selectionExportQs}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                        </a>
                        <a
                            href={`/excel/resumen?${selectionExportQs}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Excel
                        </a>
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                            Limpiar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

ResumenIndex.layout = {
    breadcrumbs: [
        {
            title: 'Resumen',
            href: '/resumen',
        },
    ],
};
