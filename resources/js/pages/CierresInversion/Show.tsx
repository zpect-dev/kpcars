import { Head, router } from '@inertiajs/react';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MoneyDual } from '@/components/money-dual';

interface Cierre {
    id: number;
    periodo_inicio: string | null;
    periodo_fin: string;
    total_recaudado: number;
    tasa: number | null;
    total_distribuido: number;
    ejecutado_por: { id: number; name: string } | null;
    created_at: string;
}

interface Recaudacion {
    inversion: string;
    monto: number;
}

interface DetallePago {
    inversion: string;
    concepto: string;
    monto: number;
}

interface PorInversor {
    user: { id: number; name: string; dni: string };
    total: number;
    detalles: DetallePago[];
}

interface Props {
    cierre: Cierre;
    recaudaciones: Recaudacion[];
    porInversor: PorInversor[];
}

const CONCEPTO_LABEL: Record<string, string> = {
    parte_completa: 'Parte completa',
    media_parte_deudor: 'Media parte (deudor)',
    cero_deudor: 'Cero (deudor 3ra+)',
    redistribucion_financiador: 'Redistribución (financiador)',
};

const CONCEPTO_COLOR: Record<string, string> = {
    parte_completa: 'text-foreground',
    media_parte_deudor: 'text-amber-700 dark:text-amber-400',
    cero_deudor: 'text-muted-foreground',
    redistribucion_financiador: 'text-emerald-700 dark:text-emerald-400',
};

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

function formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CierresShow({ cierre, recaudaciones, porInversor }: Props) {
    const totalRecaudadoUsd = cierre.tasa && cierre.tasa > 0
        ? cierre.total_recaudado / cierre.tasa
        : 0;
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    function toggle(userId: number) {
        setExpanded((prev) => {
            const n = new Set(prev);
            if (n.has(userId)) n.delete(userId);
            else n.add(userId);
            return n;
        });
    }

    return (
        <>
            <Head title={`Cierre #${cierre.id}`} />

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
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                            Cierre #{cierre.id}
                        </h1>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(cierre.periodo_inicio)} → {formatDate(cierre.periodo_fin)}
                            {cierre.ejecutado_por && (
                                <span> · por {cierre.ejecutado_por.name}</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Totales */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Total distribuido
                        </p>
                        <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                            {formatARS(cierre.total_distribuido)}
                        </p>
                    </div>
                </div>

                {/* Recaudaciones */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                        Recaudación por inversión
                    </h3>
                    <ul className="divide-y divide-border">
                        {recaudaciones.map((r, idx) => {
                            const usd =
                                cierre.tasa && cierre.tasa > 0
                                    ? r.monto / cierre.tasa
                                    : 0;
                            return (
                                <li
                                    key={idx}
                                    className="flex items-center justify-between gap-3 py-2"
                                >
                                    <span className="text-sm text-foreground">
                                        {r.inversion}
                                    </span>
                                    <div className="flex items-center gap-4 text-sm font-medium">
                                        <span>{formatARS(r.monto)}</span>
                                        {cierre.tasa && (
                                            <span className="text-muted-foreground">
                                                {formatUSD(usd)}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Pagos por inversor */}
                <div className="rounded-xl border border-border bg-card shadow-sm">
                    <h3 className="border-b border-border p-4 text-sm font-semibold text-foreground">
                        Sueldo por inversor
                    </h3>
                    {porInversor.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground italic">
                            Sin pagos en este cierre.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {porInversor.map((row) => {
                                const isOpen = expanded.has(row.user.id);
                                return (
                                    <li key={row.user.id}>
                                        <button
                                            type="button"
                                            onClick={() => toggle(row.user.id)}
                                            className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isOpen ? (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {row.user.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        DNI {row.user.dni}
                                                    </p>
                                                </div>
                                            </div>
                                            <MoneyDual
                                                ars={row.total}
                                                tasa={cierre.tasa}
                                                orientation="stacked"
                                                size="md"
                                                className="shrink-0 items-end"
                                            />
                                        </button>
                                        {isOpen && (
                                            <div className="border-t border-border bg-muted/20 px-4 py-2">
                                                <table className="w-full text-xs">
                                                    <thead className="text-muted-foreground uppercase">
                                                        <tr>
                                                            <th className="py-1 text-left font-medium">Inversión</th>
                                                            <th className="py-1 text-left font-medium">Concepto</th>
                                                            <th className="py-1 text-right font-medium">Monto</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {row.detalles.map((d, idx) => (
                                                            <tr key={idx} className="border-t border-border/50">
                                                                <td className="py-1.5">{d.inversion}</td>
                                                                <td
                                                                    className={`py-1.5 ${CONCEPTO_COLOR[d.concepto] ?? ''}`}
                                                                >
                                                                    {CONCEPTO_LABEL[d.concepto] ?? d.concepto}
                                                                </td>
                                                                <td className="py-1.5 text-right font-medium">
                                                                    <MoneyDual
                                                                        ars={d.monto}
                                                                        tasa={cierre.tasa}
                                                                        size="sm"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
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
