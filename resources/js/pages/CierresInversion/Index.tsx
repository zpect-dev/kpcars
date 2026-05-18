import { Head, Link, router } from '@inertiajs/react';
import { Calendar, Plus, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyDual } from '@/components/money-dual';

interface Cierre {
    id: number;
    periodo_inicio: string | null;
    periodo_fin: string;
    total_recaudado: string | number;
    total_distribuido: string | number;
    tasa: string | number | null;
    ejecutado_por: { id: number; name: string } | null;
    created_at: string;
}

interface Paginator {
    data: Cierre[];
    current_page: number;
    last_page: number;
    next_page_url: string | null;
    prev_page_url: string | null;
}

interface Props {
    cierres: Paginator;
}

function formatARS(value: number | string): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(Number(value));
}

function formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export default function CierresIndex({ cierres }: Props) {
    return (
        <>
            <Head title="Cierres de Inversión" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                            Cierres de Inversión
                        </h1>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Historial de liquidaciones semanales.
                        </p>
                    </div>
                    <Button onClick={() => router.get('/cierres-inversion/nuevo')}>
                        <Plus className="mr-1 h-4 w-4" />
                        Nuevo cierre
                    </Button>
                </div>

                {cierres.data.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <Lock className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            No hay cierres realizados todavía.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <div className="hidden md:block">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium tracking-wider sm:px-6">
                                            Cierre
                                        </th>
                                        <th className="px-4 py-3 font-medium tracking-wider sm:px-6">
                                            Ejecutado por
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6">
                                            Recaudado
                                        </th>
                                        <th className="px-4 py-3 text-right sm:px-6"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {cierres.data.map((c) => (
                                        <tr key={c.id} className="hover:bg-muted/40">
                                            <td className="px-4 py-3 sm:px-6">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-xs">
                                                        {formatDate(c.periodo_fin)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 sm:px-6">
                                                {c.ejecutado_por?.name ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium sm:px-6">
                                                <MoneyDual
                                                    ars={Number(c.total_recaudado)}
                                                    tasa={c.tasa ? Number(c.tasa) : null}
                                                    orientation="stacked"
                                                    size="md"
                                                    className="items-end"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right sm:px-6">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.get(`/cierres-inversion/${c.id}`)
                                                    }
                                                >
                                                    Detalles
                                                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <ul className="divide-y divide-border md:hidden">
                            {cierres.data.map((c) => (
                                <li key={c.id} className="flex items-center justify-between p-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDate(c.periodo_fin)}
                                        </p>
                                        <div className="mt-0.5">
                                            <MoneyDual
                                                ars={Number(c.total_recaudado)}
                                                tasa={c.tasa ? Number(c.tasa) : null}
                                                orientation="stacked"
                                                size="md"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            por {c.ejecutado_por?.name ?? '—'}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.get(`/cierres-inversion/${c.id}`)}
                                    >
                                        Detalles
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Pagination */}
                {(cierres.prev_page_url || cierres.next_page_url) && (
                    <div className="flex items-center justify-between">
                        <Link
                            href={cierres.prev_page_url ?? '#'}
                            preserveScroll
                            className={
                                cierres.prev_page_url
                                    ? 'text-sm text-foreground hover:underline'
                                    : 'pointer-events-none text-sm text-muted-foreground/50'
                            }
                        >
                            ← Anterior
                        </Link>
                        <span className="text-xs text-muted-foreground">
                            Página {cierres.current_page} de {cierres.last_page}
                        </span>
                        <Link
                            href={cierres.next_page_url ?? '#'}
                            preserveScroll
                            className={
                                cierres.next_page_url
                                    ? 'text-sm text-foreground hover:underline'
                                    : 'pointer-events-none text-sm text-muted-foreground/50'
                            }
                        >
                            Siguiente →
                        </Link>
                    </div>
                )}
            </div>
        </>
    );
}

CierresIndex.layout = {
    breadcrumbs: [{ title: 'Cierres', href: '/cierres-inversion' }],
};
