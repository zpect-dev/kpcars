import { router, useForm } from '@inertiajs/react';
import { Check, FileText, HandCoins, Trash2, User as UserIcon, X } from 'lucide-react';
import { estadoCobro, formatFecha } from '@/components/actas/tipos';
import type { Acta } from '@/components/actas/tipos';
import { useImageCropper } from '@/components/image-cropper';
import { formatARS } from '@/components/money-dual';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import {
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function CobroButton({ acta, onClick }: { acta: Acta; onClick: () => void }) {
    if (acta.sin_importe) {
        return (
            <span className="text-xs text-muted-foreground/60 italic">
                Sin importe
            </span>
        );
    }

    const estado = estadoCobro(acta);

    const estilos = {
        sin: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
        parcial:
            'border-warning/40 bg-warning-soft text-warning-soft-foreground hover:bg-warning/20',
        cobrada:
            'border-success/40 bg-success-soft text-success-soft-foreground hover:bg-success/20',
    }[estado];

    const label = {
        sin: 'Cobrar',
        parcial: 'Parcial',
        cobrada: 'Cobrada',
    }[estado];

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                estilos,
            )}
        >
            <HandCoins className="h-3.5 w-3.5" />
            {label}
        </button>
    );
}

export function CobrarActaForm({
    acta,
    onClose,
}: {
    acta: Acta;
    onClose: () => void;
}) {
    const today = new Date().toISOString().slice(0, 10);
    const total = acta.monto_efectivo;
    const pagado = acta.monto_cobrado;
    const falta = Math.max(total - pagado, 0);
    const fully = acta.cobrado;

    const form = useForm({
        monto: fully ? '' : String(falta.toFixed(2)),
        fecha_cobro: today,
        comprobante: null as File | null,
        es_transferencia: false,
    });

    const { cropImage, cropperElement } = useImageCropper();

    async function handleComprobante(f: File | null) {
        // Solo las imágenes pasan por el editor de recorte; los PDF van directo.
        if (f && f.type.startsWith('image/')) {
            try {
                form.setData('comprobante', await cropImage(f));
            } catch {
                // recorte cancelado
            }

            return;
        }

        form.setData('comprobante', f);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        // Comprobante por multipart; la ruta es PATCH, hay que falsear el método.
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post(`/actas/${acta.id}/cobrado`, {
            preserveScroll: true,
            preserveState: true,
            only: ['actas', 'stats', 'flash'],
            forceFormData: true,
            onSuccess: () => onClose(),
        });
    }

    function reiniciar() {
        router.patch(
            `/actas/${acta.id}/cobrado`,
            { reset: true },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['actas', 'stats', 'flash'],
                onSuccess: () => onClose(),
            },
        );
    }

    function eliminarPago(pagoId: number) {
        router.delete(`/actas/${acta.id}/pagos/${pagoId}`, {
            preserveScroll: true,
            preserveState: true,
            only: ['actas', 'stats', 'flash'],
            onSuccess: () => onClose(),
        });
    }

    const montoNum = Number(form.data.monto);
    const puedeRegistrar =
        montoNum > 0 && form.data.fecha_cobro !== '' && !form.processing;

    return (
        <form onSubmit={submit}>
            {cropperElement}
            <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft">
                    <UserIcon aria-hidden="true" className="size-5 text-success-soft-foreground" />
                </div>
                <div className="flex-1">
                    <DialogTitle className="text-base font-semibold">
                        Cobro al chofer
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        <span className="font-mono font-semibold uppercase">
                            {acta.patente}
                        </span>
                        {acta.conductor ? ` · ${acta.conductor}` : ''}
                    </DialogDescription>
                </div>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5">
                {/* Resumen del cobro */}
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center">
                    <div>
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                            Total
                        </p>
                        <p className="text-sm font-bold text-foreground tabular-nums">
                            {formatARS(total)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                            Pagado
                        </p>
                        <p className="text-sm font-bold text-success tabular-nums">
                            {formatARS(pagado)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                            Falta
                        </p>
                        <p
                            className={cn(
                                'text-sm font-bold tabular-nums',
                                falta > 0
                                    ? 'text-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {formatARS(falta)}
                        </p>
                    </div>
                </div>

                {/* Pagos registrados */}
                {acta.pagos.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Pagos registrados
                        </p>
                        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                            {acta.pagos.map((p) => (
                                <div
                                    key={p.id}
                                    className="flex items-center gap-2 px-3 py-2"
                                >
                                    <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                                        {formatFecha(p.fecha)}
                                    </span>
                                    <span className="text-sm font-semibold text-foreground tabular-nums">
                                        {formatARS(p.monto)}
                                    </span>
                                    <span className="flex-1">
                                        {p.es_transferencia ? (
                                            <span
                                                className="inline-flex items-center rounded border border-info/30 bg-info-soft px-1.5 py-0.5 text-xs font-semibold text-info-soft-foreground"
                                                title="Pagado por transferencia"
                                            >
                                                Transferencia
                                            </span>
                                        ) : (
                                            <span
                                                className="inline-flex items-center rounded border border-success/30 bg-success-soft px-1.5 py-0.5 text-xs font-semibold text-success-soft-foreground"
                                                title="Pagado en efectivo"
                                            >
                                                Efectivo
                                            </span>
                                        )}
                                    </span>
                                    {p.comprobante_url ? (
                                        <a
                                            href={p.comprobante_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Ver comprobante"
                                            className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                            <FileText className="h-3 w-3" />{' '}
                                            Comp.
                                        </a>
                                    ) : (
                                        <span className="text-xs text-muted-foreground/60">
                                            sin comprobante
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => eliminarPago(p.id)}
                                        title="Eliminar pago"
                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-destructive-soft hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {fully ? (
                    <p className="text-center text-sm font-medium text-success">
                        Cobrada por completo
                        {acta.cobrada_en
                            ? ` el ${formatFecha(acta.cobrada_en)}`
                            : ''}
                        .
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cobro-monto">
                                    Monto que pagó
                                </Label>
                                <MoneyInput
                                    id="cobro-monto"
                                    value={
                                        form.data.monto === ''
                                            ? null
                                            : Number(form.data.monto)
                                    }
                                    onValueChange={(n) =>
                                        form.setData(
                                            'monto',
                                            n == null ? '' : String(n),
                                        )
                                    }
                                />
                                {form.errors.monto && (
                                    <p className="text-xs text-destructive">
                                        {form.errors.monto}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cobro-fecha">
                                    Fecha del pago
                                </Label>
                                <Input
                                    id="cobro-fecha"
                                    type="date"
                                    value={form.data.fecha_cobro}
                                    max={today}
                                    onChange={(e) =>
                                        form.setData(
                                            'fecha_cobro',
                                            e.target.value,
                                        )
                                    }
                                />
                                {form.errors.fecha_cobro && (
                                    <p className="text-xs text-destructive">
                                        {form.errors.fecha_cobro}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Método de pago: efectivo (sin comprobante) o transferencia. */}
                        <div className="flex flex-col gap-1.5">
                            <Label>Método de pago</Label>
                            <div className="inline-flex overflow-hidden rounded-lg border border-border">
                                <button
                                    type="button"
                                    onClick={() => {
                                        form.setData('es_transferencia', false);
                                        form.setData('comprobante', null);
                                    }}
                                    className={cn(
                                        'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                                        !form.data.es_transferencia
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-transparent text-muted-foreground hover:bg-muted',
                                    )}
                                >
                                    Efectivo
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        form.setData('es_transferencia', true)
                                    }
                                    className={cn(
                                        'flex-1 border-l border-border px-3 py-2 text-sm font-medium transition-colors',
                                        form.data.es_transferencia
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-transparent text-muted-foreground hover:bg-muted',
                                    )}
                                >
                                    Transferencia
                                </button>
                            </div>
                        </div>

                        {/* El comprobante solo aplica a la transferencia; en efectivo no se pide. */}
                        {form.data.es_transferencia && (
                            <div className="flex flex-col gap-1.5">
                                <Label>
                                    Comprobante{' '}
                                    <span className="font-normal text-muted-foreground">
                                        (opcional)
                                    </span>
                                </Label>
                                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40">
                                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span
                                        className={cn(
                                            'min-w-0 flex-1 truncate',
                                            form.data.comprobante
                                                ? 'text-foreground'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {form.data.comprobante
                                            ? form.data.comprobante.name
                                            : 'Adjuntar comprobante (PDF o imagen)...'}
                                    </span>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            handleComprobante(
                                                e.target.files?.[0] ?? null,
                                            );
                                            e.target.value = '';
                                        }}
                                    />
                                </label>
                                {form.errors.comprobante && (
                                    <p className="text-xs text-destructive">
                                        {form.errors.comprobante}
                                    </p>
                                )}
                            </div>
                        )}

                        <p className="-mt-1 text-xs text-muted-foreground">
                            Si el pago no cubre el total, el acta queda como
                            cobro parcial (pendiente).
                        </p>
                    </>
                )}
            </div>

            <DialogFooter className="flex flex-row flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
                {pagado > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={reiniciar}
                        className="mr-auto text-destructive hover:bg-destructive-soft hover:text-destructive"
                    >
                        Reiniciar cobro
                    </Button>
                )}
                <Button type="button" variant="outline" onClick={onClose}>
                    <X className="h-4 w-4" /> Cerrar
                </Button>
                {!fully && (
                    <Button type="submit" disabled={!puedeRegistrar}>
                        {form.processing ? (
                            'Guardando...'
                        ) : (
                            <>
                                <Check className="h-4 w-4" /> Registrar pago
                            </>
                        )}
                    </Button>
                )}
            </DialogFooter>
        </form>
    );
}
