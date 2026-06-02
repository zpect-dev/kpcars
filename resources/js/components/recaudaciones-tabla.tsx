import { useForm } from '@inertiajs/react';
import { Check, Search } from 'lucide-react';
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

export function EstadoBadge({ estado, deuda }: { estado: 'pagado' | 'deuda'; deuda: number }) {
    if (estado === 'pagado') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check className="h-3 w-3" /> Pagado
            </span>
        );
    }

    return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
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
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Resumen de recaudaciones</DialogTitle>
                    <DialogDescription>Total recaudado por inversión.</DialogDescription>
                </DialogHeader>

                {resumen.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No hay recaudaciones cargadas.
                    </p>
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
                                        <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">
                                            {formatARS(inv.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-border bg-muted/30">
                                <tr>
                                    <td className="px-4 py-3 font-semibold text-foreground">Total general</td>
                                    <td className="px-4 py-3 text-right text-base font-bold text-foreground tabular-nums">
                                        {formatARS(totalGeneral)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface RecaudacionesTablaProps {
    filas: RecaudacionFila[];
    editable: boolean;
    /** Devuelve la URL PATCH para guardar la fila. */
    endpoint: (fila: RecaudacionFila) => string;
    emptyMessage?: string;
}

export function RecaudacionesTabla({ filas, editable, endpoint, emptyMessage }: RecaudacionesTablaProps) {
    const [search, setSearch] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState<'all' | 'pagado' | 'deuda'>('all');

    const filtradas = useMemo(() => {
        const q = search.toLowerCase().trim();

        return filas.filter((f) => {
            if (estadoFiltro !== 'all' && f.estado !== estadoFiltro) {
                return false;
            }

            if (q) {
                return f.patente.toLowerCase().includes(q) || f.chofer.toLowerCase().includes(q);
            }

            return true;
        });
    }, [filas, search, estadoFiltro]);

    return (
        <div className="flex flex-col gap-4">
            {/* Buscador + filtros */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Buscar patente o chofer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex h-9 gap-1.5">
                    {(
                        [
                            { val: 'all', label: 'Todos' },
                            { val: 'deuda', label: 'Deben' },
                            { val: 'pagado', label: 'Pagados' },
                        ] as const
                    ).map(({ val, label }) => (
                        <button
                            key={val}
                            type="button"
                            onClick={() => setEstadoFiltro(val)}
                            className={cn(
                                'flex h-full items-center justify-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                                estadoFiltro === val
                                    ? val === 'pagado'
                                        ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                                        : val === 'deuda'
                                          ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                                          : 'border-primary/30 bg-primary/10 text-primary'
                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabla */}
            <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                            <tr>
                                <th className="px-3 py-3 font-medium tracking-wider">Inversión</th>
                                <th className="px-3 py-3 font-medium tracking-wider">Patente</th>
                                <th className="px-3 py-3 font-medium tracking-wider">Chofer</th>
                                <th className="px-3 py-3 font-medium tracking-wider">Efectivo</th>
                                <th className="px-3 py-3 font-medium tracking-wider">Transferencia</th>
                                <th className="px-3 py-3 text-right font-medium tracking-wider">Total</th>
                                <th className="px-3 py-3 font-medium tracking-wider">Descuento</th>
                                <th className="px-3 py-3 font-medium tracking-wider">Descripción</th>
                                <th className="px-3 py-3 font-medium tracking-wider">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filtradas.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                                        {emptyMessage ?? 'No hay vehículos que coincidan con la búsqueda.'}
                                    </td>
                                </tr>
                            ) : (
                                filtradas.map((fila) => (
                                    <RecaudacionRow
                                        key={fila.id ?? fila.vehiculo_id}
                                        fila={fila}
                                        editable={editable}
                                        endpoint={endpoint}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
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
    const form = useForm({
        efectivo: String(fila.efectivo ?? 0),
        transferencia: String(fila.transferencia ?? 0),
        descuento: String(fila.descuento ?? 0),
        descripcion: fila.descripcion ?? '',
    });

    const efectivo = parseFloat(form.data.efectivo) || 0;
    const transferencia = parseFloat(form.data.transferencia) || 0;
    const descuento = parseFloat(form.data.descuento) || 0;
    const total = efectivo + transferencia;
    const precioEfectivo = Math.max(Number(fila.precio) - descuento, 0);
    const excede = total > precioEfectivo;
    const estado: 'pagado' | 'deuda' = total >= precioEfectivo ? 'pagado' : 'deuda';
    const deuda = Math.max(precioEfectivo - total, 0);

    function save() {
        if (excede) {
            return;
        }

        form.transform((data) => ({
            efectivo: parseFloat(data.efectivo) || 0,
            transferencia: parseFloat(data.transferencia) || 0,
            descuento: parseFloat(data.descuento) || 0,
            descripcion: data.descripcion,
        }));
        form.patch(endpoint(fila), { preserveScroll: true });
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
            save();
        }
    }

    return (
        <tr className={cn('transition-colors hover:bg-muted/40', form.processing && 'opacity-60')}>
            <td className="px-3 py-2 text-muted-foreground">{fila.inversion_nombre}</td>
            <td className="px-3 py-2 font-mono font-medium text-foreground">{fila.patente}</td>
            <td className="px-3 py-2 text-muted-foreground">{fila.chofer}</td>
            <td className="px-3 py-2">
                <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className={cn('h-8 w-28', excede && 'border-red-500')}
                    value={form.data.efectivo}
                    onChange={(e) => form.setData('efectivo', e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={!editable}
                />
            </td>
            <td className="px-3 py-2">
                <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className={cn('h-8 w-28', excede && 'border-red-500')}
                    value={form.data.transferencia}
                    onChange={(e) => form.setData('transferencia', e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={!editable}
                />
            </td>
            <td className={cn('px-3 py-2 text-right font-semibold', excede ? 'text-red-600' : 'text-foreground')}>
                {formatARS(total)}
            </td>
            <td className="px-3 py-2">
                <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-8 w-24"
                    value={form.data.descuento}
                    onChange={(e) => form.setData('descuento', e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={!editable}
                />
            </td>
            <td className="px-3 py-2">
                <Input
                    type="text"
                    className="h-8 w-44"
                    placeholder="Descripción..."
                    value={form.data.descripcion}
                    onChange={(e) => form.setData('descripcion', e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={!editable}
                />
            </td>
            <td className="px-3 py-2">
                <EstadoBadge estado={estado} deuda={deuda} />
            </td>
        </tr>
    );
}
