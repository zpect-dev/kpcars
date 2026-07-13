import { Head, Link } from '@inertiajs/react';
import { Calendar, History, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { index } from '@/routes/cobros';
import { show as historialShow } from '@/routes/cobros/historial';

interface CierreRow {
    id: number;
    user: { id: number; name: string } | null;
    total_cobros: number;
    total_gastos: number;
    total: number;
    created_at: string | null;
}

interface Props {
    cierres: CierreRow[];
}

function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

function formatDate(date: string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CobrosHistorial({ cierres }: Props) {
    return (
        <>
            <Head title="Historial de Cobros" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <History className="h-5 w-5 text-muted-foreground" />
                        Historial de Cierres
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Cada cierre abre una réplica de solo lectura de cómo se veía Cobros en ese período.
                    </p>
                </div>

                {cierres.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
                        Todavía no hay cierres de caja registrados.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        {/* Desktop */}
                        <div className="hidden md:block">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium tracking-wider sm:px-6">Cierre</th>
                                        <th className="px-4 py-3 font-medium tracking-wider sm:px-6">Fecha</th>
                                        <th className="px-4 py-3 font-medium tracking-wider sm:px-6">Ejecutado por</th>
                                        <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">Cobros</th>
                                        <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">Gastos</th>
                                        <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">Total</th>
                                        <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {cierres.map((c) => (
                                        <tr key={c.id} className="transition-colors hover:bg-muted/40">
                                            <td className="px-4 py-3 font-medium sm:px-6">#{c.id}</td>
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
                                            <td className="px-4 py-3 text-right text-muted-foreground sm:px-6">
                                                {formatARS(Number(c.total_cobros))}
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground sm:px-6">
                                                {formatARS(Number(c.total_gastos))}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium sm:px-6">
                                                {formatARS(Number(c.total))}
                                            </td>
                                            <td className="px-4 py-3 text-right sm:px-6">
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={historialShow.url(c.id)}>Ver</Link>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile */}
                        <ul className="divide-y divide-border md:hidden">
                            {cierres.map((c) => (
                                <li key={c.id} className="flex items-center justify-between p-4">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground">
                                            Cierre #{c.id} · {formatDate(c.created_at)}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {c.user?.name ?? 'N/A'} · Cobros {formatARS(Number(c.total_cobros))} · Gastos {formatARS(Number(c.total_gastos))}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className="text-sm font-semibold">{formatARS(Number(c.total))}</span>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={historialShow.url(c.id)}>Ver</Link>
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </>
    );
}

CobrosHistorial.layout = {
    breadcrumbs: [
        { title: 'Cobros', href: index.url() },
        { title: 'Historial', href: '/cobros/historial' },
    ],
};
