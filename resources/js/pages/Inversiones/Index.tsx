import { Head, router } from '@inertiajs/react';
import { AlertCircle, HandCoins, Lock, Plus, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { MoneyDual, formatARS, formatUSD } from '@/components/money-dual';
import { cn } from '@/lib/utils';

interface InversorAsignado {
    id: number;
    name: string;
    dni: string;
    tiene_deuda: boolean;
    es_financiador: boolean;
    saldo_deuda: number;
}

interface InversionItem {
    id: number;
    nombre: string;
    empresa: { id: number; nombre: string } | null;
    recaudacion_semana_anterior: number;
    inversores: InversorAsignado[];
}

interface InversorDisponible {
    id: number;
    name: string;
    dni: string;
}

interface Socio {
    id: number;
    name: string;
    cobrado_ultimo_cierre: number;
}

interface UltimoCierre {
    id: number;
    periodo_fin: string | null;
    total_recaudado: number;
    tasa: number | null;
}

interface Props {
    inversiones: InversionItem[];
    inversoresDisponibles: InversorDisponible[];
    socios: Socio[];
    ultimoCierre: UltimoCierre | null;
    maxInversores: number;
}

function formatCierreDate(d: string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
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

export default function InversionesIndex({
    inversiones,
    inversoresDisponibles,
    socios,
    ultimoCierre,
    maxInversores,
}: Props) {
    const [manageOpen, setManageOpen] = useState<InversionItem | null>(null);

    // Inversiones sin completar los inversores requeridos
    const asignacionesIncompletas = useMemo(
        () =>
            inversiones.filter((inv) => inv.inversores.length < maxInversores)
                .length,
        [inversiones, maxInversores],
    );

    return (
        <>
            <Head title="Inversiones" />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 lg:p-6">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            Cierre{' '}
                            {ultimoCierre?.periodo_fin
                                ? `${formatCierreDate(ultimoCierre.periodo_fin)}`
                                : 'NaN'}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">{}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => router.get('/cierres-inversion')}
                        >
                            <Lock className="mr-1.5 h-4 w-4" />
                            Cierres
                        </Button>
                        <Button
                            onClick={() =>
                                router.get('/cierres-inversion/nuevo')
                            }
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Nuevo cierre
                        </Button>
                    </div>
                </div>

                {/* KPI cards: total recaudado ARS + USD del último cierre */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                            Total recaudado en pesos argentinos
                        </p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            {formatARS(ultimoCierre?.total_recaudado ?? 0)}
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                            Total recaudado en dólares estadounidenses
                        </p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            {formatUSD(
                                ultimoCierre?.tasa && ultimoCierre.tasa > 0
                                    ? ultimoCierre.total_recaudado /
                                          ultimoCierre.tasa
                                    : 0,
                            )}
                        </p>
                        {ultimoCierre?.tasa && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                Tasa: {formatARS(ultimoCierre.tasa)} / USD
                            </p>
                        )}
                    </div>
                </div>

                {/* Aviso pre-condiciones */}
                {asignacionesIncompletas > 0 && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-200">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                            <strong>{asignacionesIncompletas}</strong> inversión
                            {asignacionesIncompletas === 1 ? '' : 'es'} sin
                            completar los {maxInversores} inversores. No podrás
                            ejecutar cierres hasta completarlas.
                        </p>
                    </div>
                )}

                {/* Layout 2/3 + 1/3 */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Lista de inversiones */}
                    <div className="lg:col-span-2">
                        {inversiones.length === 0 ? (
                            <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                                <Wallet className="mx-auto h-10 w-10 text-muted-foreground/50" />
                                <p className="mt-3 text-sm text-muted-foreground">
                                    No hay inversiones registradas.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                                    <h2 className="text-base font-semibold text-foreground">
                                        Inversiones
                                    </h2>
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                        {inversiones.length}
                                    </span>
                                </div>
                                <ul className="divide-y divide-border">
                                    {inversiones.map((inv) => (
                                        <InversionRow
                                            key={inv.id}
                                            inv={inv}
                                            tasa={ultimoCierre?.tasa ?? null}
                                            onManage={() => setManageOpen(inv)}
                                        />
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Panel lateral: Socios */}
                    <aside className="lg:col-span-1">
                        <div className="sticky top-4 rounded-xl border border-border bg-card shadow-sm">
                            <div className="flex items-center justify-between border-b border-border px-5 py-4">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        Socios
                                    </h3>
                                </div>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {socios.length}
                                </span>
                            </div>

                            {socios.length === 0 ? (
                                <div className="p-6 text-center">
                                    <HandCoins className="mx-auto h-7 w-7 text-muted-foreground/40" />
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        No hay inversores registrados.
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {socios.map((s) => (
                                        <li
                                            key={s.id}
                                            className="flex items-center justify-between gap-3 px-5 py-3"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {s.name}
                                                    </p>
                                                </div>
                                            </div>
                                            <MoneyDual
                                                ars={s.cobrado_ultimo_cierre}
                                                tasa={
                                                    ultimoCierre?.tasa ?? null
                                                }
                                                orientation="stacked"
                                                size="md"
                                                className="shrink-0 items-end"
                                                arsClassName={cn(
                                                    s.cobrado_ultimo_cierre > 0
                                                        ? 'text-emerald-700 dark:text-emerald-400'
                                                        : 'text-muted-foreground',
                                                )}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </aside>
                </div>
            </div>

            {manageOpen && (
                <ManageDialog
                    inversion={manageOpen}
                    inversoresDisponibles={inversoresDisponibles}
                    maxInversores={maxInversores}
                    onClose={() => setManageOpen(null)}
                />
            )}
        </>
    );
}

InversionesIndex.layout = {
    breadcrumbs: [{ title: 'Inversiones', href: '/inversiones' }],
};

// ─── Inversion Row ────────────────────────────────────────────────────────

function InversionRow({
    inv,
    tasa,
    onManage,
}: {
    inv: InversionItem;
    tasa: number | null;
    onManage: () => void;
}) {
    return (
        <li className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/30">
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                    {inv.nombre}
                </p>
                {inv.empresa?.nombre && (
                    <p className="truncate text-[11px] text-muted-foreground">
                        {inv.empresa.nombre}
                    </p>
                )}
            </div>
            <div className="hidden text-right sm:block">
                <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    Cierre anterior
                </p>
                <MoneyDual
                    ars={inv.recaudacion_semana_anterior}
                    tasa={tasa}
                    orientation="stacked"
                    size="md"
                    className="items-end"
                />
            </div>
            <Button size="sm" variant="outline" onClick={onManage}>
                Gestionar
            </Button>
        </li>
    );
}

// ─── Manage Dialog ────────────────────────────────────────────────────────

interface ManageDialogProps {
    inversion: InversionItem;
    inversoresDisponibles: InversorDisponible[];
    maxInversores: number;
    onClose: () => void;
}

interface DraftRow {
    user_id: number;
    name: string;
    dni: string;
    asignado: boolean;
    tiene_deuda: boolean;
    es_financiador: boolean;
}

function ManageDialog({
    inversion,
    inversoresDisponibles,
    maxInversores,
    onClose,
}: ManageDialogProps) {
    // Estado local: combinamos todos los inversores del sistema con los flags actuales
    const currentMap = useMemo(
        () => new Map(inversion.inversores.map((u) => [u.id, u])),
        [inversion.inversores],
    );

    const [rows, setRows] = useState<DraftRow[]>(() =>
        inversoresDisponibles.map((u) => {
            const actual = currentMap.get(u.id);
            return {
                user_id: u.id,
                name: u.name,
                dni: u.dni,
                asignado: !!actual,
                tiene_deuda: actual?.tiene_deuda ?? false,
                es_financiador: actual?.es_financiador ?? false,
            };
        }),
    );

    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const seleccionados = rows.filter((r) => r.asignado);
    const lleno = seleccionados.length >= maxInversores;

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                r.dni.toLowerCase().includes(q),
        );
    }, [rows, search]);

    function updateRow(userId: number, patch: Partial<DraftRow>) {
        setError(null);
        setRows((prev) =>
            prev.map((r) => {
                if (r.user_id !== userId) return r;
                const next = { ...r, ...patch };
                // Si se desasigna, limpia los flags
                if (!next.asignado) {
                    next.tiene_deuda = false;
                    next.es_financiador = false;
                }
                // Exclusividad deudor/financiador
                if (patch.tiene_deuda) next.es_financiador = false;
                if (patch.es_financiador) next.tiene_deuda = false;
                return next;
            }),
        );
    }

    function handleSave() {
        // Validaciones cliente
        if (seleccionados.length > maxInversores) {
            setError(`Máximo ${maxInversores} inversores por inversión.`);
            return;
        }

        const invalid = seleccionados.find(
            (r) => r.tiene_deuda && r.es_financiador,
        );
        if (invalid) {
            setError(
                'Un inversor no puede ser deudor y financiador al mismo tiempo.',
            );
            return;
        }

        setProcessing(true);
        setError(null);

        router.put(
            `/inversiones/${inversion.id}/inversores/sync`,
            {
                inversores: seleccionados.map((r) => ({
                    user_id: r.user_id,
                    tiene_deuda: r.tiene_deuda,
                    es_financiador: r.es_financiador,
                })),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setProcessing(false);
                    onClose();
                },
                onError: (errs) => {
                    setProcessing(false);
                    const msg = Object.values(errs).join(' ');
                    setError(msg || 'Error al guardar los cambios.');
                },
                onFinish: () => setProcessing(false),
            },
        );
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-160">
                <DialogHeader>
                    <DialogTitle>{inversion.nombre}</DialogTitle>
                    <DialogDescription>
                        Marca los inversores que pertenecen a esta inversión y
                        sus roles. Los cambios se guardan al confirmar.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between gap-3">
                    <input
                        type="text"
                        placeholder="Buscar por nombre o DNI..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                    <span
                        className={cn(
                            'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                            lleno
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : seleccionados.length > maxInversores
                                  ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                                  : 'border-border bg-muted text-muted-foreground',
                        )}
                    >
                        {seleccionados.length}/{maxInversores}
                    </span>
                </div>

                <div className="max-h-95 overflow-y-auto rounded-lg border border-border">
                    {filteredRows.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground italic">
                            No hay inversores que coincidan.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {filteredRows.map((r) => {
                                const disabledAssign =
                                    !r.asignado &&
                                    seleccionados.length >= maxInversores;
                                return (
                                    <li
                                        key={r.user_id}
                                        className={cn(
                                            'flex items-center justify-between gap-3 px-3 py-2.5 transition-colors',
                                            r.asignado
                                                ? 'bg-primary/5'
                                                : 'hover:bg-muted/40',
                                        )}
                                    >
                                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                                            <Checkbox
                                                checked={r.asignado}
                                                disabled={disabledAssign}
                                                onCheckedChange={(v) =>
                                                    updateRow(r.user_id, {
                                                        asignado: Boolean(v),
                                                    })
                                                }
                                            />
                                            <div
                                                className={cn(
                                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                                                    r.tiene_deuda
                                                        ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                                                        : r.es_financiador
                                                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                                          : 'bg-muted text-muted-foreground',
                                                )}
                                            >
                                                {initials(r.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-foreground">
                                                    {r.name}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    DNI {r.dni}
                                                </p>
                                            </div>
                                        </label>

                                        <label
                                            className={cn(
                                                'flex items-center gap-1.5 text-xs',
                                                !r.asignado && 'opacity-40',
                                            )}
                                        >
                                            <Checkbox
                                                checked={r.tiene_deuda}
                                                disabled={
                                                    !r.asignado ||
                                                    r.es_financiador
                                                }
                                                onCheckedChange={(v) =>
                                                    updateRow(r.user_id, {
                                                        tiene_deuda: Boolean(v),
                                                    })
                                                }
                                            />
                                            Deuda
                                        </label>
                                        <label
                                            className={cn(
                                                'flex items-center gap-1.5 text-xs',
                                                !r.asignado && 'opacity-40',
                                            )}
                                        >
                                            <Checkbox
                                                checked={r.es_financiador}
                                                disabled={
                                                    !r.asignado || r.tiene_deuda
                                                }
                                                onCheckedChange={(v) =>
                                                    updateRow(r.user_id, {
                                                        es_financiador:
                                                            Boolean(v),
                                                    })
                                                }
                                            />
                                            Financia
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {error && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={processing}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={
                            processing || seleccionados.length > maxInversores
                        }
                    >
                        {processing ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
