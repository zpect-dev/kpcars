import { Head } from '@inertiajs/react';
import { ChevronDown, Landmark, Receipt, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatARS, formatUSD } from '@/components/money-dual';
import { cn } from '@/lib/utils';

interface Empresa {
    id: number;
    nombre: string;
}

interface Inversion {
    id: number;
    nombre: string;
    empresa: Empresa | null;
    es_financiador: boolean;
    deuda: number;
    autos: number;
    /** Recaudación del período abierto de toda la inversión (ARS). */
    recaudado: number;
}

interface CierreDetalle {
    inversion: string | null;
    concepto: string;
    monto: number;
}

interface Cierre {
    id: number | null;
    fecha: string | null;
    tasa: number | null;
    total: number;
    abonado: number;
    detalles: CierreDetalle[];
}

interface GastoItem {
    id: number;
    fecha: string | null;
    tipo: string;
    descripcion: string | null;
    monto: number;
    vehiculo: string | null;
}

interface GastosFlota {
    inversion_id: number;
    total: number;
    mi_parte: number;
    items: GastoItem[];
}

interface Gastos {
    total: number;
    globales: {
        total: number;
        mi_parte: number;
        items: GastoItem[];
    };
    flota: GastosFlota[];
}

interface Props {
    inversiones: Inversion[];
    cierres: Cierre[];
    gastos: Gastos;
    cotizacionDolar: number | null;
}

type Tab = 'gastos' | 'sueldo' | 'cuenta';

interface GrupoEmpresa {
    id: number;
    nombre: string;
    inversiones: Inversion[];
    autos: number;
    recaudado: number;
}

/**
 * Agrupa las inversiones del inversor por empresa, acumulando los totales.
 */
function agruparPorEmpresa(inversiones: Inversion[]): GrupoEmpresa[] {
    const grupos = new Map<number, GrupoEmpresa>();

    for (const inv of inversiones) {
        const empresaId = inv.empresa?.id ?? 0;
        const empresaNombre = inv.empresa?.nombre ?? 'Sin empresa';

        let grupo = grupos.get(empresaId);

        if (!grupo) {
            grupo = {
                id: empresaId,
                nombre: empresaNombre,
                inversiones: [],
                autos: 0,
                recaudado: 0,
            };
            grupos.set(empresaId, grupo);
        }

        grupo.inversiones.push(inv);
        grupo.autos += inv.autos;
        grupo.recaudado += inv.recaudado;
    }

    return [...grupos.values()].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
    );
}

function formatFecha(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    // Las fechas date-only (Y-m-d) se parsean a mano: `new Date('Y-m-d')` las
    // interpreta como UTC y en UTC-3 mostraría el día anterior.
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

    if (soloFecha) {
        const [, y, m, d] = soloFecha;

        return `${d}/${m}/${y}`;
    }

    return new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/**
 * Número plano para celdas de tabla: la moneda ya la indica el encabezado de
 * la columna, repetir "ARS"/"USD" en cada fila es puro ruido.
 */
const formatNum = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
}).format;

const TIPO_LABELS: Record<string, string> = {
    galpon: 'Galpón',
    oficina: 'Oficina',
    taller: 'Taller',
    vehiculo: 'Flota',
};

/** Concepto de pago que corresponde a financiamiento (no a la flota). */
const CONCEPTO_FINANCIADOR = 'redistribucion_financiador';

const CONCEPTO_LABELS: Record<string, string> = {
    parte_completa: 'Parte completa',
    media_parte_deudor: 'Media parte (deudor)',
    cero_deudor: 'Sin parte (deudor)',
    redistribucion_financiador: 'Financiamiento',
};

/** Celdas de monto: ARS y USD como dos columnas alineadas a la derecha. */
function MoneyCells({
    ars,
    tasa,
    className,
}: {
    ars: number;
    tasa: number | null;
    className?: string;
}) {
    return (
        <>
            <td
                className={cn(
                    'px-3 py-2 text-right whitespace-nowrap tabular-nums',
                    className,
                )}
            >
                {formatNum(ars)}
            </td>
            <td
                className={cn(
                    'px-3 py-2 text-right whitespace-nowrap text-muted-foreground tabular-nums',
                    className,
                )}
            >
                {tasa ? formatNum(ars / tasa) : '—'}
            </td>
        </>
    );
}

