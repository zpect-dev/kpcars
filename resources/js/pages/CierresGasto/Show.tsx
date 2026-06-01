import { Head } from '@inertiajs/react';
import { ArrowLeft, FileDown, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Cierre {
    id: number;
    periodo_inicio: string | null;
    periodo_fin: string;
    total_general: number;
    ejecutado_por: string | null;
    created_at: string | null;
}

interface PorTipo {
    tipo: string;
    total: number;
}

interface PorVehiculo {
    patente: string;
    total: number;
}

interface Props {
    cierre: Cierre;
    porTipo: PorTipo[];
    porVehiculo: PorVehiculo[];
}

const TIPO_LABEL: Record<string, string> = {
    galpon: 'Galpón',
    taller: 'Taller',
    oficina: 'Oficina',
    kevin: 'Kevin',
    stock: 'Stock',
};

function formatFecha(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatARS(n: number): string {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

export default function CierresGastoShow({ cierre, porTipo, porVehiculo }: Props) {
    return (
        <>
            <Head title={`Cierre de Gastos #${cierre.id}`} />

            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => history.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight text-foreground">
                                Cierre de Gastos #{cierre.id}
                            </h1>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {cierre.periodo_inicio ? `${formatFecha(cierre.periodo_inicio)} – ` : ''}
                                {formatFecha(cierre.periodo_fin)}
                                {cierre.ejecutado_por ? ` · ${cierre.ejecutado_por}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/pdf/cierres-gasto/${cierre.id}`} target="_blank" rel="noreferrer">
                                <FileDown className="mr-1.5 h-4 w-4" /> PDF
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/excel/cierres-gasto/${cierre.id}`}>
                                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Total general */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Total del cierre</p>
                    <p className="text-2xl font-bold text-foreground">{formatARS(cierre.total_general)}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Por categoría */}
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground">
                            Por categoría
                        </div>
                        {porTipo.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin gastos de categorías generales.</p>
                        ) : (
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-border">
                                    {porTipo.map((r) => (
                                        <tr key={r.tipo} className="hover:bg-muted/20">
                                            <td className="px-4 py-2.5 text-foreground">{TIPO_LABEL[r.tipo] ?? r.tipo}</td>
                                            <td className="px-4 py-2.5 text-right font-medium text-foreground">{formatARS(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Por vehículo */}
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground">
                            Por vehículo (patente)
                        </div>
                        {porVehiculo.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin gastos de vehículos.</p>
                        ) : (
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-border">
                                    {porVehiculo.map((r) => (
                                        <tr key={r.patente} className="hover:bg-muted/20">
                                            <td className="px-4 py-2.5 font-mono text-foreground">{r.patente}</td>
                                            <td className="px-4 py-2.5 text-right font-medium text-foreground">{formatARS(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

CierresGastoShow.layout = {
    breadcrumbs: [{ title: 'Cierres de Gastos', href: '/cierres-gasto' }],
};
