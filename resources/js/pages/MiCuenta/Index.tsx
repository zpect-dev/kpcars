import { Head } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowDownCircle,
    ArrowUpCircle,
    Calendar,
    HandCoins,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { MoneyDual } from '@/components/money-dual';
import { cn } from '@/lib/utils';

interface Movimiento {
    id: number;
    tipo: 'cargo' | 'pago';
    monto: string;
    descripcion: string | null;
    created_at: string;
    registrado_por: { id: number; name: string } | null;
}

interface InversionRow {
    id: number;
    nombre: string;
    empresa: { id: number; nombre: string } | null;
    tiene_deuda: boolean;
    es_financiador: boolean;
    saldo: number;
    movimientos: Movimiento[];
}

interface CierreDetalle {
    inversion: string;
    concepto: string;
    monto: number;
}

interface CierreRow {
    id: number;
    periodo_inicio: string | null;
    periodo_fin: string;
    total: number;
    tasa: number | null;
    detalles: CierreDetalle[];
}

interface Props {
    inversiones: InversionRow[];
    cierres: CierreRow[];
    tasaActual: number | null;
}

const CONCEPTO_LABEL: Record<string, string> = {
    parte_completa: 'Parte completa',
    media_parte_deudor: 'Media parte (deudor)',
    cero_deudor: 'Cero (deudor 3ra+)',
    redistribucion_financiador: 'Redistribución como financiador',
};