/** Encabezado estándar de las tablas de montos duales. */
function MoneyHead({
    firstCol,
    secondCol,
}: {
    firstCol: string;
    secondCol?: string;
}) {
    return (
        <thead className="border-b border-border text-[11px] tracking-wider text-muted-foreground uppercase">
            <tr>
                <th className="px-3 py-2 text-left font-medium">{firstCol}</th>
                {secondCol !== undefined && (
                    <th className="px-3 py-2 text-left font-medium">
                        {secondCol}
                    </th>
                )}
                <th className="px-3 py-2 text-right font-medium">ARS</th>
                <th className="px-3 py-2 text-right font-medium">USD</th>
            </tr>
        </thead>
    );
}

/** Tabla de pagos de un cierre de sueldo con subtotal. */
function TablaSueldo({
    titulo,
    detalles,
    tasa,
}: {
    titulo: string;
    detalles: CierreDetalle[];
    tasa: number | null;
}) {
    const subtotal = detalles.reduce((s, d) => s + d.monto, 0);

    return (
        <section className="flex flex-col gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                    <MoneyHead firstCol="Inversión" secondCol="Concepto" />
                    <tbody className="divide-y divide-border">
                        {detalles.map((d, i) => (
                            <tr key={i}>
                                <td className="px-3 py-2 text-left font-medium text-foreground">
                                    {d.inversion ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-left text-muted-foreground">
                                    {CONCEPTO_LABELS[d.concepto] ?? d.concepto}
                                </td>
                                <MoneyCells ars={d.monto} tasa={tasa} />
                            </tr>
                        ))}
                    </tbody>
                    {detalles.length > 1 && (
                        <tfoot>
                            <tr className="border-t border-border font-semibold">
                                <td className="px-3 py-2 text-left" colSpan={2}>
                                    Subtotal
                                </td>
                                <MoneyCells
                                    ars={subtotal}
                                    tasa={tasa}
                                    className="font-semibold"
                                />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </section>
    );
}

/**
 * Resumen del colapsable de gastos: cantidad y total sin dividir como
 * contexto, y la parte del inversor destacada en un pill de color.
 */
function ResumenGasto({
    miParte,
    total,
    cantidad,
}: {
    miParte: number;
    total: number;
    cantidad: number;
}) {
    if (cantidad === 0) {
        return (
            <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Sin gastos
            </span>
        );
    }

    return (
        <span className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
                {cantidad === 1 ? '1 gasto' : `${cantidad} gastos`} · Total ARS{' '}
                {formatNum(total)}
            </span>
            <span
                className={cn(
                    'rounded-full px-3 py-1 text-sm font-semibold tabular-nums',
                    miParte > 0
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground',
                )}
            >
                Tu parte: {formatARS(miParte)}
            </span>
        </span>
    );
}

/** Sección colapsable con resumen a la derecha. */
function Colapsable({
    titulo,
    resumen,
    children,
}: {
    titulo: React.ReactNode;
    resumen: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <details className="group rounded-lg border border-border bg-card">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 select-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    {titulo}
                </span>
                {resumen}
            </summary>
            <div className="border-t border-border">{children}</div>
        </details>
    );
}

export default function MiCuentaIndex({
    inversiones,
    cierres,
    gastos,
    cotizacionDolar,
}: Props) {
    // Sin sección seleccionada al entrar: se muestra la tabla de recaudación.
    const [tab, setTab] = useState<Tab | null>(null);

    const grupos = useMemo(() => agruparPorEmpresa(inversiones), [inversiones]);

    const tasa =
        cotizacionDolar && cotizacionDolar > 0 ? cotizacionDolar : null;

    const ultimoCierre = cierres[0] ?? null;

    // Pagos del último cierre separados: recaudación de flota vs. lo que
    // cobra como financiador.
    const detallesFlota =
        ultimoCierre?.detalles.filter(
            (d) => d.concepto !== CONCEPTO_FINANCIADOR,
        ) ?? [];
    const detallesFinancia =
        ultimoCierre?.detalles.filter(
            (d) => d.concepto === CONCEPTO_FINANCIADOR,
        ) ?? [];

    // Gastos de flota indexados por inversión para cruzarlos con `inversiones`.
    const flotaPorInversion = useMemo(() => {
        const map = new Map<number, GastosFlota>();

        for (const f of gastos.flota) {
            map.set(f.inversion_id, f);
        }

        return map;
    }, [gastos.flota]);

    // Total de gastos que le corresponde pagar al inversor: su parte de los
    // globales (galpón/oficina/taller) + su parte de cada flota.
    const misGastos = useMemo(
        () =>
            gastos.globales.mi_parte +
            gastos.flota.reduce((s, f) => s + f.mi_parte, 0),
        [gastos],
    );

    const tabs: {
        key: Tab;
        label: string;
        detalle: string;
        monto: string;
        icon: typeof Wallet;
    }[] = [
        {
            key: 'sueldo',
            label: 'Tu sueldo',
            detalle: 'Último cierre cobrado',
            monto: ultimoCierre ? formatARS(ultimoCierre.total) : '—',
            icon: Wallet,
        },
        {
            key: 'gastos',
            label: 'Tus gastos',
            detalle: 'Tu parte del período en curso',
            monto: formatARS(misGastos),
            icon: Receipt,
        },
        {
            key: 'cuenta',
            label: 'Tus cuentas',
            detalle: 'Disponible próximamente',
            monto: '—',
            icon: Landmark,
        },
    ];

    return (
        <>
            <Head title="Recaudación" />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6">
                {' '}
                {/* Botones de sección */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {tabs.map((t) => {
                        const activo = tab === t.key;
                        const Icon = t.icon;

                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(activo ? null : t.key)}
                                className={cn(
                                    'flex items-center gap-4 rounded-xl border p-4 text-left transition-all',
                                    activo
                                        ? 'border-primary bg-primary/10 shadow-sm'
                                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors',
                                        activo
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-primary/10 text-primary',
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span className="flex min-w-0 flex-col">
                                    <span className="text-sm font-semibold text-foreground">
                                        {t.label}
                                    </span>
                                    <span className="truncate text-lg font-bold text-foreground tabular-nums">
                                        {t.monto}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {t.detalle}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
                {/* ── Recaudación (vista por defecto) ────────────────── */}
                {tab === null &&
                    (inversiones.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                            No tenés inversiones asignadas.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {grupos.map((grupo) => (
                                <section
                                    key={grupo.id}
                                    className="flex flex-col gap-2"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h2 className="text-base font-semibold text-foreground">
                                            {grupo.nombre}
                                        </h2>
                                        <div className="flex items-baseline gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                                            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                                Recaudación total
                                            </span>
                                            <span className="text-lg font-bold text-primary tabular-nums">
                                                {formatARS(grupo.recaudado)}
                                            </span>
                                            {tasa ? (
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {formatUSD(
                                                        grupo.recaudado / tasa,
                                                    )}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                                        <table className="w-full text-sm">
                                            <MoneyHead
                                                firstCol="Inversión"
                                                secondCol="Autos"
                                            />
                                            <tbody className="divide-y divide-border">
                                                {grupo.inversiones.map(
                                                    (inv) => (
                                                        <tr key={inv.id}>
                                                            <td className="px-3 py-2 text-left font-medium text-foreground">
                                                                {inv.nombre}
                                                            </td>
                                                            <td className="px-3 py-2 text-left text-muted-foreground tabular-nums">
                                                                {inv.autos}
                                                            </td>
                                                            <MoneyCells
                                                                ars={
                                                                    inv.recaudado
                                                                }
                                                                tasa={tasa}
                                                            />
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                            {grupo.inversiones.length > 1 && (
                                                <tfoot>
                                                    <tr className="border-t-2 border-primary/40 bg-primary/5 text-base font-bold">
                                                        <td className="px-3 py-2.5 text-left">
                                                            Total
                                                        </td>
                                                        <td className="px-3 py-2.5 text-left tabular-nums">
                                                            {grupo.autos}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-primary tabular-nums">
                                                            {formatNum(
                                                                grupo.recaudado,
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                                                            {tasa
                                                                ? formatNum(
                                                                      grupo.recaudado /
                                                                          tasa,
                                                                  )
                                                                : '—'}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </section>
                            ))}
                        </div>
                    ))}
                {/* ── Tus cuentas (apartado futuro) ──────────────────── */}
                {tab === 'cuenta' && (
                    <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                        Este apartado estará disponible próximamente.
                    </div>
                )}
                {/* ── Sueldo ─────────────────────────────────────────── */}
                {tab === 'sueldo' &&
                    (ultimoCierre === null ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                            Todavía no cobraste ningún cierre de sueldo.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* Último cierre */}
                            <div className="rounded-lg border border-border bg-card px-4 py-3">
                                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    Último cierre ·{' '}
                                    {formatFecha(ultimoCierre.fecha)}
                                </div>
                                <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                                    {formatARS(ultimoCierre.total)}
                                </div>
                                {ultimoCierre.tasa ? (
                                    <div className="text-sm text-muted-foreground tabular-nums">
                                        {formatUSD(
                                            ultimoCierre.total /
                                                ultimoCierre.tasa,
                                        )}
                                    </div>
                                ) : null}
                            </div>

                            {/* Detalle del último cierre: recaudación vs. financiamiento */}
                            {detallesFlota.length > 0 && (
                                <TablaSueldo
                                    titulo="Recaudación"
                                    detalles={detallesFlota}
                                    tasa={ultimoCierre.tasa}
                                />
                            )}
                            {detallesFinancia.length > 0 && (
                                <TablaSueldo
                                    titulo="Financiamiento"
                                    detalles={detallesFinancia}
                                    tasa={ultimoCierre.tasa}
                                />
                            )}

                            {/* Historial de cierres anteriores */}
                            {cierres.length > 1 && (
                                <section className="flex flex-col gap-1.5">
                                    <h2 className="text-sm font-semibold text-foreground">
                                        Cierres anteriores
                                    </h2>
                                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-border text-[11px] tracking-wider text-muted-foreground uppercase">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">
                                                        Fecha
                                                    </th>
                                                    <th className="px-3 py-2 text-right font-medium">
                                                        ARS
                                                    </th>
                                                    <th className="px-3 py-2 text-right font-medium">
                                                        USD
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {cierres
                                                    .slice(1)
                                                    .map((c, i) => (
                                                        <tr key={c.id ?? i}>
                                                            <td className="px-3 py-2 text-left text-foreground">
                                                                {formatFecha(
                                                                    c.fecha,
                                                                )}
                                                            </td>
                                                            <MoneyCells
                                                                ars={c.total}
                                                                tasa={c.tasa}
                                                            />
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}
                        </div>
                    ))}
                {/* ── Gastos ─────────────────────────────────────────── */}
                {tab === 'gastos' && (
                    <div className="flex flex-col gap-4">
                        {/* Total del período (sin dividir) */}
                        <div className="rounded-lg border border-border bg-card px-4 py-3">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Gasto total del período
                            </div>
                            <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                                {formatARS(gastos.total)}
                            </div>
                            {tasa ? (
                                <div className="text-sm text-muted-foreground tabular-nums">
                                    {formatUSD(gastos.total / tasa)}
                                </div>
                            ) : null}
                        </div>

                        {/* Galpón / Oficina / Taller */}
                        <Colapsable
                            titulo="Galpón · Oficina · Taller"
                            resumen={
                                <ResumenGasto
                                    miParte={gastos.globales.mi_parte}
                                    total={gastos.globales.total}
                                    cantidad={gastos.globales.items.length}
                                />
                            }
                        >
                            {gastos.globales.items.length === 0 ? (
                                <p className="px-3 py-3 text-sm text-muted-foreground">
                                    Sin gastos en el período.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-border text-[11px] tracking-wider text-muted-foreground uppercase">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium">
                                                    Fecha
                                                </th>
                                                <th className="px-3 py-2 text-left font-medium">
                                                    Categoría
                                                </th>
                                                <th className="px-3 py-2 text-left font-medium">
                                                    Descripción
                                                </th>
                                                <th className="px-3 py-2 text-right font-medium">
                                                    Monto (ARS)
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {gastos.globales.items.map((g) => (
                                                <tr key={g.id}>
                                                    <td className="px-3 py-2 text-left whitespace-nowrap text-muted-foreground">
                                                        {formatFecha(g.fecha)}
                                                    </td>
                                                    <td className="px-3 py-2 text-left text-foreground">
                                                        {TIPO_LABELS[g.tipo] ??
                                                            g.tipo}
                                                    </td>
                                                    <td className="px-3 py-2 text-left text-muted-foreground">
                                                        {g.descripcion ?? '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                                        {formatNum(g.monto)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-border font-semibold">
                                                <td
                                                    className="px-3 py-2 text-left"
                                                    colSpan={3}
                                                >
                                                    Total
                                                </td>
                                                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                                    {formatNum(
                                                        gastos.globales.total,
                                                    )}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </Colapsable>

                        {/* Gastos por flota */}
                        <section className="flex flex-col gap-1.5">
                            <h2 className="text-sm font-semibold text-foreground">
                                Gastos por flota
                            </h2>

                            {grupos.map((grupo) => (
                                <div
                                    key={grupo.id}
                                    className="flex flex-col gap-1.5"
                                >
                                    {grupos.length > 1 && (
                                        <h3 className="mt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            {grupo.nombre}
                                        </h3>
                                    )}

                                    {grupo.inversiones.map((inv) => {
                                        const flota = flotaPorInversion.get(
                                            inv.id,
                                        );

                                        return (
                                            <Colapsable
                                                key={inv.id}
                                                titulo={inv.nombre}
                                                resumen={
                                                    <ResumenGasto
                                                        miParte={
                                                            flota?.mi_parte ?? 0
                                                        }
                                                        total={
                                                            flota?.total ?? 0
                                                        }
                                                        cantidad={
                                                            flota?.items
                                                                .length ?? 0
                                                        }
                                                    />
                                                }
                                            >
                                                {!flota ||
                                                flota.items.length === 0 ? (
                                                    <p className="px-3 py-3 text-sm text-muted-foreground">
                                                        Sin gastos en el
                                                        período.
                                                    </p>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="border-b border-border text-[11px] tracking-wider text-muted-foreground uppercase">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left font-medium">
                                                                        Fecha
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left font-medium">
                                                                        Vehículo
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left font-medium">
                                                                        Descripción
                                                                    </th>
                                                                    <th className="px-3 py-2 text-right font-medium">
                                                                        Monto
                                                                        (ARS)
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border">
                                                                {flota.items.map(
                                                                    (g) => (
                                                                        <tr
                                                                            key={`${g.tipo}-${g.id}`}
                                                                        >
                                                                            <td className="px-3 py-2 text-left whitespace-nowrap text-muted-foreground">
                                                                                {formatFecha(
                                                                                    g.fecha,
                                                                                )}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-left text-foreground">
                                                                                {g.vehiculo ??
                                                                                    '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-left text-muted-foreground">
                                                                                <span className="flex items-center gap-2">
                                                                                    {g.tipo ===
                                                                                        'repuesto' && (
                                                                                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase">
                                                                                            Repuesto
                                                                                        </span>
                                                                                    )}
                                                                                    {g.descripcion ??
                                                                                        '—'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                                                                {formatNum(
                                                                                    g.monto,
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ),
                                                                )}
                                                            </tbody>
                                                            <tfoot>
                                                                <tr className="border-t border-border font-semibold">
                                                                    <td
                                                                        className="px-3 py-2 text-left"
                                                                        colSpan={
                                                                            3
                                                                        }
                                                                    >
                                                                        Total
                                                                        sin
                                                                        dividir
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                                                        {formatNum(
                                                                            flota.total,
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                )}
                                            </Colapsable>
                                        );
                                    })}
                                </div>
                            ))}
                        </section>
                    </div>
                )}
            </div>
        </>
    );
}

MiCuentaIndex.layout = {
    breadcrumbs: [{ title: 'Recaudación', href: '/mi-cuenta' }],
};
