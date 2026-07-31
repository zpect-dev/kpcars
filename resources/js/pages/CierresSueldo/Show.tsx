import { Head, router } from '@inertiajs/react';
import {
    Building2,
    Check,
    ChevronDown,
    Coins,
    Download,
    FileSpreadsheet,
    HandCoins,
    Plus,
    SlidersHorizontal,
    TrendingUp,
    Trash2,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatARS, formatUSD } from '@/components/money-dual';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import { CONCEPTO_LABEL, CONCEPTO_PILL } from '@/lib/concepto';
import { cn } from '@/lib/utils';

interface Detalle {
    inversion: string | null;
    concepto: string;
    monto: number;
}

interface InversorRow {
    user: { id: number; name: string; dni: string | null };
    total: number;
    detalles: Detalle[];
}

interface EmpresaBlock {
    id: number;
    nombre: string;
    recaudado: number;
    distribuido: number;
    recaudaciones: { inversion: string; monto: number }[];
    porInversor: InversorRow[];
}

interface Abono {
    user: { id: number; name: string };
    inversion: string | null;
    empresa_id: number | null;
    monto: number;
}

interface SocioDecision {
    user: { id: number; name: string; dni: string | null };
    abona: boolean;
    abono_monto: number;
    sueldo_generado: number;
}

interface ComposicionSocio {
    user: { id: number; name: string; dni: string | null };
    saldo: number;
    es_financiador: boolean;
    es_deudor: boolean;
}

interface ComposicionInversion {
    id: number;
    nombre: string;
    recaudado: number;
    autos: number;
    /** Completa = tiene los 10 autos; si no, la deuda se marca con un check. */
    completa: boolean;
    socios: ComposicionSocio[];
    candidatos: { id: number; name: string; dni: string | null }[];
}

interface ComposicionEmpresa {
    id: number;
    nombre: string;
    inversiones: ComposicionInversion[];
}

interface Props {
    cierre: {
        id: number;
        fecha: string | null;
        tasa: number;
        ejecutado_por: { id: number; name: string } | null;
    };
    empresas: EmpresaBlock[];
    porSocio: {
        user: { id: number; name: string; dni: string | null };
        total: number;
    }[];
    abonos: Abono[];
    socios: SocioDecision[];
    composicion: ComposicionEmpresa[];
    puedeEditar: boolean;
    totales: { recaudado: number; distribuido: number; abonado: number };
}

function formatFecha(d: string | null): string {
    if (!d) {
        return '—';
    }

    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? '')
        .join('');
}

function toUSD(ars: number, tasa: number): number | null {
    return tasa > 0 ? ars / tasa : null;
}

/**
 * Agrupa los detalles por inversión: cada inversión rinde una sola fila con su
 * concepto base (parte / media parte / cero) y, aparte, la redistribución del
 * financiador si la hubiera (misma inversión, columna propia).
 */
function groupDetalles(detalles: Detalle[]) {
    const map = new Map<
        string,
        {
            inversion: string | null;
            base: Detalle | null;
            redistribucion: Detalle | null;
        }
    >();
    const orden: string[] = [];

    for (const d of detalles) {
        const key = d.inversion ?? '—';

        if (!map.has(key)) {
            map.set(key, {
                inversion: d.inversion,
                base: null,
                redistribucion: null,
            });
            orden.push(key);
        }

        const entry = map.get(key)!;

        if (d.concepto === 'redistribucion_financiador') {
            entry.redistribucion = d;
        } else {
            entry.base = d;
        }
    }

    return orden.map((k) => map.get(k)!);
}

/**
 * Tabla de detalle de un socio: una fila por inversión (Monto base +
 * Redistribución en columnas propias, agrupadas a la derecha) con su Total,
 * más una fila de totales al pie y el abono de deuda como nota aparte.
 */
