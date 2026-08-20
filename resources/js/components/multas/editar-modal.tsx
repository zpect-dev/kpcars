import { useForm } from '@inertiajs/react';
import { Check, FileText, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { FormDialog } from '@/components/app/form-dialog';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { formatFecha } from '@/components/multas/logica';
import type { Multa } from '@/components/multas/tipos';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Modal para editar el monto y la fecha de vencimiento de una multa. */
export function EditarMultaModal({
    multa,
    onClose,
    onDelete,
}: {
    multa: Multa | null;
    onClose: () => void;
    onDelete: (id: number) => void;
}) {
    return multa ? (
        <EditarMultaForm
            key={multa.id}
            multa={multa}
            onClose={onClose}
            onDelete={onDelete}
        />
    ) : null;
}

function EditarMultaForm({
    multa,
    onClose,
    onDelete,
}: {
    multa: Multa;
    onClose: () => void;
    onDelete: (id: number) => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const form = useForm({
        monto: String(multa.monto),
        fecha_vencimiento: multa.fecha_vencimiento ?? '',
        punto_rojo: multa.punto_rojo,
        pdf: null as File | null,
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        // El PDF se sube por multipart; en rutas PATCH hay que falsear el método.
        // Los booleanos van como '1'/'0' porque FormData serializa todo a texto.
        form.transform((data) => ({
            ...data,
            punto_rojo: data.punto_rojo ? '1' : '0',
            _method: 'patch',
        }));
        form.post(`/multas/${multa.id}`, {
            preserveScroll: true,
            preserveState: true,
            only: ['multas', 'flash'],
            forceFormData: true,
            onSuccess: () => onClose(),
        });
    }

    // Un punto rojo puede conservar su importe: si se deja el monto en blanco
    // queda como seguimiento sin precio, y si se carga se comporta como una
    // multa normal (suma en totales y se le cobra al chofer).
    const conImporte = form.data.monto !== '' && Number(form.data.monto) > 0;
    const camposOk = form.data.punto_rojo
        ? !conImporte || form.data.fecha_vencimiento !== ''
        : form.data.monto !== '' && form.data.fecha_vencimiento !== '';

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            size="md"
            icon={Pencil}
            title="Editar multa"
            description={
                <>
                    <span className="font-mono font-semibold uppercase">
                        {multa.patente}
                    </span>{' '}
                    · infracción del {formatFecha(multa.fecha)}
                </>
            }
            onSubmit={submit}
            footer={
                <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                    {confirmDelete ? (
                        <>
                            <span className="mr-auto text-xs text-muted-foreground">
                                ¿Seguro que querés eliminarla?
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmDelete(false)}
                            >
                                No
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="bg-destructive text-white hover:bg-destructive/90 dark:text-background"
                                onClick={() => onDelete(multa.id)}
                            >
                                <Trash2 className="size-3.5" /> Sí, eliminar
                            </Button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="mr-auto rounded text-xs text-muted-foreground/60 underline-offset-2 transition-colors outline-none hover:text-destructive hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                Eliminar multa
                            </button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                            >
                                <X className="size-4" /> Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={!camposOk || form.processing}
                            >
                                {form.processing ? (
                                    'Guardando...'
                                ) : (
                                    <>
                                        <Check className="size-4" /> Guardar
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            }
        >
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-monto">Monto total</Label>
                    <MoneyInput
                        id="edit-monto"
                        placeholder="0,00"
                        value={
                            form.data.monto === ''
                                ? null
                                : Number(form.data.monto)
                        }
                        onValueChange={(n) =>
                            form.setData('monto', n == null ? '' : String(n))
                        }
                    />
                    <InputError message={form.errors.monto} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-vto">Fecha de vencimiento</Label>
                    <Input
                        id="edit-vto"
                        type="date"
                        value={form.data.fecha_vencimiento}
                        min={multa.fecha}
                        onChange={(e) =>
                            form.setData('fecha_vencimiento', e.target.value)
                        }
                    />
                    <InputError message={form.errors.fecha_vencimiento} />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
                    <input
                        type="checkbox"
                        checked={form.data.punto_rojo}
                        onChange={(e) =>
                            form.setData('punto_rojo', e.target.checked)
                        }
                        className="size-4 rounded border-input accent-[var(--destructive)]"
                    />
                    <span className="flex items-center gap-1.5 text-sm text-foreground">
                        <span
                            aria-hidden="true"
                            className="size-2.5 rounded-full bg-destructive"
                        />
                        Punto rojo
                    </span>
                </label>
                {form.data.punto_rojo && (
                    <p className="text-xs text-muted-foreground">
                        {conImporte
                            ? 'Conserva el monto: se sigue mostrando el precio y cuenta en los totales y cobros.'
                            : 'Sin monto: es solo seguimiento, se muestra como "—" y no cuenta en totales ni cobros.'}
                    </p>
                )}
                <InputError message={form.errors.punto_rojo} />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>PDF de la multa</Label>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
                    <FileText
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span
                        className={cn(
                            'min-w-0 flex-1 truncate',
                            form.data.pdf
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                        )}
                    >
                        {form.data.pdf
                            ? form.data.pdf.name
                            : multa.pdf_url
                              ? 'Reemplazar PDF (opcional)...'
                              : 'Subir PDF (opcional)...'}
                    </span>
                    <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        onChange={(e) =>
                            form.setData('pdf', e.target.files?.[0] ?? null)
                        }
                    />
                </label>
                {multa.pdf_url && !form.data.pdf && (
                    <a
                        href={multa.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded text-xs text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Ver PDF actual
                    </a>
                )}
                <InputError message={form.errors.pdf} />
            </div>
        </FormDialog>
    );
}
