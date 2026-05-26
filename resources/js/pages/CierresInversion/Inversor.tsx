import { Head, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyDual } from '@/components/money-dual';
import { CONCEPTO_LABEL, CONCEPTO_COLOR } from '@/lib/concepto';

interface CierreRef {
    id: number;
    periodo_inicio: string | null;
    periodo_fin: string | null;
    tasa: number | null;
}

interface Inversor {
    id: number;
    name: string;
    dni: string;
}

interface DetallePago {
    inversion: string | null;
    concepto: string;
    monto: number;
}

interface HistoricoRow {
    cierre: CierreRef;
    total: number;
    detalles: DetallePago[];
}

interface Props {
    cierre: CierreRef;
    inversor: Inversor;
    detalleCierre: DetallePago[];
    totalCierre: number;
    totalCierrePropio: number;
    totalCierreFinanciador: number;
    historico: HistoricoRow[];
    totalHistorico: number;
}


function formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function DesgloseSeparado({
    titulo,
    detalles,
    tasa,
    totalPropio,
    totalFinanciador,
    compact = false,
}: {
    titulo?: string;
    detalles: DetallePago[];
    tasa: number | null;
    totalPropio?: number;
    totalFinanciador?: number;
    compact?: boolean;
}) {
    const propios = detalles.filter(
        (d) => d.concepto !== 'redistribucion_financiador',
    );
    const financiador = detalles.filter(
        (d) => d.concepto === 'redistribucion_financiador',
    );

    const subtotalPropio =
        totalPropio ?? propios.reduce((acc, d) => acc + d.monto, 0);
    const subtotalFinanciador =
        totalFinanciador ?? financiador.reduce((acc, d) => acc + d.monto, 0);

    return (
        <div
            className={
                compact
                    ? 'flex flex-col gap-2'
                    : 'rounded-xl border border-border bg-card p-4 shadow-sm'
            }
        >
            {titulo && (
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                    {titulo}
                </h3>
            )}
            <div className="flex flex-col gap-3">
                <SubseccionDesglose
                    titulo="Parte propia"
                    detalles={propios}
                    subtotal={subtotalPropio}
                    tasa={tasa}
                    emptyText="Sin parte propia en este cierre."
                />
                {(financiador.length > 0 || subtotalFinanciador > 0) && (
                    <SubseccionDesglose
                        titulo="Por financiador"
                        detalles={financiador}
                        subtotal={subtotalFinanciador}
                        tasa={tasa}
                        emptyText="Sin redistribución por financiador."
                    />
                )}
            </div>
        </div>
    );
}

function SubseccionDesglose({
    titulo,
    detalles,
    subtotal,
    tasa,
    emptyText,
}: {
    titulo: string;
    detalles: DetallePago[];
    subtotal: number;
    tasa: number | null;
    emptyText: string;
}) {
    return (
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    {titulo}
                </span>
                <MoneyDual
                    ars={subtotal}
                    tasa={tasa}
                    orientation="horizontal"
                    size="sm"
                    arsClassName="font-semibold text-foreground"
                />
            </div>
            {detalles.length === 0 ? (
                <p className="py-1 text-[11px] text-muted-foreground italic">
                    {emptyText}
                </p>
            ) : (
                <DetallesTable detalles={detalles} tasa={tasa} />
            )}
        </div>
    );
}

