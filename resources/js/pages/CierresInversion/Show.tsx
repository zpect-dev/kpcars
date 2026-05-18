import { Head, router } from '@inertiajs/react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyDual } from '@/components/money-dual';

interface Cierre {
    id: number;
    periodo_fin: string;
    total_recaudado: number;
    tasa: number | null;
}

interface Recaudacion {
    inversion: string;
    monto: number;
}

interface PorInversor {
    user: { id: number; name: string; dni: string };
    total: number;
}

interface Props {
    cierre: Cierre;
    recaudaciones: Recaudacion[];
    porInversor: PorInversor[];
}

function formatUSD(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(value);
}

function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

function formatCierreDate(d: string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export default function CierresShow({
    cierre,
    recaudaciones,
    porInversor,
}: Props) {
    const totalRecaudadoUsd =
        cierre.tasa && cierre.tasa > 0
            ? cierre.total_recaudado / cierre.tasa
            : 0;

    return (
        <>
            <Head title={`Cierre ${formatCierreDate(cierre.periodo_fin)}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.get('/cierres-inversion')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Volver</span>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            Cierre {formatCierreDate(cierre.periodo_fin)}
                        </h1>
                    </div>
                </div>

                {/* Totales */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Recaudado (ARS)
                        </p>
                        <p className="mt-1 text-2xl font-bold text-foreground">
                            {formatARS(cierre.total_recaudado)}
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Recaudado (USD)
                        </p>
                        <p className="mt-1 text-2xl font-bold text-foreground">
                            {formatUSD(totalRecaudadoUsd)}
                        </p>
                        {cierre.tasa && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                Tasa: {formatARS(cierre.tasa)} / USD
                            </p>
                        )}
                    </div>
                </div>

                {/* Dos columnas: Recaudaciones | Sueldo por inversor */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Recaudaciones */}
                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">
                            Recaudado por inversión
                        </h3>
                        {recaudaciones.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">
                                Sin recaudación registrada.
                            </p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {[...recaudaciones]
                                    .sort((a, b) =>
                                        (a.inversion ?? '').localeCompare(
                                            b.inversion ?? '',
                                            'es',
                                            {
                                                numeric: true,
                                                sensitivity: 'base',
                                            },
                                        ),
                                    )
                                    .map((r, idx) => (
                                        <li
                                            key={idx}
                                            className="flex items-center justify-between gap-3 py-2"
                                        >
                                            <span className="text-sm text-foreground">
                                                {r.inversion}
                                            </span>
                                            <MoneyDual
                                                ars={r.monto}
                                                tasa={cierre.tasa}
                                                orientation="stacked"
                                                size="sm"
                                                className="shrink-0 items-end"
                                            />
                                        </li>
                                    ))}
                            </ul>
                        )}
                    </div>

                    {/* Sueldo por inversor */}
                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">
                            Sueldo por inversor
                        </h3>
                        {porInversor.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">
                                Sin pagos en este cierre.
                            </p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {porInversor.map((row) => (
                                    <li key={row.user.id}>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.get(
                                                    `/cierres-inversion/${cierre.id}/inversor/${row.user.id}`,
                                                )
                                            }
                                            className="flex w-full items-center justify-between gap-3 py-2 text-left transition-colors hover:bg-muted/40"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-foreground">
                                                    {row.user.name}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <MoneyDual
                                                    ars={row.total}
                                                    tasa={cierre.tasa}
                                                    orientation="stacked"
                                                    size="sm"
                                                    className="items-end"
                                                />
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

CierresShow.layout = {
    breadcrumbs: [
        { title: 'Cierres', href: '/cierres-inversion' },
        { title: 'Detalle' },
    ],
};
