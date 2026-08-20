import { Check, ChevronDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/app/empty-state';
import { FormDialog } from '@/components/app/form-dialog';
import { StatusBadge } from '@/components/app/status-badge';
import { formatARS } from '@/components/recaudaciones/format';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { RecaudacionFila } from '@/types';

/** Ordena por patente, con criterio numérico para que AB100 no caiga antes que AB99. */
function porPatente(a: RecaudacionFila, b: RecaudacionFila) {
    return a.patente.localeCompare(b.patente, 'es', { numeric: true });
}

function TablaPagados({ filas }: { filas: RecaudacionFila[] }) {
    return (
        <div className="overflow-hidden rounded-lg border border-border">
            <Table className="text-xs">
                <TableHeader className="bg-muted/60">
                    <TableRow>
                        <TableHead className="px-3 py-1.5">Patente</TableHead>
                        <TableHead className="px-3 py-1.5">Chofer</TableHead>
                        <TableHead className="px-3 py-1.5 text-right">
                            Total
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filas.map((f) => (
                        <TableRow key={f.id ?? f.vehiculo_id}>
                            <TableCell className="px-3 py-1.5 font-mono font-medium text-foreground">
                                {f.patente}
                            </TableCell>
                            <TableCell className="px-3 py-1.5 text-muted-foreground">
                                {f.chofer}
                            </TableCell>
                            <TableCell className="px-3 py-1.5 text-right font-semibold text-foreground tabular-nums">
                                {formatARS(Number(f.total))}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function TablaDescuentos({ filas }: { filas: RecaudacionFila[] }) {
    return (
        <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Descuentos
            </p>
            <div className="overflow-hidden rounded-lg border border-warning/30">
                <Table className="text-xs">
                    <TableHeader className="border-warning/30 bg-warning-soft text-warning-soft-foreground">
                        <TableRow>
                            <TableHead className="px-3 py-1.5 text-warning-soft-foreground">
                                Patente
                            </TableHead>
                            <TableHead className="px-3 py-1.5 text-warning-soft-foreground">
                                Chofer
                            </TableHead>
                            <TableHead className="px-3 py-1.5 text-right text-warning-soft-foreground">
                                Descuento
                            </TableHead>
                            <TableHead className="px-3 py-1.5 text-warning-soft-foreground">
                                Descripción
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filas.map((f) => (
                            <TableRow key={f.id ?? f.vehiculo_id}>
                                <TableCell className="px-3 py-1.5 font-mono font-medium text-foreground">
                                    {f.patente}
                                </TableCell>
                                <TableCell className="px-3 py-1.5 text-muted-foreground">
                                    {f.chofer}
                                </TableCell>
                                <TableCell className="px-3 py-1.5 text-right font-semibold text-warning-soft-foreground tabular-nums">
                                    {formatARS(Number(f.descuento))}
                                </TableCell>
                                <TableCell className="px-3 py-1.5 text-muted-foreground">
                                    {f.descripcion || (
                                        <span className="italic">—</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
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
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const resumen = useMemo(() => {
        const map = new Map<
            string,
            { total: number; filas: RecaudacionFila[] }
        >();

        for (const f of filas) {
            if (!map.has(f.inversion_nombre)) {
                map.set(f.inversion_nombre, { total: 0, filas: [] });
            }

            const entry = map.get(f.inversion_nombre)!;
            entry.total += Number(f.total);
            entry.filas.push(f);
        }

        return Array.from(map.entries())
            .map(([inversion_nombre, { total, filas: invFilas }]) => ({
                inversion_nombre,
                total,
                filas: invFilas,
            }))
            .sort((a, b) =>
                a.inversion_nombre.localeCompare(b.inversion_nombre, 'es', {
                    numeric: true,
                }),
            );
    }, [filas]);

    function toggleExpand(nombre: string) {
        setExpanded((prev) => {
            const next = new Set(prev);

            if (next.has(nombre)) {
                next.delete(nombre);
            } else {
                next.add(nombre);
            }

            return next;
        });
    }

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            icon={TrendingUp}
            tone="success"
            title="Resumen de recaudaciones"
            description="Total recaudado por inversión. Expandí cada una para ver el detalle."
            cancelLabel="Cerrar"
        >
            {resumen.length === 0 ? (
                <EmptyState
                    title="No hay recaudaciones cargadas"
                    description="Cuando se registre el primer cobro del período, el resumen aparece acá."
                />
            ) : (
                <div className="-mx-5 -my-5 divide-y divide-border">
                    {resumen.map((inv) => {
                        const isOpen = expanded.has(inv.inversion_nombre);
                        const pagados = inv.filas.filter(
                            (f) => f.estado === 'pagado',
                        );
                        const deudores = inv.filas.filter(
                            (f) => f.estado === 'deuda',
                        ).length;
                        const conDescuento = inv.filas.filter(
                            (f) => Number(f.descuento) > 0,
                        );

                        return (
                            <div key={inv.inversion_nombre}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        toggleExpand(inv.inversion_nombre)
                                    }
                                    aria-expanded={isOpen}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                >
                                    <ChevronDown
                                        aria-hidden="true"
                                        className={cn(
                                            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                            isOpen && 'rotate-180',
                                        )}
                                    />
                                    <span className="flex-1 text-sm font-medium text-foreground">
                                        {inv.inversion_nombre}
                                    </span>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {inv.filas.length} auto
                                        {inv.filas.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="min-w-[90px] text-right text-sm font-semibold text-foreground tabular-nums">
                                        {formatARS(inv.total)}
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="border-t border-border bg-muted/20 px-4 pt-2 pb-3">
                                        <div className="mb-2 flex gap-2">
                                            {pagados.length > 0 && (
                                                <StatusBadge
                                                    tone="success"
                                                    icon={Check}
                                                >
                                                    {pagados.length} pagado
                                                    {pagados.length !== 1
                                                        ? 's'
                                                        : ''}
                                                </StatusBadge>
                                            )}
                                            {deudores > 0 && (
                                                <StatusBadge tone="destructive">
                                                    {deudores} deben
                                                </StatusBadge>
                                            )}
                                        </div>

                                        {pagados.length > 0 ? (
                                            <TablaPagados
                                                filas={[...pagados].sort(
                                                    porPatente,
                                                )}
                                            />
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">
                                                Ningún auto pagó todavía.
                                            </p>
                                        )}

                                        {conDescuento.length > 0 && (
                                            <TablaDescuentos
                                                filas={[...conDescuento].sort(
                                                    porPatente,
                                                )}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">
                            Total general
                        </span>
                        <span className="text-base font-bold text-foreground tabular-nums">
                            {formatARS(totalGeneral)}
                        </span>
                    </div>
                </div>
            )}
        </FormDialog>
    );
}
