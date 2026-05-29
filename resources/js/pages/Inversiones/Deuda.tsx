import { Head, router, useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MoneyDual } from '@/components/money-dual';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import InputError from '@/components/input-error';
import { useState } from 'react';

interface Movimiento {
    id: number;
    tipo: 'cargo' | 'pago';
    monto: string;
    descripcion: string | null;
    created_at: string;
    registrado_por: { id: number; name: string } | null;
}

interface Props {
    inversion: { id: number; nombre: string };
    user: { id: number; name: string; dni: string };
    movimientos: Movimiento[];
    saldo: number;
    tasaActual: number | null;
}

function formatDate(d: string): string {
    return new Date(d).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function DeudaShow({ inversion, user, movimientos, saldo, tasaActual }: Props) {
    const [openForm, setOpenForm] = useState(false);

    const form = useForm({
        tipo: 'cargo' as 'cargo' | 'pago',
        monto: '' as string,
        descripcion: '' as string,
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        form.post(`/inversiones/${inversion.id}/inversores/${user.id}/deuda`, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setOpenForm(false);
            },
        });
    }

    return (
        <>
            <Head title={`Deuda — ${user.name}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.get('/inversiones')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Volver</span>
                    </Button>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            {user.name}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            DNI {user.dni} — Inversión: {inversion.nombre}
                        </p>
                    </div>
                </div>

                {/* Saldo card */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                        Saldo de deuda
                    </p>
                    <div className="mt-1">
                        <MoneyDual
                            ars={saldo}
                            tasa={tasaActual}
                            orientation="stacked"
                            size="xl"
                            arsClassName={
                                saldo > 0
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                            }
                        />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Positivo = adeuda. Cero o negativo = saldado.
                    </p>
                </div>

                <div className="flex justify-end">
                    <Button size="sm" onClick={() => setOpenForm(true)}>
                        Registrar movimiento
                    </Button>
                </div>

                {/* Movimientos */}
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    {movimientos.length === 0 ? (
                        <p className="p-8 text-center text-sm text-muted-foreground italic">
                            Sin movimientos.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {movimientos.map((m) => (
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
                                                {m.tipo === 'cargo'
                                                    ? 'Cargo'
                                                    : 'Pago'}
                                            </p>
                                            <span className="inline-flex items-center gap-1.5">
                                                <span
                                                    className={`text-sm font-bold ${
                                                        m.tipo === 'cargo'
                                                            ? 'text-red-700 dark:text-red-400'
                                                            : 'text-emerald-700 dark:text-emerald-400'
                                                    }`}
                                                >
                                                    {m.tipo === 'cargo' ? '+' : '−'}
                                                </span>
                                                <MoneyDual
                                                    ars={Number(m.monto)}
                                                    tasa={tasaActual}
                                                    size="md"
                                                    arsClassName={
                                                        m.tipo === 'cargo'
                                                            ? 'text-red-700 dark:text-red-400'
                                                            : 'text-emerald-700 dark:text-emerald-400'
                                                    }
                                                />
                                            </span>
                                        </div>
                                        {m.descripcion && (
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {m.descripcion}
                                            </p>
                                        )}
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                            {formatDate(m.created_at)}
                                            {m.registrado_por
                                                ? ` — ${m.registrado_por.name}`
                                                : ''}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <Dialog open={openForm} onOpenChange={setOpenForm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar movimiento</DialogTitle>
                        <DialogDescription>
                            Cargo = suma a la deuda. Pago = descuenta.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="tipo">Tipo</Label>
                            <Select
                                value={form.data.tipo}
                                onValueChange={(v) =>
                                    form.setData('tipo', v as 'cargo' | 'pago')
                                }
                            >
                                <SelectTrigger id="tipo">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cargo">Cargo</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.tipo} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="monto">Monto (ARS)</Label>
                            <Input
                                id="monto"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={form.data.monto}
                                onChange={(e) =>
                                    form.setData('monto', e.target.value)
                                }
                            />
                            <InputError message={form.errors.monto} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="descripcion">
                                Descripción (opcional)
                            </Label>
                            <Input
                                id="descripcion"
                                type="text"
                                maxLength={500}
                                value={form.data.descripcion}
                                onChange={(e) =>
                                    form.setData('descripcion', e.target.value)
                                }
                            />
                            <InputError message={form.errors.descripcion} />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpenForm(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.processing || !form.data.monto}
                            >
                                {form.processing ? 'Guardando...' : 'Registrar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

DeudaShow.layout = {
    breadcrumbs: [
        { title: 'Inversiones', href: '/inversiones' },
        { title: 'Deuda' },
    ],
};
