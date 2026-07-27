import { Head, router } from '@inertiajs/react';
import { CalendarIcon, Download, Scale, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
    inversion_nombre: string | null;
    empresa_nombre: string | null;
    ingresos: number;
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

interface Props {
    filters: Filters;
    resumen: Resumen;
    empresas: { id: number; nombre: string }[];
    inversiones: { id: number; nombre: string; empresa_nombre: string | null }[];
    vehiculos: { id: number; patente: string; marca: string | null; modelo: string | null }[];
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

export default function ResumenIndex({ filters, resumen, empresas, inversiones, vehiculos, tipos }: Props) {
    const [desde, setDesde] = useState(filters.desde);
    const [hasta, setHasta] = useState(filters.hasta);
    const [empresaId, setEmpresaId] = useState(filters.empresa_id ? String(filters.empresa_id) : '');
    const [inversionId, setInversionId] = useState(filters.inversion_id ? String(filters.inversion_id) : '');
    const [vehiculoIds, setVehiculoIds] = useState<string[]>(filters.vehiculo_ids.map(String));
    const [tipo, setTipo] = useState(filters.tipo ?? '');
    const [incluirAbierto, setIncluirAbierto] = useState(filters.incluir_abierto);

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
            vehiculos: filters.vehiculo_ids.map(String),
            tipo: filters.tipo ?? '',
            abierto: filters.incluir_abierto,
        });
        const localState = JSON.stringify({
            desde,
            hasta,
            empresa: empresaId,
            inversion: inversionId,
            vehiculos: vehiculoIds,
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
            const params: Record<string, string | number | string[]> = { desde, hasta };

            if (empresaId) {
                params.empresa_id = empresaId;
            }

            if (inversionId) {
                params.inversion_id = inversionId;
            }

            if (vehiculoIds.length) {
                params.vehiculo_ids = vehiculoIds;
            }

            if (tipo) {
                params.tipo = tipo;
            }

            if (incluirAbierto) {
                params.incluir_abierto = 1;
            }

            router.get('/resumen', params, { preserveState: true, preserveScroll: true, replace: true });
        }, 350);

        return () => clearTimeout(timeoutId);
    }, [desde, hasta, empresaId, inversionId, vehiculoIds, tipo, incluirAbierto, filters]);

    function clearFilters() {
        setEmpresaId('');
        setInversionId('');
        setVehiculoIds([]);
        setTipo('');
        setIncluirAbierto(false);
        router.get('/resumen', { desde, hasta }, { preserveState: true, preserveScroll: true, replace: true });
    }

    const hasActiveFilters = !!(empresaId || inversionId || vehiculoIds.length || tipo || incluirAbierto);

    // Query string para las exportaciones: exactamente los filtros vigentes.
    const exportQs = useMemo(() => {
        const p = new URLSearchParams({ desde, hasta });

        if (empresaId) {
            p.set('empresa_id', empresaId);
        }

        if (inversionId) {
            p.set('inversion_id', inversionId);
        }

        vehiculoIds.forEach((id) => p.append('vehiculo_ids[]', id));

        if (tipo) {
            p.set('tipo', tipo);
        }

        if (incluirAbierto) {
            p.set('incluir_abierto', '1');
        }

        return p.toString();
    }, [desde, hasta, empresaId, inversionId, vehiculoIds, tipo, incluirAbierto]);

    const vehiculoOptions: ComboboxOption[] = useMemo(
        () =>
            vehiculos
                .filter((v) => !vehiculoIds.includes(String(v.id)))
                .map((v) => ({
                    value: String(v.id),
                    label: v.patente,
                    sub: [v.marca, v.modelo].filter(Boolean).join(' '),
                })),
        [vehiculos, vehiculoIds],
    );

    const patenteById = useMemo(() => {
        const map = new Map<string, string>();
        vehiculos.forEach((v) => map.set(String(v.id), v.patente));

        return map;
    }, [vehiculos]);

    const filtroFlota = !!(inversionId || vehiculoIds.length);

    return (
        <>
            <Head title="Resumen" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">Resumen</h1>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Ingresos por recaudaciones cerradas y egresos por gastos, según los filtros aplicados.
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="rango">Rango de fechas</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="rango"
                                        variant="outline"
                                        className={cn('w-full justify-start text-left font-normal', !desde && !hasta && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {desde && hasta
                                            ? desde === hasta
                                                ? formatDateRange(desde)
                                                : `${formatDateRange(desde)} - ${formatDateRange(hasta)}`
                                            : <span>Seleccionar rango</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
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
                            <Select value={empresaId || 'all'} onValueChange={(v) => setEmpresaId(v === 'all' ? '' : v)}>
                                <SelectTrigger id="empresa" className="w-full">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {empresas.map((e) => (
                                        <SelectItem key={e.id} value={String(e.id)}>
                                            {e.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="inversion">Inversión</Label>
                            <Select value={inversionId || 'all'} onValueChange={(v) => setInversionId(v === 'all' ? '' : v)}>
                                <SelectTrigger id="inversion" className="w-full">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {inversiones.map((i) => (
                                        <SelectItem key={i.id} value={String(i.id)}>
                                            {i.empresa_nombre ? `${i.nombre} — ${i.empresa_nombre}` : i.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="tipo">Tipo de gasto (egresos)</Label>
                            <Select value={tipo || 'all'} onValueChange={(v) => setTipo(v === 'all' ? '' : v)}>
                                <SelectTrigger id="tipo" className="w-full">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {Object.entries(tipos).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="vehiculos">Vehículos</Label>
                            <Combobox
                                key={vehiculoIds.length}
                                id="vehiculos"
                                placeholder="Agregar patente…"
                                options={vehiculoOptions}
                                value=""
                                uppercase
                                onSelect={(o) => setVehiculoIds((prev) => (prev.includes(o.value) ? prev : [...prev, o.value]))}
                            />
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {vehiculoIds.map((id) => (
                            <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-foreground"
                            >
                                {patenteById.get(id) ?? id}
                                <button
                                    type="button"
                                    aria-label={`Quitar ${patenteById.get(id) ?? id}`}
                                    onClick={() => setVehiculoIds((prev) => prev.filter((v) => v !== id))}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}

                        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                                checked={incluirAbierto}
                                onCheckedChange={(v) => setIncluirAbierto(v === true)}
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
                    <StatCard label="Ingresos" value={resumen.totales.ingresos} icon={TrendingUp} />
                    <StatCard label="Egresos" value={resumen.totales.egresos} icon={TrendingDown} />
                    <StatCard label="Neto" value={resumen.totales.neto} icon={Scale} negative={resumen.totales.neto < 0} />
                </div>

                <p className="text-xs text-muted-foreground">
                    {resumen.cierres_en_rango} {resumen.cierres_en_rango === 1 ? 'cierre de recaudación' : 'cierres de recaudación'} dentro del rango.
                    Los ingresos se atribuyen por la fecha del cierre del período.
                    {resumen.abierto.total > 0 && !resumen.abierto.incluido && (
                        <> Hay {formatARS(resumen.abierto.total)} recaudados en el período en curso que no están incluidos.</>
                    )}
                    {resumen.abierto.total > 0 && resumen.abierto.incluido && (
                        <> Incluye {formatARS(resumen.abierto.total)} del período en curso (sin cierre).</>
                    )}
                </p>

                {/* Por vehículo */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-foreground">Por vehículo</h2>
                    {resumen.por_vehiculo.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
                            Sin movimientos por vehículo para los filtros aplicados.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Patente</th>
                                        <th className="px-3 py-2 font-medium">Vehículo</th>
                                        <th className="px-3 py-2 font-medium">Inversión</th>
                                        <th className="px-3 py-2 font-medium">Empresa</th>
                                        <th className="px-3 py-2 text-right font-medium">Ingresos</th>
                                        <th className="px-3 py-2 text-right font-medium">Egresos</th>
                                        <th className="px-3 py-2 text-right font-medium">Neto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {resumen.por_vehiculo.map((f) => (
                                        <tr key={f.vehiculo_id} className="hover:bg-muted/20">
                                            <td className="px-3 py-2 font-mono text-xs font-semibold uppercase whitespace-nowrap text-foreground">
                                                {f.patente}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-foreground">
                                                {[f.marca, f.modelo].filter(Boolean).join(' ') || '—'}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-foreground">{f.inversion_nombre ?? '—'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{f.empresa_nombre ?? '—'}</td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-foreground">
                                                {formatARS(f.ingresos)}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-foreground">
                                                {formatARS(f.egresos)}
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-3 py-2 text-right font-bold whitespace-nowrap tabular-nums',
                                                    f.neto < 0 ? 'text-red-600' : 'text-foreground',
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
                    {!filtroFlota && (
                        <p className="text-xs text-muted-foreground">
                            Los egresos por vehículo incluyen sólo gastos directos de flota; los gastos globales (galpón, taller,
                            oficina, Kevin, stock) cuentan en los totales y en el desglose por tipo.
                        </p>
                    )}
                </div>

                {/* Por tipo de gasto */}
                <div className="flex flex-col gap-3 pb-4">
                    <h2 className="text-sm font-semibold text-foreground">Egresos por tipo de gasto</h2>
                    {resumen.por_tipo.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground shadow-sm">
                            Sin egresos para los filtros aplicados.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Tipo</th>
                                        <th className="px-3 py-2 text-right font-medium">Monto</th>
                                        <th className="px-3 py-2 text-right font-medium">% del total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {resumen.por_tipo.map((t) => (
                                        <tr key={t.tipo} className="hover:bg-muted/20">
                                            <td className="px-3 py-2 text-foreground">{t.label}</td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-foreground">
                                                {formatARS(t.total)}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                                                {t.porcentaje.toLocaleString('es-AR')}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
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