function formatDate(d: string): string {
    return new Date(d).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function MiCuentaIndex({ inversiones, cierres, tasaActual }: Props) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [expandedCierres, setExpandedCierres] = useState<Set<number>>(new Set());

    function toggle(id: number) {
        setExpanded((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }

    function toggleCierre(id: number) {
        setExpandedCierres((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }

    const saldoTotal = inversiones.reduce((acc, i) => acc + i.saldo, 0);
    const totalCobradoCierres = cierres.reduce((acc, c) => acc + c.total, 0);

    return (
        <>
            <Head title="Mi Cuenta" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div>
                    <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                        Mi Cuenta
                    </h1>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Estado de tus inversiones y deuda.
                    </p>
                </div>

                {/* Resumen totales */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Saldo total de deuda
                        </p>
                        <div className="mt-1">
                            <MoneyDual
                                ars={saldoTotal}
                                tasa={tasaActual}
                                orientation="stacked"
                                size="xl"
                                arsClassName={
                                    saldoTotal > 0
                                        ? 'text-red-700 dark:text-red-400'
                                        : 'text-emerald-700 dark:text-emerald-400'
                                }
                            />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Suma pendiente en todas tus inversiones.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Total cobrado (histórico)
                        </p>
                        <div className="mt-1">
                            <MoneyDual
                                ars={totalCobradoCierres}
                                tasa={tasaActual}
                                orientation="stacked"
                                size="xl"
                            />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Suma de tus sueldos de todos los cierres.
                        </p>
                    </div>
                </div>

                {inversiones.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <Wallet className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            No estás asignado a ninguna inversión todavía.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {inversiones.map((inv) => {
                            const isOpen = expanded.has(inv.id);
                            return (
                                <div
                                    key={inv.id}
                                    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggle(inv.id)}
                                        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="truncate text-sm font-semibold text-foreground">
                                                    {inv.nombre}
                                                </p>
                                                {inv.tiene_deuda && (
                                                    <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Deuda
                                                    </span>
                                                )}
                                                {inv.es_financiador && (
                                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                                        <HandCoins className="h-3 w-3" />
                                                        Financia
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {inv.movimientos.length} movimiento
                                                {inv.movimientos.length === 1
                                                    ? ''
                                                    : 's'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-muted-foreground uppercase">
                                                Saldo
                                            </p>
                                            <MoneyDual
                                                ars={inv.saldo}
                                                tasa={tasaActual}
                                                orientation="stacked"
                                                size="md"
                                                className="items-end"
                                                arsClassName={cn(
                                                    inv.saldo > 0
                                                        ? 'text-red-700 dark:text-red-400'
                                                        : 'text-emerald-700 dark:text-emerald-400',
                                                )}
                                            />
                                        </div>
                                    </button>

                                    {isOpen && (
                                        <div className="border-t border-border">
                                            {inv.movimientos.length === 0 ? (
                                                <p className="p-4 text-center text-xs text-muted-foreground italic">
                                                    Sin movimientos registrados.
                                                </p>
                                            ) : (
                                                <ul className="divide-y divide-border">
                                                    {inv.movimientos.map((m) => (
                                                        <li
                                                            key={m.id}
                                                            className="flex items-start gap-3 px-4 py-3"
                                                        >
                                                            {m.tipo === 'cargo' ? (
                                                                <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                                                            ) : (
                                                                <ArrowDownCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <p className="text-sm font-semibold text-foreground">
                                                                        {m.tipo ===
                                                                        'cargo'
                                                                            ? 'Cargo'
                                                                            : 'Pago'}
                                                                    </p>
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                        <span
                                                                            className={`text-sm font-bold ${
                                                                                m.tipo ===
                                                                                'cargo'
                                                                                    ? 'text-red-700 dark:text-red-400'
                                                                                    : 'text-emerald-700 dark:text-emerald-400'
                                                                            }`}
                                                                        >
                                                                            {m.tipo ===
                                                                            'cargo'
                                                                                ? '+'
                                                                                : '−'}
                                                                        </span>
                                                                        <MoneyDual
                                                                            ars={Number(
                                                                                m.monto,
                                                                            )}
                                                                            tasa={
                                                                                tasaActual
                                                                            }
                                                                            size="md"
                                                                            arsClassName={
                                                                                m.tipo ===
                                                                                'cargo'
                                                                                    ? 'text-red-700 dark:text-red-400'
                                                                                    : 'text-emerald-700 dark:text-emerald-400'
                                                                            }
                                                                        />
                                                                    </span>
                                                                </div>
                                                                {m.descripcion && (
                                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                                        {
                                                                            m.descripcion
                                                                        }
                                                                    </p>
                                                                )}
                                                                <p className="mt-1 text-[11px] text-muted-foreground">
                                                                    {formatDate(
                                                                        m.created_at,
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Historial de cierres */}
                {cierres.length > 0 && (
                    <div>
                        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            Historial de Cierres
                        </h2>
                        <div className="space-y-2">
                            {cierres.map((c) => {
                                const isOpen = expandedCierres.has(c.id);
                                return (
                                    <div
                                        key={c.id}
                                        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggleCierre(c.id)}
                                            className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        Cierre #{c.id}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDate(c.periodo_fin)}
                                                    </p>
                                                </div>
                                            </div>
                                            <MoneyDual
                                                ars={c.total}
                                                tasa={c.tasa}
                                                orientation="stacked"
                                                size="md"
                                                className="shrink-0 items-end"
                                                arsClassName="text-emerald-700 dark:text-emerald-400"
                                            />
                                        </button>
                                        {isOpen && (
                                            <div className="border-t border-border bg-muted/10 px-4 py-2">
                                                <table className="w-full text-xs">
                                                    <thead className="text-muted-foreground uppercase">
                                                        <tr>
                                                            <th className="py-1 text-left font-medium">
                                                                Inversión
                                                            </th>
                                                            <th className="py-1 text-left font-medium">
                                                                Concepto
                                                            </th>
                                                            <th className="py-1 text-right font-medium">
                                                                Monto
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {c.detalles.map((d, idx) => (
                                                            <tr
                                                                key={idx}
                                                                className="border-t border-border/50"
                                                            >
                                                                <td className="py-1.5">{d.inversion}</td>
                                                                <td className="py-1.5 text-muted-foreground">
                                                                    {CONCEPTO_LABEL[d.concepto] ?? d.concepto}
                                                                </td>
                                                                <td className="py-1.5 text-right font-medium">
                                                                    <MoneyDual
                                                                        ars={d.monto}
                                                                        tasa={c.tasa}
                                                                        size="sm"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

MiCuentaIndex.layout = {
    breadcrumbs: [{ title: 'Mi Cuenta', href: '/mi-cuenta' }],
};
