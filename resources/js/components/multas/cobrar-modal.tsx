import { router, useForm } from '@inertiajs/react';
import { Check, FileText, Trash2, User as UserIcon, X } from 'lucide-react';
import { FormDialog } from '@/components/app/form-dialog';
import { StatusBadge } from '@/components/app/status-badge';
import { useImageCropper } from '@/components/image-cropper';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { formatFecha, montoEfectivo } from '@/components/multas/logica';
import type { Multa } from '@/components/multas/tipos';
import { formatARS } from '@/components/recaudaciones-tabla';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Al marcar una multa como cobrada, pide la fecha en que pagó el chofer. */
export function CobrarMultaModal({
    multa,
    onClose,
}: {
    multa: Multa | null;
    onClose: () => void;
}) {
    // La `key` reinicia el formulario al cambiar de multa sin arrastrar estado.
    return multa ? (
        <CobrarMultaForm key={multa.id} multa={multa} onClose={onClose} />
    ) : null;
}

function CobrarMultaForm({
    multa,
    onClose,
}: {
    multa: Multa;
    onClose: () => void;
}) {
    const today = new Date().toISOString().slice(0, 10);
    const total = montoEfectivo(multa);
    const pagado = multa.monto_cobrado;
    const falta = Math.max(total - pagado, 0);
    const fully = multa.cobrado;

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
        form.post(`/multas/${multa.id}/cobrado`, {
            preserveScroll: true,
            preserveState: true,
            only: ['multas', 'flash'],
            forceFormData: true,
            onSuccess: () => onClose(),
        });
    }

    function reiniciar() {
        router.patch(
            `/multas/${multa.id}/cobrado`,
            { reset: true },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['multas', 'flash'],
                onSuccess: () => onClose(),
            },
        );
    }

    function eliminarPago(pagoId: number) {
        router.delete(`/multas/${multa.id}/pagos/${pagoId}`, {
            preserveScroll: true,
            preserveState: true,
            only: ['multas', 'flash'],
            onSuccess: () => onClose(),
        });
    }

    const montoNum = Number(form.data.monto);
    const puedeRegistrar =
        montoNum > 0 && form.data.fecha_cobro !== '' && !form.processing;

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            size="lg"
            icon={UserIcon}
            tone="success"
            title="Cobro al chofer"
            description={
                <>
                    <span className="font-mono font-semibold uppercase">
                        {multa.patente}
                    </span>
                    {multa.conductor ? ` · ${multa.conductor}` : ''}
                </>
            }
            onSubmit={submit}
            footer={
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
                        <X className="size-4" /> Cerrar
                    </Button>
                    {!fully && (
                        <Button type="submit" disabled={!puedeRegistrar}>
                            {form.processing ? (
                                'Guardando...'
                            ) : (
                                <>
                                    <Check className="size-4" /> Registrar pago
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            }
        >
            {cropperElement}

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
            {multa.pagos.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Pagos registrados
                    </p>
                    <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                        {multa.pagos.map((p) => (
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
                                        <StatusBadge tone="info" size="sm">
                                            Transferencia
                                        </StatusBadge>
                                    ) : (
                                        <StatusBadge tone="success" size="sm">
                                            Efectivo
                                        </StatusBadge>
                                    )}
                                </span>
                                {p.comprobante_url ? (
                                    <a
                                        href={p.comprobante_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <FileText
                                            aria-hidden="true"
                                            className="size-3"
                                        />{' '}
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
                                    aria-label={`Eliminar el pago de ${formatARS(p.monto)} del ${formatFecha(p.fecha)}`}
                                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-destructive-soft hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <Trash2
                                        aria-hidden="true"
                                        className="size-3.5"
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {fully ? (
                <p className="text-center text-sm font-medium text-success">
                    Cobrada por completo
                    {multa.cobrada_en
                        ? ` el ${formatFecha(multa.cobrada_en)}`
                        : ''}
                    .
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="cobro-monto">Monto que pagó</Label>
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
                            <InputError message={form.errors.monto} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="cobro-fecha">Fecha del pago</Label>
                            <Input
                                id="cobro-fecha"
                                type="date"
                                value={form.data.fecha_cobro}
                                max={today}
                                onChange={(e) =>
                                    form.setData('fecha_cobro', e.target.value)
                                }
                            />
                            <InputError message={form.errors.fecha_cobro} />
                        </div>
                    </div>

                    {/* Método de pago: efectivo (sin comprobante) o transferencia. */}
                    <div className="flex flex-col gap-1.5">
                        <Label>Método de pago</Label>
                        <div
                            role="group"
                            aria-label="Método de pago"
                            className="inline-flex overflow-hidden rounded-lg border border-border"
                        >
                            <button
                                type="button"
                                aria-pressed={!form.data.es_transferencia}
                                onClick={() => {
                                    form.setData('es_transferencia', false);
                                    form.setData('comprobante', null);
                                }}
                                className={cn(
                                    'flex-1 px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                                    !form.data.es_transferencia
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-transparent text-muted-foreground hover:bg-muted',
                                )}
                            >
                                Efectivo
                            </button>
                            <button
                                type="button"
                                aria-pressed={form.data.es_transferencia}
                                onClick={() =>
                                    form.setData('es_transferencia', true)
                                }
                                className={cn(
                                    'flex-1 border-l border-border px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
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
                            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
                                <FileText
                                    aria-hidden="true"
                                    className="size-4 shrink-0 text-muted-foreground"
                                />
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
                                    className="sr-only"
                                    onChange={(e) => {
                                        handleComprobante(
                                            e.target.files?.[0] ?? null,
                                        );
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                            <InputError message={form.errors.comprobante} />
                        </div>
                    )}

                    <p className="-mt-1 text-xs text-muted-foreground">
                        Si el pago no cubre el total, la multa queda como cobro
                        parcial (pendiente).
                    </p>
                </>
            )}
        </FormDialog>
    );
}
