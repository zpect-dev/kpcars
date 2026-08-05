import { useForm } from '@inertiajs/react';
import { Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import InputError from '@/components/input-error';
import { MoneyInput, formatMoney } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Movimiento del extracto (append-only: no se edita ni se borra). */
export interface DepositoMovimiento {
    id: number;
    moneda: string;
    tipo: string;
    tipo_label: string;
    /** Firmado: positivo suma al saldo, negativo lo resta. */
    monto: number;
    fecha: string | null;
    nota: string | null;
    multa_pago_id: number | null;
    revierte_id: number | null;
    /** Ya tiene un contraasiento que lo anula. */
    revertido: boolean;
    registrado_en: string | null;
}

export interface DepositoSaldo {
    moneda: string;
    saldo: number;
}

export interface CuentaDeposito {
    saldos: DepositoSaldo[];
    movimientos: DepositoMovimiento[];
}

export interface MonedaOption {
    value: string;
    label: string;
    symbol: string;
}

export interface TipoMovimientoOption {
    value: string;
    label: string;
}

/** Saldo por moneda de una cuenta (las monedas sin movimientos no aparecen). */
export function saldosDeCuenta(
    cuenta?: CuentaDeposito | null,
): DepositoSaldo[] {
    return cuenta?.saldos ?? [];
}

/** Saldo total en ARS (los USD se convierten con la cotización global). */
export function saldoTotalARS(
    cuenta: CuentaDeposito | undefined | null,
    cotizacion: number,
): number {
    return saldosDeCuenta(cuenta).reduce(
        (total, s) =>
            total + (s.moneda === 'USD' ? s.saldo * cotizacion : s.saldo),
        0,
    );
}

/** "ARS 150.000 · USD 500" — resumen corto para la tabla de choferes. */
export function formatSaldos(cuenta?: CuentaDeposito | null): string | null {
    const saldos = saldosDeCuenta(cuenta);

    if (saldos.length === 0) {
        return null;
    }

    return saldos
        .map(
            (s) =>
                `${s.moneda} ${s.saldo.toLocaleString('es-AR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                })}`,
        )
        .join(' · ');
}

function formatFecha(fecha: string | null): string {
    if (!fecha) {
        return '—';
    }

    const [y, m, d] = fecha.split('T')[0].split(' ')[0].split('-');

    return `${d}/${m}/${y}`;
}

/** Extracto de una moneda con el saldo acumulado movimiento a movimiento. */
function extractoConSaldo(
    movimientos: DepositoMovimiento[],
    moneda: string,
): { mov: DepositoMovimiento; saldo: number }[] {
    let saldo = 0;

    return movimientos
        .filter((m) => m.moneda === moneda)
        .map((mov) => {
            saldo = Math.round((saldo + mov.monto) * 100) / 100;

            return { mov, saldo };
        });
}

/**
 * Cuenta de depósito (garantía) del chofer: extracto por moneda y alta de
 * movimientos. Funciona como una cuenta bancaria — cada carga suma o resta con
 * su fecha, nunca reemplaza el saldo anterior.
 */
export function DepositoCuentaDialog({
    user,
    cuenta,
    monedas,
    tipos,
    open,
    onOpenChange,
}: {
    user: { id: number; name: string } | null;
    cuenta?: CuentaDeposito | null;
    monedas: MonedaOption[];
    tipos: TipoMovimientoOption[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const hoy = new Date().toISOString().slice(0, 10);
    const movimientos = useMemo(() => cuenta?.movimientos ?? [], [cuenta]);
    const saldos = saldosDeCuenta(cuenta);

    // Monedas a mostrar: las que ya tienen movimientos y, si no hay ninguna,
    // la primera del catálogo para poder cargar el primer depósito.
    const monedasCuenta = useMemo(() => {
        const conMovimientos = monedas
            .map((m) => m.value)
            .filter((v) => movimientos.some((mov) => mov.moneda === v));

        return conMovimientos.length > 0
            ? conMovimientos
            : [monedas[0]?.value ?? 'ARS'];
    }, [monedas, movimientos]);

    const [monedaActiva, setMonedaActiva] = useState<string>(
        monedasCuenta[0] ?? 'ARS',
    );
    const monedaVisible = monedasCuenta.includes(monedaActiva)
        ? monedaActiva
        : (monedasCuenta[0] ?? 'ARS');

    const form = useForm({
        tipo: tipos[0]?.value ?? 'ingreso',
        moneda: monedaVisible,
        monto: null as number | null,
        fecha: hoy,
        nota: '',
    });

    const revertirForm = useForm({ nota: '' });

    function registrar(e: React.FormEvent) {
        e.preventDefault();

        if (!user) {
            return;
        }

        form.post(`/users/${user.id}/deposito/movimientos`, {
            preserveScroll: true,
            onSuccess: () =>
                form.setData((data) => ({
                    ...data,
                    monto: null,
                    nota: '',
                })),
        });
    }

    function revertir(movimiento: DepositoMovimiento) {
        if (!user) {
            return;
        }

        revertirForm.post(
            `/users/${user.id}/deposito/movimientos/${movimiento.id}/revertir`,
            { preserveScroll: true },
        );
    }

    const extracto = extractoConSaldo(movimientos, monedaVisible);
    const saldoActual =
        saldos.find((s) => s.moneda === monedaVisible)?.saldo ?? 0;
    const esAjuste = form.data.tipo === 'ajuste';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Cuenta de depósito</DialogTitle>
                    <DialogDescription>
                        {user?.name} — cada movimiento se suma al saldo con su
                        fecha. Nada se edita ni se borra: los errores se
                        corrigen con un contraasiento.
                    </DialogDescription>
                </DialogHeader>

                {/* Saldos por moneda */}
                <div className="flex flex-wrap gap-2">
                    {monedasCuenta.map((moneda) => {
                        const saldo =
                            saldos.find((s) => s.moneda === moneda)?.saldo ?? 0;
                        const activa = moneda === monedaVisible;

                        return (
                            <button
                                key={moneda}
                                type="button"
                                onClick={() => {
                                    setMonedaActiva(moneda);
                                    form.setData('moneda', moneda);
                                }}
                                className={cn(
                                    'flex min-w-32 flex-col items-start rounded-md border px-3 py-2 text-left transition-colors',
                                    activa
                                        ? 'border-foreground bg-muted'
                                        : 'border-border hover:bg-muted',
                                )}
                            >
                                <span className="text-xs tracking-wider text-muted-foreground uppercase">
                                    Saldo {moneda}
                                </span>
                                <span
                                    className={cn(
                                        'text-lg font-semibold',
                                        saldo < 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-foreground',
                                    )}
                                >
                                    {formatMoney(saldo)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {saldoActual < 0 && (
                    <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                        El saldo en {monedaVisible} quedó negativo: los
                        descuentos superan lo depositado.
                    </p>
                )}

                {/* Extracto */}
                <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs tracking-wider text-muted-foreground uppercase dark:bg-muted">
                            <tr>
                                <th className="px-3 py-2 text-left">Fecha</th>
                                <th className="px-3 py-2 text-left">
                                    Movimiento
                                </th>
                                <th className="px-3 py-2 text-right">Monto</th>
                                <th className="px-3 py-2 text-right">Saldo</th>
                                <th className="px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {extracto.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-3 py-6 text-center text-muted-foreground"
                                    >
                                        Sin movimientos en {monedaVisible}.
                                    </td>
                                </tr>
                            ) : (
                                extracto.map(({ mov, saldo }) => (
                                    <tr
                                        key={mov.id}
                                        className={cn(
                                            mov.revertido &&
                                                'text-muted-foreground line-through',
                                        )}
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {formatFecha(mov.fecha)}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="font-medium text-foreground">
                                                {mov.tipo_label}
                                            </span>
                                            {mov.nota && (
                                                <span className="block text-xs text-muted-foreground">
                                                    {mov.nota}
                                                </span>
                                            )}
                                        </td>
                                        <td
                                            className={cn(
                                                'px-3 py-2 text-right font-medium whitespace-nowrap',
                                                mov.monto < 0
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-foreground',
                                            )}
                                        >
                                            {mov.monto > 0 ? '+' : '−'}
                                            {formatMoney(Math.abs(mov.monto))}
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            {formatMoney(saldo)}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {!mov.revertido &&
                                                mov.revierte_id === null && (
                                                    <button
                                                        type="button"
                                                        title="Revertir con contraasiento"
                                                        onClick={() =>
                                                            revertir(mov)
                                                        }
                                                        disabled={
                                                            revertirForm.processing
                                                        }
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                                                    >
                                                        <Undo2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {revertirForm.errors.nota && (
                    <InputError message={revertirForm.errors.nota} />
                )}

                {/* Alta de movimiento */}
                <form
                    onSubmit={registrar}
                    className="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                    <p className="text-sm font-medium text-foreground">
                        Nuevo movimiento
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="mov-tipo">Tipo</Label>
                            <select
                                id="mov-tipo"
                                value={form.data.tipo}
                                onChange={(e) =>
                                    form.setData('tipo', e.target.value)
                                }
                                className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none"
                            >
                                {tipos.map((t) => (
                                    <option
                                        key={t.value}
                                        value={t.value}
                                        className="bg-background text-foreground"
                                    >
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                            <InputError message={form.errors.tipo} />
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label htmlFor="mov-moneda">Moneda</Label>
                            <select
                                id="mov-moneda"
                                value={form.data.moneda}
                                onChange={(e) =>
                                    form.setData('moneda', e.target.value)
                                }
                                className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none"
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
                            <InputError message={form.errors.moneda} />
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label htmlFor="mov-monto">Monto</Label>
                            <MoneyInput
                                id="mov-monto"
                                value={form.data.monto}
                                onValueChange={(n) => form.setData('monto', n)}
                                placeholder="0,00"
                            />
                            <InputError message={form.errors.monto} />
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label htmlFor="mov-fecha">Fecha</Label>
                            <Input
                                id="mov-fecha"
                                type="date"
                                value={form.data.fecha}
                                onChange={(e) =>
                                    form.setData('fecha', e.target.value)
                                }
                            />
                            <InputError message={form.errors.fecha} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label htmlFor="mov-nota">
                            Nota {esAjuste ? '(obligatoria)' : '(opcional)'}
                        </Label>
                        <Input
                            id="mov-nota"
                            value={form.data.nota}
                            onChange={(e) =>
                                form.setData('nota', e.target.value)
                            }
                            placeholder={
                                esAjuste
                                    ? 'Motivo de la corrección'
                                    : 'Detalle del movimiento'
                            }
                        />
                        <InputError message={form.errors.nota} />
                    </div>

                    {esAjuste && (
                        <p className="text-xs text-muted-foreground">
                            En un ajuste, un monto negativo resta del saldo.
                        </p>
                    )}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={form.processing}>
                            Registrar movimiento
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
