import { Head, Link, router } from '@inertiajs/react';
import { Calendar, ChevronRight, Lock } from 'lucide-react';
import { MoneyDual } from '@/components/money-dual';
import { cn } from '@/lib/utils';

interface Cierre {
    id: number;
    fecha: string | null;
    tasa: number;
    ejecutado_por: { id: number; name: string } | null;
    total_pagado: number;
    total_abonado: number;
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

function formatFecha(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export default function CierresSueldoIndex({ cierres }: Props) {
    return (
        <>
            <Head title="Cierres de Sueldo" />

            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">

                {/* Header */}
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                        Cierres de Sueldo
                    </h1>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Cada cierre se genera automáticamente al cerrar la
                        recaudación de las dos empresas.
                    </p>
                </div>

                {/* List */}
                {cierres.data.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Lock className="h-6 w-6" />
                        </div>
                        <span className="text-base font-semibold text-foreground">Sin cierres</span>
                        <span className="text-sm text-muted-foreground">
                            Los cierres aparecen acá cuando ejecutás el cierre
                            unificado desde Recaudaciones.
                        </span>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-border bg-card">
                        {cierres.data.map((c, i, arr) => {
                            const isLast = i === arr.length - 1;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => router.get(`/cierres-sueldo/${c.id}`)}
                                    className={cn(
                                        'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/40',
                                        !isLast && 'border-b border-border',
                                    )}
                                >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Calendar className="h-4 w-4" />
                                    </div>

                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="text-sm font-semibold text-foreground">
                                            Cierre #{c.id}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatFecha(c.fecha)}
                                            {c.ejecutado_por && ` · ${c.ejecutado_por.name}`}
                                            {c.total_abonado > 0 && ' · con abonos de deuda'}
                                        </span>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-3">
                                        <MoneyDual
                                            ars={Number(c.total_pagado)}
                                            tasa={c.tasa ? Number(c.tasa) : null}
                                            orientation="stacked"
                                            size="sm"
                                            className="items-end"
                                        />
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {(cierres.prev_page_url || cierres.next_page_url) && (
                    <div className="flex items-center justify-between">
                        <Link
                            href={cierres.prev_page_url ?? '#'}
                            preserveScroll
                            className={cn(
                                'text-sm',
                                cierres.prev_page_url
                                    ? 'text-foreground hover:underline'
                                    : 'pointer-events-none text-muted-foreground/50',
                            )}
                        >
                            ← Anterior
                        </Link>
                        <span className="text-xs text-muted-foreground">
                            Página {cierres.current_page} de {cierres.last_page}
                        </span>
                        <Link
                            href={cierres.next_page_url ?? '#'}
                            preserveScroll
                            className={cn(
                                'text-sm',
                                cierres.next_page_url
                                    ? 'text-foreground hover:underline'
                                    : 'pointer-events-none text-muted-foreground/50',
                            )}
                        >
                            Siguiente →
                        </Link>
                    </div>
                )}
            </div>
        </>
    );
}

CierresSueldoIndex.layout = {
    breadcrumbs: [{ title: 'Cierres de Sueldo', href: '/cierres-sueldo' }],
};
