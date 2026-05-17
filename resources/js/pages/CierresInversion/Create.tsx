import { Head, router, useForm } from '@inertiajs/react';
import { ArrowLeft, AlertCircle, Calculator, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';
import { useMemo } from 'react';

interface InversionRow {
    id: number;
    nombre: string;
    inversores_count: number;
    deudores: number;
    financiadores: number;
    puede_procesar: boolean;
}

interface Props {
    inversiones: InversionRow[];
    ultimoCierre: { id: number; periodo_fin: string | null } | null;
    maxInversores: number;
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

export default function CierresCreate({
    inversiones,
    ultimoCierre,
    maxInversores,
}: Props) {
    const initial: Record<string, string> = {};
    inversiones.forEach((i) => {
        initial[String(i.id)] = '';
    });

    const form = useForm<{
        recaudaciones: Record<string, string>;
        tasa: string;
    }>({
        recaudaciones: initial,
        tasa: '',
    });

    const todosListos = inversiones.every((i) => i.puede_procesar);

    const totalRecaudado = useMemo(() => {
        return Object.values(form.data.recaudaciones).reduce(
            (acc, v) => acc + (Number(v) || 0),
            0,
        );
    }, [form.data.recaudaciones]);

    const tasaNum = Number(form.data.tasa) || 0;
    const totalRecaudadoUsd = tasaNum > 0 ? totalRecaudado / tasaNum : 0;

    const todosCargados = useMemo(
        () =>
            inversiones.every(
                (i) =>
                    form.data.recaudaciones[String(i.id)] !== '' &&
                    form.data.recaudaciones[String(i.id)] !== undefined,
            ),
        [form.data.recaudaciones, inversiones],
    );

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/cierres-inversion', {
            preserveScroll: true,
        });
    }

    function setMonto(invId: number, value: string) {
        form.setData('recaudaciones', {
            ...form.data.recaudaciones,
            [String(invId)]: value,
        });
    }

    return (
        <>
            <Head title="Nuevo Cierre" />

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
                            Nuevo Cierre de Inversión
                        </h1>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {ultimoCierre
                                ? `Período: desde ${formatDate(ultimoCierre.periodo_fin)} hasta ahora.`
                                : 'Primer cierre — período abierto hasta ahora.'}
                        </p>
                    </div>
                </div>

                {!todosListos && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                                <p className="font-medium">
                                    No se puede procesar todavía:
                                </p>
                                <ul className="mt-1 list-inside list-disc text-xs">
                                    {inversiones
                                        .filter((i) => !i.puede_procesar)
                                        .map((i) => (
                                            <li key={i.id}>
                                                <strong>{i.nombre}</strong>:{' '}
                                                {i.inversores_count !==
                                                maxInversores
                                                    ? `tiene ${i.inversores_count}/${maxInversores} inversores`
                                                    : 'tiene deudores pero sin financiador'}
                                            </li>
                                        ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                    {/* Tasa de cambio del cierre */}
                    <div className="mb-5 grid gap-1.5 border-b border-border pb-4 sm:max-w-xs">
                        <Label htmlFor="tasa">
                            Tasa de cambio (ARS por 1 USD)
                        </Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">
                                $
                            </span>
                            <Input
                                id="tasa"
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                placeholder="Ej. 1050.50"
                                className="pl-6"
                                value={form.data.tasa}
                                onChange={(e) =>
                                    form.setData('tasa', e.target.value)
                                }
                            />
                        </div>
                        <InputError message={form.errors.tasa} />
                        <p className="text-[11px] text-muted-foreground">
                            Se usará para convertir los montos en pesos a
                            dólares.
                        </p>
                    </div>

                    <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                        Recaudado por inversión
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {inversiones.map((inv) => (
                            <div key={inv.id} className="grid gap-1.5">
                                <Label
                                    htmlFor={`monto-${inv.id}`}
                                    className="flex items-center justify-between"
                                >
                                    <span className="truncate">
                                        {inv.nombre}
                                    </span>
                                    {inv.puede_procesar ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                    )}
                                </Label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">
                                        $
                                    </span>
                                    <Input
                                        id={`monto-${inv.id}`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className="pl-6"
                                        value={
                                            form.data.recaudaciones[
                                                String(inv.id)
                                            ] ?? ''
                                        }
                                        onChange={(e) =>
                                            setMonto(inv.id, e.target.value)
                                        }
                                        disabled={!inv.puede_procesar}
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    {inv.deudores} deudor
                                    {inv.deudores === 1 ? '' : 'es'} ·{' '}
                                    {inv.financiadores} financiador
                                    {inv.financiadores === 1 ? '' : 'es'}
                                    {tasaNum > 0 &&
                                        Number(
                                            form.data.recaudaciones[
                                                String(inv.id)
                                            ],
                                        ) > 0 && (
                                            <>
                                                {' · '}
                                                {new Intl.NumberFormat(
                                                    'en-US',
                                                    {
                                                        style: 'currency',
                                                        currency: 'USD',
                                                        minimumFractionDigits: 2,
                                                    },
                                                ).format(
                                                    Number(
                                                        form.data.recaudaciones[
                                                            String(inv.id)
                                                        ],
                                                    ) / tasaNum,
                                                )}
                                            </>
                                        )}
                                </p>
                                <InputError
                                    message={
                                        form.errors[
                                            `recaudaciones.${inv.id}` as keyof typeof form.errors
                                        ] as string | undefined
                                    }
                                />
                            </div>
                        ))}
                    </div>

                    <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-4">
                            <div className="flex items-center gap-2">
                                <Calculator className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                    Total:
                                </span>
                                <span className="text-base font-bold text-foreground">
                                    {formatARS(totalRecaudado)}
                                </span>
                            </div>
                            <span className="text-base font-bold text-foreground">
                                {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    minimumFractionDigits: 2,
                                }).format(totalRecaudadoUsd)}
                            </span>
                        </div>
                        <Button
                            type="submit"
                            disabled={
                                form.processing ||
                                !todosListos ||
                                !todosCargados ||
                                tasaNum <= 0
                            }
                        >
                            {form.processing
                                ? 'Procesando...'
                                : 'Ejecutar cierre'}
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
}

CierresCreate.layout = {
    breadcrumbs: [
        { title: 'Cierres', href: '/cierres-inversion' },
        { title: 'Nuevo' },
    ],
};
