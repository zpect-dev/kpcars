import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Car, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { index } from '@/routes/cobros';
import type { CobroDesglose, CobroTransaccion, Inversion } from '@/types';

function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

interface Props {
    inversion: Pick<Inversion, 'id' | 'nombre'>;
    desglose: CobroDesglose[];
    transacciones: CobroTransaccion[];
    totalInversion: number;
}

export default function CobrosShow({
    inversion,
    desglose,
    transacciones,
    totalInversion,
}: Props) {
    const [expandedVehicles, setExpandedVehicles] = useState<Set<number>>(
        new Set(),
    );

    function toggleVehicle(vehiculoId: number) {
        setExpandedVehicles((prev) => {
            const next = new Set(prev);
            if (next.has(vehiculoId)) {
                next.delete(vehiculoId);
            } else {
                next.add(vehiculoId);
            }
            return next;
        });
    }

    // Group transactions by vehicle
    const transactionsByVehicle = transacciones.reduce(
        (acc, t) => {
            const key = t.patente;
            if (!acc[key]) acc[key] = [];
            acc[key].push(t);
            return acc;
        },
        {} as Record<string, CobroTransaccion[]>,
    );

    return (
        <>
            <Head title={`Cobros — ${inversion.nombre}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.get(index.url())}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Volver</span>
                        </Button>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">
                                {inversion.nombre}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Total Card */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                Total a cobrar
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                                {formatARS(totalInversion)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Vehicle breakdown */}
                {desglose.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <Car className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            No hay cobros pendientes para esta inversión.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {desglose.map((v) => {
                            const isExpanded = expandedVehicles.has(
                                v.vehiculo_id,
                            );
                            const vehicleTransactions =
                                transactionsByVehicle[v.patente] ?? [];

                            return (
                                <div
                                    key={v.vehiculo_id}
                                    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                                >
                                    {/* Vehicle header */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            toggleVehicle(v.vehiculo_id)
                                        }
                                        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/40"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                <Car className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">
                                                    {v.patente}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {v.marca} {v.modelo}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-foreground">
                                            {formatARS(Number(v.subtotal))}
                                        </span>
                                    </button>

                                    {/* Expanded detail */}
                                    {isExpanded &&
                                        vehicleTransactions.length > 0 && (
                                            <div className="border-t border-border">
                                                {/* Desktop table */}
                                                <div className="hidden md:block">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                                                            <tr>
                                                                <th className="px-4 py-2 font-medium">
                                                                    Artículo
                                                                </th>
                                                                <th className="px-4 py-2 text-right font-medium">
                                                                    Cantidad
                                                                </th>
                                                                <th className="px-4 py-2 text-right font-medium">
                                                                    Precio Unit.
                                                                </th>
                                                                <th className="px-4 py-2 text-right font-medium">
                                                                    Subtotal
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border">
                                                            {vehicleTransactions.map(
                                                                (t) => (
                                                                    <tr
                                                                        key={
                                                                            t.id
                                                                        }
                                                                        className="transition-colors hover:bg-muted/20"
                                                                    >
                                                                        <td className="px-4 py-2 font-medium text-foreground">
                                                                            {
                                                                                t.articulo
                                                                            }
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right text-muted-foreground">
                                                                            {
                                                                                t.cantidad
                                                                            }
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right text-muted-foreground">
                                                                            {formatARS(
                                                                                Number(
                                                                                    t.precio_unitario,
                                                                                ),
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right font-medium text-foreground">
                                                                            {formatARS(
                                                                                Number(
                                                                                    t.subtotal,
                                                                                ),
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ),
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Mobile list */}
                                                <ul className="divide-y divide-border md:hidden">
                                                    {vehicleTransactions.map(
                                                        (t) => (
                                                            <li
                                                                key={t.id}
                                                                className="flex items-center justify-between px-4 py-3"
                                                            >
                                                                <div>
                                                                    <p className="text-sm font-medium text-foreground">
                                                                        {
                                                                            t.articulo
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {
                                                                            t.cantidad
                                                                        }{' '}
                                                                        ×{' '}
                                                                        {formatARS(
                                                                            Number(
                                                                                t.precio_unitario,
                                                                            ),
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <span className="text-sm font-semibold text-foreground">
                                                                    {formatARS(
                                                                        Number(
                                                                            t.subtotal,
                                                                        ),
                                                                    )}
                                                                </span>
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

CobrosShow.layout = {
    breadcrumbs: [
        {
            title: 'Cobros',
            href: index.url(),
        },
        {
            title: 'Detalle',
        },
    ],
};
