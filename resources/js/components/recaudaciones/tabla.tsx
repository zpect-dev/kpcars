import { ChevronDown, ChevronUp, ChevronsUpDown, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/app/empty-state';
import { FilterBar, FilterField, SearchInput } from '@/components/app/filter-bar';
import { MoneyInput } from '@/components/money-input';
import {
    ChoferPopover,
    ChoferTrigger,
} from '@/components/recaudaciones/chofer-popover';
import { EstadoBadge } from '@/components/recaudaciones/estado-badge';
import { formatARS } from '@/components/recaudaciones/format';
import { clasificarMetodo, METODO_LABEL } from '@/components/recaudaciones/metodo';
import type { MetodoFiltro, MetodoPago } from '@/components/recaudaciones/metodo';
import { RecaudacionStats } from '@/components/recaudaciones/stats';
import { useRecaudacionForm } from '@/components/recaudaciones/use-recaudacion-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RecaudacionFila } from '@/types';

type SortCol = 'chofer' | 'inversion' | 'total' | 'estado';

function SortHeader({
    label,
    col,
    sortKey,
    sortDir,
    onSort,
    className,
}: {
    label: string;
    col: SortCol;
    sortKey: SortCol | null;
    sortDir: 'asc' | 'desc';
    onSort: (col: SortCol) => void;
    className?: string;
}) {
    const active = sortKey === col;
    const Icon = active
        ? sortDir === 'asc'
            ? ChevronUp
            : ChevronDown
        : ChevronsUpDown;

    return (
        <th className={cn('px-3 py-3 font-medium tracking-wider', className)}>
            <button
                type="button"
                onClick={() => onSort(col)}
                aria-label={
                    active
                        ? sortDir === 'asc'
                            ? `${label}: orden ascendente. Cambiar a descendente.`
                            : `${label}: orden descendente. Cambiar a ascendente.`
                        : `Ordenar por ${label}`
                }
                className={cn(
                    'inline-flex items-center gap-1 rounded transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'text-foreground' : 'text-muted-foreground',
                )}
            >
                {label}
                <Icon aria-hidden="true" className="size-3 shrink-0" />
            </button>
        </th>
    );
}

const ESTADOS = [
    { val: 'all', label: 'Todos' },
    { val: 'deuda', label: 'Deben' },
    { val: 'pagado', label: 'Pagados' },
] as const;

const ESTADO_ACTIVO: Record<(typeof ESTADOS)[number]['val'], string> = {
    all: 'border-primary/30 bg-primary/10 text-primary',
    deuda: 'border-destructive/30 bg-destructive-soft text-destructive-soft-foreground',
    pagado: 'border-success/30 bg-success-soft text-success-soft-foreground',
};

interface RecaudacionesTablaProps {
    filas: RecaudacionFila[];
    editable: boolean;
    endpoint: (fila: RecaudacionFila) => string;
    emptyMessage?: string;
    /** Reporta los filtros activos al padre, para exportar según la vista actual. */
    onFiltrosChange?: (f: { q: string; estado: string; metodo: string }) => void;
}

/**
 * Buscador inicial: se toma del query `?q=` para que sobreviva al cambio de
 * empresa (el switch hace redirect()->back() a la misma URL con su query).
 */
function initialSearch(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    return new URLSearchParams(window.location.search).get('q') ?? '';
}

export function RecaudacionesTabla({
    filas,
    editable,
    endpoint,
    emptyMessage,
    onFiltrosChange,
}: RecaudacionesTablaProps) {
    const [search, setSearch] = useState(initialSearch);
    const [estadoFiltro, setEstadoFiltro] = useState<'all' | 'pagado' | 'deuda'>('all');
    const [metodoFiltro, setMetodoFiltro] = useState<MetodoFiltro>('all');
    const [sortKey, setSortKey] = useState<SortCol | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Informar al padre los filtros activos para que las exportaciones respeten
    // la vista actual.
    useEffect(() => {
        onFiltrosChange?.({ q: search, estado: estadoFiltro, metodo: metodoFiltro });
    }, [search, estadoFiltro, metodoFiltro, onFiltrosChange]);

    // Reflejar el buscador en la URL (sin recargar) para conservarlo al cambiar
    // de empresa u otras navegaciones que vuelvan a esta página.
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const params = new URLSearchParams(window.location.search);

        if (search.trim()) {
            params.set('q', search);
        } else {
            params.delete('q');
        }

        const qs = params.toString();
        const url =
            window.location.pathname +
            (qs ? `?${qs}` : '') +
            window.location.hash;
        window.history.replaceState(window.history.state, '', url);
    }, [search]);

    function toggleSort(key: SortCol) {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir(key === 'total' ? 'desc' : 'asc');
        }
    }

    /** Cambiar el estado desde los botones resetea el filtro de método. */
    function cambiarEstado(val: 'all' | 'pagado' | 'deuda') {
        setEstadoFiltro(val);
        setMetodoFiltro('all');
    }

    /**
     * Click en una fila del desglose: filtra por estado + método. Si ya estaba
     * activo ese mismo par, se limpia.
     */
    function seleccionarMetodo(estado: 'pagado' | 'deuda', metodo: MetodoPago) {
        if (estadoFiltro === estado && metodoFiltro === metodo) {
            setEstadoFiltro('all');
            setMetodoFiltro('all');
        } else {
            setEstadoFiltro(estado);
            setMetodoFiltro(metodo);
        }
    }

    const hayFiltros =
        search.trim() !== '' || estadoFiltro !== 'all' || metodoFiltro !== 'all';

    function limpiarFiltros() {
        setSearch('');
        setEstadoFiltro('all');
        setMetodoFiltro('all');
    }

    const filtradas = useMemo(() => {
        const q = search.toLowerCase().trim();
        let result = filas.filter((f) => {
            if (estadoFiltro !== 'all' && f.estado !== estadoFiltro) {
                return false;
            }

            if (metodoFiltro !== 'all' && clasificarMetodo(f) !== metodoFiltro) {
                return false;
            }

            if (q) {
                return (
                    f.patente.toLowerCase().includes(q) ||
                    f.chofer.toLowerCase().includes(q)
                );
            }

            return true;
        });

        if (sortKey) {
            result = [...result].sort((a, b) => {
                let cmp = 0;

                if (sortKey === 'chofer') {
                    cmp = a.chofer.localeCompare(b.chofer, 'es');
                }

                if (sortKey === 'inversion') {
                    cmp = a.inversion_nombre.localeCompare(
                        b.inversion_nombre,
                        'es',
                        { numeric: true },
                    );
                }

                if (sortKey === 'total') {
                    cmp = Number(a.total) - Number(b.total);
                }

                if (sortKey === 'estado') {
                    cmp = a.estado.localeCompare(b.estado);
                }

                return sortDir === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [filas, search, estadoFiltro, metodoFiltro, sortKey, sortDir]);

    /**
     * Los stats se calculan SIEMPRE sobre el set completo, no sobre lo
     * filtrado: la búsqueda y los filtros de estado no deben recalcular las
     * cifras del período.
     */
    const stats = useMemo(
        () => ({
            total: filas.reduce((s, f) => s + Number(f.total), 0),
            efectivo: filas.reduce((s, f) => s + Number(f.efectivo), 0),
            transferencia: filas.reduce(
                (s, f) => s + Number(f.transferencia),
                0,
            ),
            pagados: filas.filter((f) => f.estado === 'pagado').length,
            deudores: filas.filter((f) => f.estado === 'deuda').length,
            totalDeuda: filas.reduce((s, f) => s + Number(f.deuda), 0),
        }),
        [filas],
    );

    const metodoBreakdown = useMemo(() => {
        const vacio = (): Record<MetodoPago, number> => ({
            efectivo: 0,
            transferencia: 0,
            mixto: 0,
        });
        const pagado = vacio();
        const deuda = vacio();

        for (const f of filas) {
            const m = clasificarMetodo(f);

            if (!m) {
                continue;
            }

            (f.estado === 'pagado' ? pagado : deuda)[m]++;
        }

        return { pagado, deuda };
    }, [filas]);

    return (
        <div className="flex flex-col gap-4">
            <FilterBar
                hasActiveFilters={hayFiltros}
                onClear={limpiarFiltros}
                gridClassName="lg:grid-cols-[minmax(240px,1fr)_auto_auto_auto]"
            >
                <FilterField label="Buscar" htmlFor="rec-search">
                    <SearchInput
                        id="rec-search"
                        value={search}
                        onChange={setSearch}
                        placeholder="Patente o chofer..."
                    />
                </FilterField>

                <FilterField label="Estado">
                    <div className="flex h-9 gap-1.5">
                        {ESTADOS.map(({ val, label }) => (
                            <button
                                key={val}
                                type="button"
                                aria-pressed={estadoFiltro === val}
                                onClick={() => cambiarEstado(val)}
                                className={cn(
                                    'flex h-full items-center justify-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]',
                                    estadoFiltro === val
                                        ? ESTADO_ACTIVO[val]
                                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </FilterField>

                {metodoFiltro !== 'all' && (
                    <FilterField label="Método">
                        <button
                            type="button"
                            onClick={() => setMetodoFiltro('all')}
                            aria-label={`Quitar el filtro de método ${METODO_LABEL[metodoFiltro]}`}
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors outline-none hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {METODO_LABEL[metodoFiltro]}
                            <X aria-hidden="true" className="size-3.5" />
                        </button>
                    </FilterField>
                )}
            </FilterBar>

            {filas.length > 0 && (
                <RecaudacionStats
                    stats={stats}
                    totalFilas={filas.length}
                    metodoBreakdown={metodoBreakdown}
                    estadoFiltro={estadoFiltro}
                    metodoFiltro={metodoFiltro}
                    onSelectMetodo={seleccionarMetodo}
                />
            )}

            {filtradas.length === 0 ? (
                <div className="rounded-xl border border-border bg-card shadow-sm">
                    <EmptyState
                        variant={hayFiltros ? 'filtered' : 'empty'}
                        title={
                            hayFiltros
                                ? 'Ningún vehículo coincide con los filtros'
                                : (emptyMessage ?? 'No hay vehículos en el período')
                        }
                        description={
                            hayFiltros
                                ? 'Probá con otra patente o quitá el filtro de estado.'
                                : undefined
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
                <>
                    {/* Tarjetas de teléfono */}
                    <div className="flex flex-col gap-3 md:hidden">
                        {filtradas.map((fila) => (
                            <RecaudacionCard
                                key={fila.id ?? fila.vehiculo_id}
                                fila={fila}
                                editable={editable}
                                endpoint={endpoint}
                            />
                        ))}
                    </div>

                    {/* Tabla de escritorio */}
                    <div className="hidden w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed text-left text-sm">
                                <colgroup>
                                    <col className="w-1" />
                                    <col className="w-48" />
                                    <col className="w-28" />
                                    <col className="w-28" />
                                    <col className="w-28" />
                                    <col className="w-24" />
                                    <col className="w-44" />
                                    <col className="w-28" />
                                    <col className="w-28" />
                                </colgroup>
                                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                    <tr>
                                        <th className="w-1 p-0" />
                                        <SortHeader label="Chofer" col="chofer" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                                        <SortHeader label="Inversión" col="inversion" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                                        <th className="px-3 py-3 font-medium tracking-wider">Efectivo</th>
                                        <th className="px-3 py-3 font-medium tracking-wider">Transf.</th>
                                        <th className="px-3 py-3 font-medium tracking-wider">Dcto.</th>
                                        <th className="px-3 py-3 font-medium tracking-wider">Descripción</th>
                                        <SortHeader label="Total" col="total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                                        <SortHeader label="Estado" col="estado" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filtradas.map((fila) => (
                                        <RecaudacionRow
                                            key={fila.id ?? fila.vehiculo_id}
                                            fila={fila}
                                            editable={editable}
                                            endpoint={endpoint}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Los cuatro campos de carga, compartidos por la fila de escritorio y la
 * tarjeta de teléfono.
 */
type CamposProps = {
    form: ReturnType<typeof useRecaudacionForm>['form'];
    excede: boolean;
    editable: boolean;
    save: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

function campoMoneyProps(
    campo: 'efectivo' | 'transferencia' | 'descuento',
    { form, editable, save, onKeyDown }: CamposProps,
) {
    return {
        placeholder: '0',
        value: form.data[campo] === '' ? null : Number(form.data[campo]),
        onValueChange: (n: number | null) =>
            form.setData(campo, n == null ? '' : String(n)),
        onKeyDown,
        onBlur: editable ? save : undefined,
        disabled: !editable,
    };
}

function RecaudacionCard({
    fila,
    editable,
    endpoint,
}: {
    fila: RecaudacionFila;
    editable: boolean;
    endpoint: (fila: RecaudacionFila) => string;
}) {
    const { form, total, excede, estado, deuda, save, onKeyDown } =
        useRecaudacionForm(fila, endpoint);
    const campos: CamposProps = { form, excede, editable, save, onKeyDown };

    return (
        <div
            className={cn(
                'overflow-hidden rounded-xl border bg-card shadow-sm',
                form.processing && 'opacity-60',
            )}
        >
            <div
                aria-hidden="true"
                className={cn(
                    'h-1 w-full',
                    estado === 'pagado' ? 'bg-success' : 'bg-destructive',
                )}
            />

            <div className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <ChoferPopover fila={fila}>
                        <ChoferTrigger fila={fila} size="md" />
                    </ChoferPopover>
                    <EstadoBadge estado={estado} deuda={deuda} />
                </div>

                <p className="mb-3 text-xs text-muted-foreground">
                    {fila.inversion_nombre}
                </p>

                <div className="mb-3 grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor={`ef-${fila.vehiculo_id}`} className="text-xs">
                            Efectivo
                        </Label>
                        <MoneyInput
                            id={`ef-${fila.vehiculo_id}`}
                            className={cn('h-8 text-sm', excede && 'border-destructive')}
                            {...campoMoneyProps('efectivo', campos)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor={`tr-${fila.vehiculo_id}`} className="text-xs">
                            Transferencia
                        </Label>
                        <MoneyInput
                            id={`tr-${fila.vehiculo_id}`}
                            className={cn('h-8 text-sm', excede && 'border-destructive')}
                            {...campoMoneyProps('transferencia', campos)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor={`dc-${fila.vehiculo_id}`} className="text-xs">
                            Descuento
                        </Label>
                        <MoneyInput
                            id={`dc-${fila.vehiculo_id}`}
                            className="h-8 text-sm"
                            {...campoMoneyProps('descuento', campos)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor={`ds-${fila.vehiculo_id}`} className="text-xs">
                            Descripción
                        </Label>
                        <Input
                            id={`ds-${fila.vehiculo_id}`}
                            type="text"
                            placeholder="Opcional..."
                            className="h-8 text-sm"
                            value={form.data.descripcion}
                            onChange={(e) =>
                                form.setData('descripcion', e.target.value)
                            }
                            onKeyDown={onKeyDown}
                            onBlur={editable ? save : undefined}
                            disabled={!editable}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span
                        className={cn(
                            'text-base font-bold tabular-nums',
                            excede ? 'text-destructive' : 'text-foreground',
                        )}
                    >
                        {formatARS(total)}
                    </span>
                </div>
            </div>
        </div>
    );
}

function RecaudacionRow({
    fila,
    editable,
    endpoint,
}: {
    fila: RecaudacionFila;
    editable: boolean;
    endpoint: (fila: RecaudacionFila) => string;
}) {
    const { form, total, excede, estado, deuda, save, onKeyDown } =
        useRecaudacionForm(fila, endpoint);
    const campos: CamposProps = { form, excede, editable, save, onKeyDown };

    return (
        <tr
            className={cn(
                'transition-colors hover:bg-muted/30',
                form.processing && 'opacity-60',
            )}
        >
            <td
                aria-hidden="true"
                className={cn(
                    'w-1 p-0',
                    estado === 'pagado' ? 'bg-success' : 'bg-destructive',
                )}
            />

            <td className="px-3 py-2">
                <ChoferPopover fila={fila}>
                    <ChoferTrigger fila={fila} />
                </ChoferPopover>
            </td>

            <td className="px-3 py-2 text-xs text-muted-foreground">
                {fila.inversion_nombre}
            </td>

            <td className="px-3 py-2">
                <MoneyInput
                    aria-label={`Efectivo de ${fila.patente}`}
                    className={cn('h-8 w-full text-sm', excede && 'border-destructive')}
                    {...campoMoneyProps('efectivo', campos)}
                />
            </td>

            <td className="px-3 py-2">
                <MoneyInput
                    aria-label={`Transferencia de ${fila.patente}`}
                    className={cn('h-8 w-full text-sm', excede && 'border-destructive')}
                    {...campoMoneyProps('transferencia', campos)}
                />
            </td>

            <td className="px-3 py-2">
                <MoneyInput
                    aria-label={`Descuento de ${fila.patente}`}
                    className="h-8 w-full text-sm"
                    {...campoMoneyProps('descuento', campos)}
                />
            </td>

            <td className="px-3 py-2">
                <Input
                    type="text"
                    placeholder="Opcional..."
                    aria-label={`Descripción del descuento de ${fila.patente}`}
                    className="h-8 w-full text-sm"
                    value={form.data.descripcion}
                    onChange={(e) => form.setData('descripcion', e.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={editable ? save : undefined}
                    disabled={!editable}
                />
            </td>

            <td
                className={cn(
                    'px-3 py-2 text-right font-semibold tabular-nums',
                    excede ? 'text-destructive' : 'text-foreground',
                )}
            >
                {formatARS(total)}
            </td>

            <td className="px-3 py-2">
                <EstadoBadge estado={estado} deuda={deuda} />
            </td>
        </tr>
    );
}
