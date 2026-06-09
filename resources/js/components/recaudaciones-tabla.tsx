import { useForm } from '@inertiajs/react';
import { ArrowLeftRight, Banknote, Check, Search, TrendingUp, Users, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, Phone, Mail } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { RecaudacionFila } from '@/types';

export function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

export function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function EstadoBadge({ estado, deuda }: { estado: 'pagado' | 'deuda'; deuda: number }) {
    if (estado === 'pagado') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check className="h-3 w-3" /> Pagado
            </span>
        );
    }
    return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Debe {formatARS(deuda)}
        </span>
    );
}

export function ResumenRecaudacionModal({
    open,
    onOpenChange,
    filas,
    totalGeneral,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filas: RecaudacionFila[];
    totalGeneral: number;
}) {
    const resumen = useMemo(() => {
        const map = new Map<string, number>();
        for (const f of filas) {
            map.set(f.inversion_nombre, (map.get(f.inversion_nombre) ?? 0) + Number(f.total));
        }
        return Array.from(map.entries())
            .map(([inversion_nombre, total]) => ({ inversion_nombre, total }))
            .sort((a, b) => a.inversion_nombre.localeCompare(b.inversion_nombre, 'es', { numeric: true }));
    }, [filas]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
                <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15">
                        <TrendingUp className="h-5 w-5 text-teal-500" />
                    </div>
                    <div className="flex-1">
                        <DialogTitle className="text-base font-semibold">Resumen de recaudaciones</DialogTitle>
                        <DialogDescription className="text-xs">Total recaudado por inversión.</DialogDescription>
                    </div>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                {resumen.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No hay recaudaciones cargadas.</p>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-2.5 font-medium tracking-wider">Inversión</th>
                                    <th className="px-4 py-2.5 text-right font-medium tracking-wider">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {resumen.map((inv) => (
                                    <tr key={inv.inversion_nombre} className="hover:bg-muted/40">
                                        <td className="px-4 py-2.5 text-foreground">{inv.inversion_nombre}</td>
                                        <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">{formatARS(inv.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-border bg-muted/30">
                                <tr>
                                    <td className="px-4 py-3 font-semibold text-foreground">Total general</td>
                                    <td className="px-4 py-3 text-right text-base font-bold text-foreground tabular-nums">{formatARS(totalGeneral)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
                </div>
                <DialogFooter className="border-t border-border px-5 py-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type SortCol = 'chofer' | 'inversion' | 'total' | 'estado';

function SortHeader({
    label, col, sortKey, sortDir, onSort, className,
}: {
    label: string;
    col: SortCol;
    sortKey: SortCol | null;
    sortDir: 'asc' | 'desc';
    onSort: (col: SortCol) => void;
    className?: string;
}) {
    const active = sortKey === col;
    const Icon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
        <th className={cn('px-3 py-3 font-medium tracking-wider', className)}>
            <button
                type="button"
                onClick={() => onSort(col)}
                className={cn(
                    'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                    active ? 'text-foreground' : 'text-muted-foreground',
                )}
            >
                {label}
                <Icon className="h-3 w-3 shrink-0" />
            </button>
        </th>
    );
}

interface RecaudacionesTablaProps {
    filas: RecaudacionFila[];
    editable: boolean;
    endpoint: (fila: RecaudacionFila) => string;
    emptyMessage?: string;
}

export function RecaudacionesTabla({ filas, editable, endpoint, emptyMessage }: RecaudacionesTablaProps) {
    const [search, setSearch] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState<'all' | 'pagado' | 'deuda'>('all');
    const [sortKey, setSortKey] = useState<SortCol | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    function toggleSort(key: SortCol) {
        if (sortKey === key) {
            setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir(key === 'total' ? 'desc' : 'asc');
        }
    }

    const filtradas = useMemo(() => {
        const q = search.toLowerCase().trim();
        let result = filas.filter((f) => {
            if (estadoFiltro !== 'all' && f.estado !== estadoFiltro) return false;
            if (q) return f.patente.toLowerCase().includes(q) || f.chofer.toLowerCase().includes(q);
            return true;
        });

        if (sortKey) {
            result = [...result].sort((a, b) => {
                let cmp = 0;
                if (sortKey === 'chofer')    cmp = a.chofer.localeCompare(b.chofer, 'es');
                if (sortKey === 'inversion') cmp = a.inversion_nombre.localeCompare(b.inversion_nombre, 'es', { numeric: true });
                if (sortKey === 'total')     cmp = Number(a.total) - Number(b.total);
                if (sortKey === 'estado')    cmp = a.estado.localeCompare(b.estado); // deuda < pagado
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [filas, search, estadoFiltro, sortKey, sortDir]);

    const stats = useMemo(() => ({
        total:        filtradas.reduce((s, f) => s + Number(f.total), 0),
        efectivo:     filtradas.reduce((s, f) => s + Number(f.efectivo), 0),
        transferencia:filtradas.reduce((s, f) => s + Number(f.transferencia), 0),
        pagados:      filtradas.filter((f) => f.estado === 'pagado').length,
        deudores:     filtradas.filter((f) => f.estado === 'deuda').length,
        totalDeuda:   filtradas.reduce((s, f) => s + Number(f.deuda), 0),
    }), [filtradas]);

    return (
        <div className="flex flex-col gap-4">
            {/* Buscador + filtros */}
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex w-full flex-col gap-2 lg:min-w-[240px] lg:flex-1">
                        <Label htmlFor="rec-search">Buscar</Label>
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="rec-search"
                                type="text"
                                placeholder="Buscar patente o chofer..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 lg:w-auto">
                        <Label>Estado</Label>
                        <div className="flex h-9 gap-1.5">
                            {([
                                { val: 'all',    label: 'Todos'   },
                                { val: 'deuda',  label: 'Deben'   },
                                { val: 'pagado', label: 'Pagados' },
                            ] as const).map(({ val, label }) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setEstadoFiltro(val)}
                                    className={cn(
                                        'flex h-full items-center justify-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                                        estadoFiltro === val
                                            ? val === 'pagado' ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                                            : val === 'deuda'  ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                                            : 'border-primary/30 bg-primary/10 text-primary'
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

            {/* Stats */}
            {filtradas.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <TrendingUp className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="truncate font-bold tabular-nums text-foreground">{formatARS(stats.total)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                            <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-emerald-700 dark:text-emerald-400">Efectivo</p>
                            <p className="truncate font-bold tabular-nums text-foreground">{formatARS(stats.efectivo)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                            <ArrowLeftRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-blue-700 dark:text-blue-400">Transferencia</p>
                            <p className="truncate font-bold tabular-nums text-foreground">{formatARS(stats.transferencia)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500/15">
                            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-xs text-green-700 dark:text-green-400">Pagados</p>
                            <p className="font-bold text-foreground">
                                {stats.pagados}
                                <span className="ml-1 text-xs font-normal text-muted-foreground">/ {filtradas.length}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-red-700 dark:text-red-400">Deben</p>
                            <p className="truncate font-bold text-foreground">
                                {stats.deudores > 0 ? formatARS(stats.totalDeuda) : '—'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabla */}
            {filtradas.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
                    {emptyMessage ?? 'No hay vehículos que coincidan con la búsqueda.'}
                </div>
            ) : (
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
                                    <SortHeader label="Chofer"    col="chofer"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                                    <SortHeader label="Inversión" col="inversion" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                                    <th className="px-3 py-3 font-medium tracking-wider">Efectivo</th>
                                    <th className="px-3 py-3 font-medium tracking-wider">Transf.</th>
                                    <th className="px-3 py-3 font-medium tracking-wider">Dcto.</th>
                                    <th className="px-3 py-3 font-medium tracking-wider">Descripción</th>
                                    <SortHeader label="Total"     col="total"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                                    <SortHeader label="Estado"    col="estado"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
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
            )}
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
    const form = useForm({
        efectivo:      fila.efectivo > 0      ? String(fila.efectivo)      : '',
        transferencia: fila.transferencia > 0 ? String(fila.transferencia) : '',
        descuento:     fila.descuento > 0     ? String(fila.descuento)     : '',
        descripcion:   fila.descripcion ?? '',
    });

    const efectivo      = parseFloat(form.data.efectivo)      || 0;
    const transferencia = parseFloat(form.data.transferencia) || 0;
    const descuento     = parseFloat(form.data.descuento)     || 0;
    const total         = efectivo + transferencia;
    const precioEfectivo = Math.max(Number(fila.precio) - descuento, 0);
    const excede        = total > precioEfectivo;
    const estado: 'pagado' | 'deuda' = total >= precioEfectivo ? 'pagado' : 'deuda';
    const deuda         = Math.max(precioEfectivo - total, 0);

    function save() {
        if (excede) return;
        form.transform((data) => ({
            efectivo:      parseFloat(data.efectivo)      || 0,
            transferencia: parseFloat(data.transferencia) || 0,
            descuento:     parseFloat(data.descuento)     || 0,
            descripcion:   data.descripcion,
        }));
        form.patch(endpoint(fila), { preserveScroll: true });
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
    }

    return (
        <tr className={cn('transition-colors hover:bg-muted/30', form.processing && 'opacity-60')}>
            {/* Indicador de estado */}
            <td className={cn('w-1 p-0', estado === 'pagado' ? 'bg-green-500' : 'bg-red-500')} />

            {/* Chofer */}
            <td className="px-3 py-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <button type="button" className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                                {getInitials(fila.chofer)}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{fila.chofer}</p>
                                <p className="font-mono text-[10px] text-muted-foreground">{fila.patente}</p>
                            </div>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-0">
                        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                                {getInitials(fila.chofer)}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{fila.chofer}</p>
                                <p className="font-mono text-xs text-muted-foreground">{fila.patente}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-0 p-1">
                            {fila.chofer_telefono ? (
                                <a
                                    href={`tel:${fila.chofer_telefono}`}
                                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                                >
                                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="text-foreground">{fila.chofer_telefono}</span>
                                </a>
                            ) : (
                                <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground/50">
                                    <Phone className="h-4 w-4 shrink-0" />
                                    <span className="italic">Sin teléfono</span>
                                </div>
                            )}
                            {fila.chofer_correo ? (
                                <a
                                    href={`mailto:${fila.chofer_correo}`}
                                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                                >
                                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate text-foreground">{fila.chofer_correo}</span>
                                </a>
                            ) : (
                                <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground/50">
                                    <Mail className="h-4 w-4 shrink-0" />
                                    <span className="italic">Sin correo</span>
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </td>

            {/* Inversión */}
            <td className="px-3 py-2 text-xs text-muted-foreground">{fila.inversion_nombre}</td>

            {/* Efectivo */}
            <td className="px-3 py-2">
                <Input
                    type="number" min="0" step="0.01" placeholder="0"
                    className={cn('h-8 w-full text-sm', excede && 'border-red-500')}
                    value={form.data.efectivo}
                    onChange={(e) => form.setData('efectivo', e.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={editable ? save : undefined}
                    disabled={!editable}
                />
            </td>

            {/* Transferencia */}
            <td className="px-3 py-2">
                <Input
                    type="number" min="0" step="0.01" placeholder="0"
                    className={cn('h-8 w-full text-sm', excede && 'border-red-500')}
                    value={form.data.transferencia}
                    onChange={(e) => form.setData('transferencia', e.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={editable ? save : undefined}
                    disabled={!editable}
                />
            </td>

            {/* Descuento */}
            <td className="px-3 py-2">
                <Input
                    type="number" min="0" step="0.01" placeholder="0"
                    className="h-8 w-full text-sm"
                    value={form.data.descuento}
                    onChange={(e) => form.setData('descuento', e.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={editable ? save : undefined}
                    disabled={!editable}
                />
            </td>

            {/* Descripción */}
            <td className="px-3 py-2">
                <Input
                    type="text" placeholder="Opcional..."
                    className="h-8 w-full text-sm"
                    value={form.data.descripcion}
                    onChange={(e) => form.setData('descripcion', e.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={editable ? save : undefined}
                    disabled={!editable}
                />
            </td>

            {/* Total */}
            <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', excede ? 'text-red-500' : 'text-foreground')}>
                {formatARS(total)}
            </td>

            {/* Estado */}
            <td className="px-3 py-2">
                <EstadoBadge estado={estado} deuda={deuda} />
            </td>
        </tr>
    );
}