function DetalleInversiones({
    detalles,
    abonoTotal,
}: {
    detalles: Detalle[];
    abonoTotal: number;
}) {
    const grupos = groupDetalles(detalles);
    const totMonto = grupos.reduce((s, g) => s + (g.base?.monto ?? 0), 0);
    const totRedis = grupos.reduce(
        (s, g) => s + (g.redistribucion?.monto ?? 0),
        0,
    );
    const totGeneral = totMonto + totRedis;

    // Banda de fondo continua para destacar la columna Total.
    const totalCol = 'bg-foreground/[0.04]';

    return (
        <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                        <th className="px-3 py-2 pl-4 text-left font-semibold whitespace-nowrap">
                            Inversión
                        </th>
                        <th className="w-full px-3 py-2 text-left font-semibold">
                            Concepto
                        </th>
                        <th className="px-3 py-2 pl-6 text-right font-semibold whitespace-nowrap">
                            Monto
                        </th>
                        <th className="px-3 py-2 pl-6 text-right font-semibold whitespace-nowrap">
                            Redistribución
                        </th>
                        <th
                            className={cn(
                                'px-3 py-2 pr-4 pl-6 text-right font-semibold whitespace-nowrap text-foreground',
                                totalCol,
                            )}
                        >
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                    {grupos.map((g, j) => {
                        const rowTotal =
                            (g.base?.monto ?? 0) +
                            (g.redistribucion?.monto ?? 0);
                        const esFinanciador = !!g.redistribucion;

                        return (
                            <tr
                                key={j}
                                className={cn(
                                    'transition-colors hover:bg-accent/30',
                                    esFinanciador
                                        ? 'bg-violet-500/[0.06]'
                                        : j % 2 === 1 &&
                                              'bg-foreground/[0.015]',
                                )}
                            >
                                <td className="px-3 py-2 pl-4 font-semibold whitespace-nowrap text-foreground">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span
                                            className={cn(
                                                'h-1.5 w-1.5 rounded-full',
                                                esFinanciador
                                                    ? 'bg-violet-500'
                                                    : 'bg-border',
                                            )}
                                        />
                                        {g.inversion ?? '—'}
                                    </span>
                                </td>
                                <td className="px-3 py-2">
                                    {g.base ? (
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
                                                CONCEPTO_PILL[
                                                    g.base.concepto
                                                ] ??
                                                    'border-border bg-muted text-muted-foreground',
                                            )}
                                        >
                                            {CONCEPTO_LABEL[g.base.concepto] ??
                                                g.base.concepto}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground/50">
                                            —
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 pl-6 text-right whitespace-nowrap text-foreground tabular-nums">
                                    {g.base ? (
                                        formatARS(g.base.monto)
                                    ) : (
                                        <span className="text-muted-foreground/40">
                                            —
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 pl-6 text-right whitespace-nowrap tabular-nums">
                                    {g.redistribucion ? (
                                        <span className="font-medium text-violet-500 dark:text-violet-400">
                                            +{' '}
                                            {formatARS(g.redistribucion.monto)}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground/40">
                                            —
                                        </span>
                                    )}
                                </td>
                                <td
                                    className={cn(
                                        'px-3 py-2 pr-4 pl-6 text-right font-bold whitespace-nowrap text-foreground tabular-nums',
                                        totalCol,
                                    )}
                                >
                                    {formatARS(rowTotal)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-border bg-muted/60">
                        <td
                            className="px-3 py-2.5 pl-4 text-[11px] font-bold tracking-wider text-foreground uppercase"
                            colSpan={2}
                        >
                            Total
                        </td>
                        <td className="px-3 py-2.5 pl-6 text-right font-semibold whitespace-nowrap text-foreground tabular-nums">
                            {formatARS(totMonto)}
                        </td>
                        <td className="px-3 py-2.5 pl-6 text-right font-semibold whitespace-nowrap tabular-nums">
                            {totRedis > 0 ? (
                                <span className="text-violet-500 dark:text-violet-400">
                                    + {formatARS(totRedis)}
                                </span>
                            ) : (
                                <span className="text-muted-foreground/40">
                                    —
                                </span>
                            )}
                        </td>
                        <td
                            className={cn(
                                'px-3 py-2.5 pr-4 pl-6 text-right text-sm font-extrabold whitespace-nowrap text-emerald-600 tabular-nums dark:text-emerald-400',
                                totalCol,
                            )}
                        >
                            {formatARS(totGeneral)}
                        </td>
                    </tr>
                    {abonoTotal > 0 && (
                        <tr className="border-t border-border/60 bg-emerald-500/[0.06]">
                            <td
                                className="px-3 py-2 pl-4 text-emerald-600 dark:text-emerald-400"
                                colSpan={2}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <HandCoins className="h-3.5 w-3.5" />
                                    Abono aplicado a su deuda
                                </span>
                            </td>
                            <td
                                className="px-3 py-2 pr-4 pl-6 text-right font-semibold whitespace-nowrap text-emerald-600 tabular-nums dark:text-emerald-400"
                                colSpan={3}
                            >
                                − {formatARS(abonoTotal)}
                            </td>
                        </tr>
                    )}
                </tfoot>
            </table>
        </div>
    );
}

export default function CierreSueldoShow({
    cierre,
    empresas,
    porSocio,
    abonos,
    socios,
    composicion,
    puedeEditar,
    totales,
}: Props) {
    const sociosCount = porSocio.length;
    const totalCards = empresas.length + 1;
    const [mostrarDeudores, setMostrarDeudores] = useState(false);
    const [mostrarComposicion, setMostrarComposicion] = useState(false);

    return (
        <>
            <Head title={`Cierre de Sueldos #${cierre.id}`} />

            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                            Cierre de Sueldos #{cierre.id}
                        </h1>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="rounded-md border border-border bg-muted/60 px-2.5 py-0.5 text-muted-foreground">
                                {formatFecha(cierre.fecha)}
                            </span>
                            {cierre.ejecutado_por && (
                                <span className="rounded-md border border-border bg-muted/60 px-2.5 py-0.5 text-muted-foreground">
                                    Por {cierre.ejecutado_por.name}
                                </span>
                            )}
                            <span className="rounded-md border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
                                Tasa {formatARS(cierre.tasa)} / USD
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {puedeEditar && composicion.length > 0 && (
                            <Button
                                variant={
                                    mostrarComposicion ? 'default' : 'outline'
                                }
                                size="sm"
                                onClick={() => setMostrarComposicion((v) => !v)}
                                aria-expanded={mostrarComposicion}
                            >
                                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                                Composición
                                <ChevronDown
                                    className={cn(
                                        'ml-1.5 h-4 w-4 transition-transform',
                                        mostrarComposicion && 'rotate-180',
                                    )}
                                />
                            </Button>
                        )}
                        {socios.length > 0 && (
                            <Button
                                variant={
                                    mostrarDeudores ? 'default' : 'outline'
                                }
                                size="sm"
                                onClick={() => setMostrarDeudores((v) => !v)}
                                aria-expanded={mostrarDeudores}
                            >
                                <HandCoins className="mr-1.5 h-4 w-4" />
                                Deudores
                                <ChevronDown
                                    className={cn(
                                        'ml-1.5 h-4 w-4 transition-transform',
                                        mostrarDeudores && 'rotate-180',
                                    )}
                                />
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                window.open(
                                    `/pdf/cierres-sueldo/${cierre.id}`,
                                    '_blank',
                                )
                            }
                        >
                            <Download className="mr-1.5 h-4 w-4" />
                            PDF
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                window.open(
                                    `/excel/cierres-sueldo/${cierre.id}`,
                                    '_blank',
                                )
                            }
                        >
                            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                            Excel
                        </Button>
                    </div>
                </div>

                {/* ── Hero: números grandes del cierre ───────────────────── */}
                <div
                    className="grid grid-cols-2 gap-3 lg:[grid-template-columns:repeat(var(--hero-cols),minmax(0,1fr))]"
                    style={{ '--hero-cols': totalCards } as React.CSSProperties}
                >
                    {empresas.map((e) => (
                        <HeroStat
                            key={e.id}
                            label={`Recaudado · ${e.nombre}`}
                            ars={e.recaudado}
                            tasa={cierre.tasa}
                            icon={Coins}
                            tone="orange"
                            sub={`${e.recaudaciones.length} inversión${e.recaudaciones.length !== 1 ? 'es' : ''} con recaudación`}
                        />
                    ))}
                    <HeroStat
                        label="Distribuido en sueldos"
                        ars={totales.distribuido}
                        tasa={cierre.tasa}
                        icon={TrendingUp}
                        tone="ok"
                        sub={`entre ${sociosCount} socio${sociosCount !== 1 ? 's' : ''}`}
                    />
                </div>

                {/* ── Decisiones de deudores (editable, toggle desde el header) ─ */}
                {socios.length > 0 && mostrarDeudores && (
                    <div className="overflow-hidden rounded-2xl border border-border bg-card">
                        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <HandCoins className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-base font-semibold text-foreground">
                                    Deudores — abona / no abona
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        {socios.length} deudor
                                        {socios.length !== 1 ? 'es' : ''}
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Marcá si cada deudor abona (cobra media
                                    parte y baja su deuda) o no (cobra 0 en sus
                                    inversiones con deuda). El cierre se
                                    recalcula al instante.
                                </p>
                            </div>
                        </div>
                        <div className="divide-y divide-border">
                            {socios.map((s) => (
                                <SocioDecisionRow
                                    key={s.user.id}
                                    cierreId={cierre.id}
                                    socio={s}
                                    tasa={cierre.tasa}
                                    puedeEditar={puedeEditar}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Composición por inversión (editable) ───────────────── */}
                {puedeEditar &&
                    mostrarComposicion &&
                    composicion.length > 0 && (
                        <div className="overflow-hidden rounded-2xl border border-border bg-card">
                            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <SlidersHorizontal className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-base font-semibold text-foreground">
                                        Composición por inversión
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Configurá quién pertenece, su deuda y si
                                        es financiador. Los cambios afectan el
                                        registro real y recalculan el sueldo al
                                        instante.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 p-4 sm:p-5">
                                {composicion.map((emp) => (
                                    <details
                                        key={emp.id}
                                        className="group overflow-hidden rounded-xl border border-border"
                                    >
                                        <summary className="flex cursor-pointer items-center justify-between gap-3 bg-muted/40 px-4 py-2.5 select-none [&::-webkit-details-marker]:hidden">
                                            <span className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                <h3 className="text-sm font-semibold text-foreground">
                                                    {emp.nombre}
                                                </h3>
                                                <span className="text-xs text-muted-foreground">
                                                    {emp.inversiones.length}{' '}
                                                    {emp.inversiones.length ===
                                                    1
                                                        ? 'inversión'
                                                        : 'inversiones'}
                                                </span>
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                                        </summary>
                                        {emp.inversiones.length === 0 ? (
                                            <p className="px-4 py-3 text-xs text-muted-foreground">
                                                Sin inversiones en este cierre.
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-2">
                                                {emp.inversiones.map((inv) => (
                                                    <InversionComposicion
                                                        key={inv.id}
                                                        cierreId={cierre.id}
                                                        inversion={inv}
                                                        tasa={cierre.tasa}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </details>
                                ))}
                            </div>
                        </div>
                    )}

                {/* ── Una sección por empresa, sin mezclar ───────────────── */}
                {empresas.map((empresa) => (
                    <EmpresaSection
                        key={empresa.id}
                        empresa={empresa}
                        tasa={cierre.tasa}
                        abonos={abonos.filter(
                            (a) => a.empresa_id === empresa.id,
                        )}
                    />
                ))}

                {/* ── Consolidado final ──────────────────────────────────── */}
                <div>
                    <h2 className="text-sm font-semibold text-foreground">
                        Total por socio
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                            todas las empresas juntas
                        </span>
                    </h2>
                    <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
                        {porSocio.map((row, i) => {
                            const usd = toUSD(row.total, cierre.tasa);

                            return (
                                <div
                                    key={row.user.id}
                                    className={cn(
                                        'flex items-center gap-4 px-5 py-3.5',
                                        i !== porSocio.length - 1 &&
                                            'border-b border-border',
                                    )}
                                >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                        {initials(row.user.name)}
                                    </div>
                                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                        {row.user.name}
                                    </p>
                                    <div className="flex shrink-0 flex-col items-end leading-tight">
                                        <span className="text-sm font-semibold text-foreground tabular-nums">
                                            {formatARS(row.total)}
                                        </span>
                                        {usd != null && (
                                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                                {formatUSD(usd)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
}

/* ── Sub-componentes ─────────────────────────────────────────────────────── */

/**
 * Fila editable de decisión de un deudor: toggle Abona / No abona + monto del
 * abono. Cada cambio hace PATCH al backend, que recalcula y recarga la vista.
 */
function SocioDecisionRow({
    cierreId,
    socio,
    tasa,
    puedeEditar,
}: {
    cierreId: number;
    socio: SocioDecision;
    tasa: number;
    puedeEditar: boolean;
}) {
    const [abono, setAbono] = useState(String(socio.abono_monto));
    const [saving, setSaving] = useState(false);

    function patch(abona: boolean, abonoMonto: number) {
        setSaving(true);
        router.patch(
            `/cierres-sueldo/${cierreId}/socios/${socio.user.id}`,
            { abona, abono_monto: abonoMonto },
            { preserveScroll: true, onFinish: () => setSaving(false) },
        );
    }

    function setAbona(nuevoAbona: boolean) {
        if (!puedeEditar || saving || nuevoAbona === socio.abona) {
            return;
        }

        patch(
            nuevoAbona,
            nuevoAbona ? Number(abono) || socio.sueldo_generado : 0,
        );
    }

    function commitAbono() {
        if (!puedeEditar || saving) {
            return;
        }

        const val = Number(abono) || 0;

        if (val === socio.abono_monto) {
            return;
        }

        patch(true, val);
    }

    const usd = toUSD(socio.abono_monto, tasa);

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-3 px-5 py-3.5',
                saving && 'opacity-60',
            )}
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {initials(socio.user.name)}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                    {socio.user.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                    Sueldo generado {formatARS(socio.sueldo_generado)}
                </p>
            </div>

            {/* Toggle Abona / No abona */}
            <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-border">
                <button
                    type="button"
                    disabled={!puedeEditar || saving}
                    onClick={() => setAbona(true)}
                    className={cn(
                        'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed',
                        socio.abona
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-transparent text-muted-foreground hover:bg-muted',
                    )}
                >
                    <Check className="h-3.5 w-3.5" /> Abona
                </button>
                <button
                    type="button"
                    disabled={!puedeEditar || saving}
                    onClick={() => setAbona(false)}
                    className={cn(
                        'inline-flex items-center gap-1 border-l border-border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed',
                        !socio.abona
                            ? 'bg-red-500/15 text-red-500 dark:text-red-400'
                            : 'bg-transparent text-muted-foreground hover:bg-muted',
                    )}
                >
                    <X className="h-3.5 w-3.5" /> No abona
                </button>
            </div>

            {/* Monto del abono (solo si abona) */}
            {socio.abona ? (
                <div className="flex shrink-0 flex-col items-end">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">
                            Abona
                        </span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={abono}
                            disabled={!puedeEditar || saving}
                            onChange={(e) => setAbono(e.target.value)}
                            onBlur={commitAbono}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                }
                            }}
                            className="h-8 w-32 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-60"
                        />
                    </div>
                    {usd != null && (
                        <span className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                            {formatUSD(usd)}
                        </span>
                    )}
                </div>
            ) : (
                <span className="shrink-0 text-xs text-muted-foreground italic">
                    sin abono
                </span>
            )}
        </div>
    );
}

const TONE = {
    orange: { icon: 'text-primary', bg: 'bg-primary/10' },
    ok: {
        icon: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-500/10',
    },
    info: { icon: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500/10' },
    violet: {
        icon: 'text-violet-500 dark:text-violet-400',
        bg: 'bg-violet-500/10',
    },
};

function HeroStat({
    label,
    ars,
    tasa,
    sub,
    icon: Icon,
    tone,
}: {
    label: string;
    ars: number;
    tasa: number;
    sub: string;
    icon: React.ElementType;
    tone: keyof typeof TONE;
}) {
    const c = TONE[tone];
    const usd = toUSD(ars, tasa);

    return (
        <div className="flex min-h-[132px] flex-col justify-between gap-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    {label}
                </span>
                <div
                    className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        c.bg,
                        c.icon,
                    )}
                >
                    <Icon className="h-3.5 w-3.5" />
                </div>
            </div>
            <div className="flex flex-col leading-tight">
                <span className="text-lg font-semibold break-all text-foreground tabular-nums sm:text-xl">
                    {formatARS(ars)}
                </span>
                {usd != null && (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatUSD(usd)}
                    </span>
                )}
            </div>
            <span className="text-xs text-muted-foreground">{sub}</span>
        </div>
    );
}

/**
 * Estado del socio en la empresa según sus conceptos en este cierre.
 */
function estadoSocio(detalles: Detalle[], abono: boolean) {
    const financia = detalles.some(
        (d) => d.concepto === 'redistribucion_financiador' && d.monto > 0,
    );
    const deudorCero = detalles.some((d) => d.concepto === 'cero_deudor');
    const deudorMedia = detalles.some(
        (d) => d.concepto === 'media_parte_deudor',
    );

    if (deudorMedia || (deudorCero && abono)) {
        return {
            label: 'Deudor · abonó',
            stripe: 'bg-amber-500/70',
            badge: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        };
    }

    if (deudorCero) {
        return {
            label: 'Deudor · sin abono',
            stripe: 'bg-red-500/70',
            badge: 'border-red-500/25 bg-red-500/10 text-red-500 dark:text-red-400',
        };
    }

    if (financia) {
        return {
            label: 'Financia',
            stripe: 'bg-violet-500/70',
            badge: 'border-violet-500/25 bg-violet-500/10 text-violet-500 dark:text-violet-400',
        };
    }

    return {
        label: 'Flota',
        stripe: 'bg-emerald-500/50',
        badge: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400',
    };
}

function EmpresaSection({
    empresa,
    tasa,
    abonos,
}: {
    empresa: EmpresaBlock;
    tasa: number;
    abonos: Abono[];
}) {
    const [expandido, setExpandido] = useState<number | null>(null);

    const abonosPorSocio = useMemo(() => {
        const map = new Map<number, { total: number; detalle: Abono[] }>();

        for (const a of abonos) {
            if (!map.has(a.user.id)) {
                map.set(a.user.id, { total: 0, detalle: [] });
            }

            const entry = map.get(a.user.id)!;
            entry.total += a.monto;
            entry.detalle.push(a);
        }

        return map;
    }, [abonos]);

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {/* Header de la empresa */}
            <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-base font-semibold text-foreground">
                            {empresa.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {empresa.porInversor.length} socio
                            {empresa.porInversor.length !== 1 ? 's' : ''}{' '}
                            cobraron en esta empresa
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-5">
                    <div className="flex flex-col items-end leading-tight">
                        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                            Recaudado
                        </span>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                            {formatARS(empresa.recaudado)}
                        </span>
                    </div>
                    <div className="flex flex-col items-end leading-tight">
                        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                            Distribuido
                        </span>
                        <span className="text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                            {formatARS(empresa.distribuido)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Grid: socios (izq) + recaudación por inversión (der) */}
            <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* Socios */}
                <div className="lg:col-span-2 lg:border-r lg:border-border">
                    {empresa.porInversor.length === 0 ? (
                        <p className="px-5 py-6 text-sm text-muted-foreground">
                            Sin pagos en esta empresa.
                        </p>
                    ) : (
                        empresa.porInversor.map((row, i) => {
                            const abono = abonosPorSocio.get(row.user.id);
                            const estado = estadoSocio(row.detalles, !!abono);
                            const abierto = expandido === row.user.id;
                            const usd = toUSD(row.total, tasa);
                            const isLast = i === empresa.porInversor.length - 1;

                            return (
                                <div
                                    key={row.user.id}
                                    className={cn(
                                        !isLast && 'border-b border-border',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandido(
                                                abierto ? null : row.user.id,
                                            )
                                        }
                                        className="relative flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/40"
                                    >
                                        <span
                                            className={cn(
                                                'absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full',
                                                estado.stripe,
                                            )}
                                        />

                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                            {initials(row.user.name)}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="truncate text-sm font-medium text-foreground">
                                                    {row.user.name}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium',
                                                        estado.badge,
                                                    )}
                                                >
                                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                    {estado.label}
                                                </span>
                                                {abono && (
                                                    <span className="inline-flex items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                                        Abonó{' '}
                                                        {formatARS(abono.total)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                {row.detalles.length} inversión
                                                {row.detalles.length !== 1
                                                    ? 'es'
                                                    : ''}{' '}
                                                · tocá para ver el detalle
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2.5">
                                            <div className="flex flex-col items-end leading-tight">
                                                <span className="text-sm font-semibold text-foreground tabular-nums">
                                                    {formatARS(row.total)}
                                                </span>
                                                {usd != null && (
                                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                                        {formatUSD(usd)}
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronDown
                                                className={cn(
                                                    'h-4 w-4 text-muted-foreground transition-transform',
                                                    abierto && 'rotate-180',
                                                )}
                                            />
                                        </div>
                                    </button>

                                    {abierto && (
                                        <div className="border-t border-border/60 bg-muted/20 px-5 py-3 pl-[4.25rem]">
                                            <DetalleInversiones
                                                detalles={row.detalles}
                                                abonoTotal={abono?.total ?? 0}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Recaudación por inversión */}
                <div className="border-t border-border lg:border-t-0">
                    <div className="border-b border-border px-5 py-3">
                        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Recaudación por inversión
                        </p>
                    </div>
                    {empresa.recaudaciones.length === 0 ? (
                        <p className="px-5 py-6 text-sm text-muted-foreground">
                            Sin recaudación registrada.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border/60">
                            {empresa.recaudaciones.map((r, i) => {
                                const usd = toUSD(r.monto, tasa);

                                return (
                                    <li
                                        key={i}
                                        className="flex items-center justify-between gap-3 px-5 py-2.5"
                                    >
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                            {r.inversion}
                                        </span>
                                        <div className="flex shrink-0 flex-col items-end leading-tight">
                                            <span className="text-sm text-foreground tabular-nums">
                                                {formatARS(r.monto)}
                                            </span>
                                            {usd != null && (
                                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                                    {formatUSD(usd)}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Tarjeta editable de una inversión: sus socios (deuda + financiador + quitar)
 * y un selector para sumar un inversor de la empresa que aún no participa.
 * Cada acción hace PATCH y el backend recalcula el cierre.
 */
function InversionComposicion({
    cierreId,
    inversion,
    tasa,
}: {
    cierreId: number;
    inversion: ComposicionInversion;
    tasa: number;
}) {
    const [saving, setSaving] = useState(false);

    function patch(
        userId: number,
        body: {
            pertenece: boolean;
            saldo: number;
            es_financiador: boolean;
            es_deudor: boolean;
        },
    ) {
        setSaving(true);
        router.patch(
            `/cierres-sueldo/${cierreId}/inversiones/${inversion.id}/socios/${userId}`,
            body,
            { preserveScroll: true, onFinish: () => setSaving(false) },
        );
    }

    const candidatoOptions: ComboboxOption[] = inversion.candidatos.map(
        (c) => ({
            value: String(c.id),
            label: c.name,
            sub: c.dni ?? undefined,
        }),
    );

    return (
        <div
            className={cn(
                'flex flex-col overflow-hidden rounded-xl border border-border',
                saving && 'opacity-60',
            )}
        >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                        {inversion.nombre}
                    </span>
                    {!inversion.completa && (
                        <span
                            className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
                            title={`Inversión incompleta (${inversion.autos}/10 autos): la deuda se marca con un check, sin monto.`}
                        >
                            Incompleta {inversion.autos}/10
                        </span>
                    )}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    Recaudado {formatARS(inversion.recaudado)}
                </span>
            </div>

            {inversion.socios.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">
                    Sin socios asignados.
                </p>
            ) : (
                <div className="divide-y divide-border/60">
                    {inversion.socios.map((s) => (
                        <SocioComposicionRow
                            key={s.user.id}
                            socio={s}
                            tasa={tasa}
                            saving={saving}
                            completa={inversion.completa}
                            onSaldo={(saldo) =>
                                patch(s.user.id, {
                                    pertenece: true,
                                    saldo,
                                    es_financiador: s.es_financiador,
                                    es_deudor: saldo > 0,
                                })
                            }
                            onDeudor={(esDeudor) =>
                                patch(s.user.id, {
                                    pertenece: true,
                                    saldo: 0,
                                    es_financiador: s.es_financiador,
                                    es_deudor: esDeudor,
                                })
                            }
                            onFinanciador={(esFin) =>
                                patch(s.user.id, {
                                    pertenece: true,
                                    saldo: esFin ? 0 : s.saldo,
                                    es_financiador: esFin,
                                    es_deudor: esFin ? false : s.es_deudor,
                                })
                            }
                            onQuitar={() =>
                                patch(s.user.id, {
                                    pertenece: false,
                                    saldo: 0,
                                    es_financiador: false,
                                    es_deudor: false,
                                })
                            }
                        />
                    ))}
                </div>
            )}

            {candidatoOptions.length > 0 && (
                <div className="flex items-center gap-2 border-t border-border bg-muted/20 px-3 py-2">
                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Combobox
                        className="flex-1"
                        placeholder="Sumar inversor…"
                        options={candidatoOptions}
                        value=""
                        disabled={saving}
                        emptyText="Sin inversores para sumar"
                        onSelect={(opt) =>
                            patch(Number(opt.value), {
                                pertenece: true,
                                saldo: 0,
                                es_financiador: false,
                                es_deudor: false,
                            })
                        }
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Fila de un socio dentro de una inversión: financiador, quitar, y — según si
 * la inversión está completa — un monto de deuda (USD) o un check "Deudor".
 * El monto commitea al salir del input; el resto al click.
 */
function SocioComposicionRow({
    socio,
    tasa,
    saving,
    completa,
    onSaldo,
    onDeudor,
    onFinanciador,
    onQuitar,
}: {
    socio: ComposicionSocio;
    tasa: number;
    saving: boolean;
    completa: boolean;
    onSaldo: (saldo: number) => void;
    onDeudor: (esDeudor: boolean) => void;
    onFinanciador: (esFinanciador: boolean) => void;
    onQuitar: () => void;
}) {
    const [saldo, setSaldo] = useState(String(socio.saldo));
    // La deuda está en USD; mostramos su equivalente en pesos a la tasa del cierre.
    const ars = socio.saldo * tasa;

    function commitSaldo() {
        if (saving) {
            return;
        }

        const val = Number(saldo) || 0;

        if (val === socio.saldo) {
            return;
        }

        onSaldo(val);
    }

    return (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    {initials(socio.user.name)}
                </div>
                <span className="truncate text-sm font-medium text-foreground">
                    {socio.user.name}
                </span>
            </div>

            {/* Financiador (excluyente con deudor) */}
            <button
                type="button"
                disabled={saving || socio.es_deudor}
                onClick={() => onFinanciador(!socio.es_financiador)}
                className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    socio.es_financiador
                        ? 'border-violet-500/30 bg-violet-500/10 text-violet-500 dark:text-violet-400'
                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted',
                )}
            >
                <Coins className="h-3 w-3" />
                Financiador
            </button>

            {/* Deuda: monto en USD si la inversión está completa; si no, un
                check "Deudor" (todavía sin monto fijado). */}
            {completa ? (
                <div className="flex shrink-0 flex-col items-end">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                            Deuda USD
                        </span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={saldo}
                            disabled={saving || socio.es_financiador}
                            onChange={(e) => setSaldo(e.target.value)}
                            onBlur={commitSaldo}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                }
                            }}
                            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-60"
                        />
                    </div>
                    {socio.saldo > 0 && tasa > 0 && (
                        <span className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                            {formatARS(ars)}
                        </span>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    disabled={saving || socio.es_financiador}
                    onClick={() => onDeudor(!socio.es_deudor)}
                    className={cn(
                        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                        socio.es_deudor
                            ? 'border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400'
                            : 'border-border bg-transparent text-muted-foreground hover:bg-muted',
                    )}
                >
                    <span
                        className={cn(
                            'flex h-3.5 w-3.5 items-center justify-center rounded-sm border',
                            socio.es_deudor
                                ? 'border-red-500 bg-red-500 text-white'
                                : 'border-muted-foreground/50',
                        )}
                    >
                        {socio.es_deudor && <Check className="h-2.5 w-2.5" />}
                    </span>
                    Deudor
                </button>
            )}

            {/* Quitar */}
            <button
                type="button"
                disabled={saving}
                onClick={onQuitar}
                title="Quitar de la inversión"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-red-400"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

CierreSueldoShow.layout = {
    breadcrumbs: [
        { title: 'Cierres de Sueldo', href: '/cierres-sueldo' },
        { title: 'Detalle', href: '#' },
    ],
};
