import { ArrowDown, ArrowUp, ArrowUpDown, Check, Plus, Trash2 } from 'lucide-react';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
    DepositoInicial,
    MonedaOption,
    SortField,
} from '@/components/users/tipos';
import { cn } from '@/lib/utils';

/** Ítem del popover de filtros: casilla, rótulo, descripción y conteo. */
export function FilterPopoverItem({
    label,
    desc,
    count,
    isActive,
    onClick,
}: {
    label: string;
    desc?: string;
    count: number;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isActive}
            className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'bg-muted' : 'hover:bg-muted/60',
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border',
                    isActive
                        ? 'border-foreground bg-foreground'
                        : 'border-border bg-transparent',
                )}
            >
                {isActive && <Check className="size-3 text-background" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span
                    className={cn(
                        'text-sm leading-tight text-foreground',
                        isActive && 'font-semibold',
                    )}
                >
                    {label}
                </span>
                {desc && (
                    <span className="mt-0.5 text-xs leading-tight text-muted-foreground">
                        {desc}
                    </span>
                )}
            </span>
            <span
                className={cn(
                    'shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums',
                    isActive
                        ? 'bg-background text-foreground'
                        : 'bg-muted text-muted-foreground',
                )}
            >
                {count}
            </span>
        </button>
    );
}

/** Encabezado de columna ordenable de la tabla de personal. */
export function SortHeader({
    label,
    field,
    sortField,
    sortDir,
    onSort,
}: {
    label: string;
    field: SortField;
    sortField: SortField | null;
    sortDir: 'asc' | 'desc';
    onSort: (field: SortField) => void;
}) {
    const active = sortField === field;

    return (
        <button
            type="button"
            onClick={() => onSort(field)}
            aria-label={
                active
                    ? sortDir === 'asc'
                        ? `${label}: orden ascendente. Cambiar a descendente.`
                        : `${label}: orden descendente. Cambiar a ascendente.`
                    : `Ordenar por ${label}`
            }
            className={cn(
                'inline-flex items-center gap-1 rounded transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                active && 'text-foreground',
            )}
        >
            {label}
            {active ? (
                sortDir === 'asc' ? (
                    <ArrowUp aria-hidden="true" className="size-3.5" />
                ) : (
                    <ArrowDown aria-hidden="true" className="size-3.5" />
                )
            ) : (
                <ArrowUpDown
                    aria-hidden="true"
                    className="size-3.5 opacity-40"
                />
            )}
        </button>
    );
}

/**
 * Repetidor del depósito inicial (monto + moneda + fecha) para el alta del
 * chofer. Después del alta la cuenta se mueve desde el extracto: los ingresos
 * se suman, nunca reemplazan al anterior.
 */
export function DepositosField({
    depositos,
    monedas,
    onChange,
    error,
}: {
    depositos: DepositoInicial[];
    monedas: MonedaOption[];
    onChange: (d: DepositoInicial[]) => void;
    error?: string;
}) {
    const hoy = new Date().toISOString().slice(0, 10);

    function agregar() {
        const usadas = new Set(depositos.map((d) => d.moneda));
        const libre =
            monedas.find((m) => !usadas.has(m.value))?.value ??
            monedas[0]?.value ??
            'ARS';
        onChange([...depositos, { monto: 0, moneda: libre, fecha: hoy }]);
    }

    function actualizar(i: number, patch: Partial<DepositoInicial>) {
        onChange(
            depositos.map((d, idx) => (idx === i ? { ...d, ...patch } : d)),
        );
    }

    function quitar(i: number) {
        onChange(depositos.filter((_, idx) => idx !== i));
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <Label>Depósito inicial (garantía)</Label>
                <button
                    type="button"
                    onClick={agregar}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Plus aria-hidden="true" className="size-3.5" /> Agregar
                </button>
            </div>

            {depositos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Sin depósito cargado. Puede ser parcial: después se agregan
                    más entregas desde la cuenta.
                </p>
            ) : (
                depositos.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <MoneyInput
                            aria-label={`Monto del depósito ${i + 1}`}
                            value={d.monto || null}
                            onValueChange={(n) =>
                                actualizar(i, { monto: n ?? 0 })
                            }
                            placeholder="0,00"
                            className="flex-1"
                        />
                        <Input
                            type="date"
                            aria-label={`Fecha del depósito ${i + 1}`}
                            value={d.fecha}
                            onChange={(e) =>
                                actualizar(i, { fecha: e.target.value })
                            }
                            className="w-36"
                        />
                        <select
                            value={d.moneda}
                            aria-label={`Moneda del depósito ${i + 1}`}
                            onChange={(e) =>
                                actualizar(i, { moneda: e.target.value })
                            }
                            className="flex h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none"
                        >
                            {monedas.map((m) => (
                                <option
                                    key={m.value}
                                    value={m.value}
                                    className="bg-background text-foreground"
                                >
                                    {m.value}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => quitar(i)}
                            aria-label={`Quitar el depósito ${i + 1}`}
                            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-destructive-soft hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                    </div>
                ))
            )}
            {error && <InputError message={error} />}
        </div>
    );
}