function DetallesTable({
    detalles,
    tasa,
}: {
    detalles: DetallePago[];
    tasa: number | null;
}) {
    return (
        <table className="w-full text-xs">
            <thead className="text-muted-foreground uppercase">
                <tr>
                    <th className="py-1.5 text-left font-medium">Inversión</th>
                    <th className="py-1.5 text-left font-medium">Concepto</th>
                    <th className="py-1.5 text-right font-medium">Monto</th>
                </tr>
            </thead>
            <tbody>
                {detalles.map((d, idx) => (
                    <tr key={idx} className="border-t border-border/50">
                        <td className="py-1.5">{d.inversion ?? '—'}</td>
                        <td className={`py-1.5 ${CONCEPTO_COLOR[d.concepto] ?? ''}`}>
                            {CONCEPTO_LABEL[d.concepto] ?? d.concepto}
                        </td>
                        <td className="py-1.5 text-right font-medium">
                            <MoneyDual ars={d.monto} tasa={tasa} size="sm" />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function FacturaCierre({
    cierre,
    inversor,
    detalles,
    totalPropio,
    totalFinanciador,
    total,
}: {
    cierre: CierreRef;
    inversor: Inversor;
    detalles: DetallePago[];
    totalPropio: number;
    totalFinanciador: number;
    total: number;
}) {
    const propios = detalles.filter((d) => d.concepto !== 'redistribucion_financiador');
    const financiador = detalles.filter((d) => d.concepto === 'redistribucion_financiador');

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {/* Encabezado */}
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                        Recibo
                    </p>
                    <h2 className="mt-1 text-base font-bold text-foreground">
                        Cierre {formatDate(cierre.periodo_fin)}
                    </h2>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                        N° {cierre.id}
                    </p>
                </div>
                <div className="sm:text-right">
                    <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        Inversor
                    </p>
                    <p className="text-sm font-semibold text-foreground">{inversor.name}</p>
                    <p className="text-xs text-muted-foreground">DNI {inversor.dni}</p>
                </div>
            </div>

            {/* Líneas */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/20 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        <tr>
                            <th className="px-5 py-2.5 text-left">Inversión</th>
                            <th className="px-5 py-2.5 text-left">Concepto</th>
                            <th className="px-5 py-2.5 text-right">Monto</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {propios.length === 0 && financiador.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-5 py-6 text-center text-xs text-muted-foreground italic">
                                    Sin movimientos en este cierre.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {propios.map((d, idx) => (
                                    <tr key={`p-${idx}`}>
                                        <td className="px-5 py-2.5">{d.inversion ?? '—'}</td>
                                        <td className={`px-5 py-2.5 ${CONCEPTO_COLOR[d.concepto] ?? ''}`}>
                                            {CONCEPTO_LABEL[d.concepto] ?? d.concepto}
                                        </td>
                                        <td className="px-5 py-2.5 text-right font-medium">
                                            <MoneyDual ars={d.monto} tasa={cierre.tasa} size="sm" className="justify-end" />
                                        </td>
                                    </tr>
                                ))}
                                {financiador.map((d, idx) => (
                                    <tr key={`f-${idx}`}>
                                        <td className="px-5 py-2.5">{d.inversion ?? '—'}</td>
                                        <td className={`px-5 py-2.5 ${CONCEPTO_COLOR[d.concepto] ?? ''}`}>
                                            {CONCEPTO_LABEL[d.concepto] ?? d.concepto}
                                        </td>
                                        <td className="px-5 py-2.5 text-right font-medium">
                                            <MoneyDual ars={d.monto} tasa={cierre.tasa} size="sm" className="justify-end" />
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Totales tipo factura */}
            <div className="flex flex-col gap-1 border-t border-border bg-muted/20 px-5 py-4">
                {totalPropio !== 0 && (
                    <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">Subtotal parte propia</span>
                        <MoneyDual ars={totalPropio} tasa={cierre.tasa} size="sm" className="justify-end" />
                    </div>
                )}
                {totalFinanciador !== 0 && (
                    <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">Subtotal por financiador</span>
                        <MoneyDual ars={totalFinanciador} tasa={cierre.tasa} size="sm" className="justify-end" />
                    </div>
                )}
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                    <span className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
                        Total a cobrar
                    </span>
                    <MoneyDual
                        ars={total}
                        tasa={cierre.tasa}
                        orientation="horizontal"
                        size="lg"
                        arsClassName="text-emerald-700 dark:text-emerald-400 font-bold"
                        className="justify-end"
                    />
                </div>
            </div>
        </div>
    );
}

export default function InversorDetalle({
    cierre,
    inversor,
    detalleCierre,
    totalCierre,
    totalCierrePropio,
    totalCierreFinanciador,
    historico,
}: Props) {
    return (
        <>
            <Head title={`${inversor.name} · Cierre #${cierre.id}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            router.get(`/cierres-inversion/${cierre.id}`)
                        }
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Volver al cierre</span>
                    </Button>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                            {inversor.name}
                        </h1>
                    </div>
                </div>

                {/* Detalle estilo factura */}
                <FacturaCierre
                    cierre={cierre}
                    inversor={inversor}
                    detalles={detalleCierre}
                    totalPropio={totalCierrePropio}
                    totalFinanciador={totalCierreFinanciador}
                    total={totalCierre}
                />

                {/* Histórico */}
                <div className="rounded-xl border border-border bg-card shadow-sm">
                    <h3 className="border-b border-border p-4 text-sm font-semibold text-foreground">
                        Histórico de pagos
                    </h3>
                    {historico.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground italic">
                            Sin pagos en cierres anteriores.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {historico.map((row) => (
                                <li key={row.cierre.id} className="p-4">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.get(
                                                `/cierres-inversion/${row.cierre.id}/inversor/${inversor.id}`,
                                            )
                                        }
                                        className="mb-2 flex w-full items-center justify-between gap-3 text-left transition-colors hover:opacity-80"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">
                                                Cierre #{row.cierre.id}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {formatDate(
                                                    row.cierre.periodo_inicio,
                                                )}{' '}
                                                →{' '}
                                                {formatDate(row.cierre.periodo_fin)}
                                            </p>
                                        </div>
                                        <MoneyDual
                                            ars={row.total}
                                            tasa={row.cierre.tasa}
                                            orientation="stacked"
                                            size="md"
                                            className="shrink-0 items-end"
                                        />
                                    </button>
                                    <DesgloseSeparado
                                        detalles={row.detalles}
                                        tasa={row.cierre.tasa}
                                        compact
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    );
}

InversorDetalle.layout = {
    breadcrumbs: [
        { title: 'Cierres', href: '/cierres-inversion' },
        { title: 'Detalle' },
    ],
};
