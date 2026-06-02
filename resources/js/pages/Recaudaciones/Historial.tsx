import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Calendar, Car, ChevronRight, Lock, User } from 'lucide-react';
import { formatARS, formatDate } from '@/components/recaudaciones-tabla';
import { Button } from '@/components/ui/button';
import type { RecaudacionCierreResumen } from '@/types';

interface Props {
    cierres: RecaudacionCierreResumen[];
}

export default function RecaudacionesHistorial({ cierres }: Props) {
    return (
        <>
            <Head title="Historial de recaudaciones" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Historial de cierres</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {cierres.length} cierre{cierres.length !== 1 ? 's' : ''} registrado
                            {cierres.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => router.get('/recaudaciones')}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Volver
                    </Button>
                </div>

                {cierres.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <Lock className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            Todavía no se realizaron cierres de recaudación.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium tracking-wider sm:px-6">Fecha</th>
                                    <th className="px-4 py-3 font-medium tracking-wider sm:px-6">Ejecutado por</th>
                                    <th className="px-4 py-3 text-center font-medium tracking-wider sm:px-6">Vehículos</th>
                                    <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">Total</th>
                                    <th className="px-4 py-3 sm:px-6"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {cierres.map((c) => (
                                    <tr
                                        key={c.id}
                                        onClick={() => router.get(`/recaudaciones/cierres/${c.id}`)}
                                        className="cursor-pointer transition-colors hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-3 sm:px-6">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {formatDate(c.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 sm:px-6">
                                            <div className="flex items-center gap-2">
                                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                {c.user?.name ?? 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center sm:px-6">
                                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                <Car className="h-3.5 w-3.5" />
                                                {c.vehiculos_count}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums sm:px-6">
                                            {formatARS(Number(c.total))}
                                        </td>
                                        <td className="px-4 py-3 text-right sm:px-6">
                                            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}

RecaudacionesHistorial.layout = {
    breadcrumbs: [
        { title: 'Recaudaciones', href: '/recaudaciones' },
        { title: 'Historial', href: '/recaudaciones/historial' },
    ],
};
