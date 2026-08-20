import { useForm } from '@inertiajs/react';
import { Check, FileText, Siren, X } from 'lucide-react';
import { useMemo } from 'react';
import { FormDialog } from '@/components/app/form-dialog';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import type { VehiculoOpt } from '@/components/multas/tipos';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function RegistrarMultaModal({
    open,
    onClose,
    vehiculos,
}: {
    open: boolean;
    onClose: () => void;
    vehiculos: VehiculoOpt[];
}) {
    const today = new Date().toISOString().slice(0, 10);
    const form = useForm({
        vehiculo_id: '' as string,
        fecha: today,
        fecha_vencimiento: '' as string,
        monto: '' as string,
        descripcion: '' as string,
        punto_rojo: false,
        jurisdiccion: '' as '' | 'CABA' | 'GBA',
        pdf: null as File | null,
    });

    const opciones: ComboboxOption[] = useMemo(
        () =>
            vehiculos.map((v) => ({
                value: String(v.id),
                label: v.patente,
                sub: `${v.marca} ${v.modelo}`,
            })),
        [vehiculos],
    );

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/multas', {
            preserveScroll: true,
            preserveState: true,
            only: ['multas', 'flash'],
            onSuccess: () => {
                form.reset();
                form.setData('fecha', today);
                onClose();
            },
        });
    }

    const puntoRojo = form.data.punto_rojo;
    const canSubmit =
        form.data.vehiculo_id !== '' &&
        form.data.fecha !== '' &&
        form.data.descripcion.trim() !== '' &&
        form.data.jurisdiccion !== '' &&
        (puntoRojo ||
            (form.data.fecha_vencimiento !== '' && form.data.monto !== ''));

    function setPuntoRojo(checked: boolean) {
        form.setData((prev) => ({
            ...prev,
            punto_rojo: checked,
            // Punto rojo no tiene importe ni vencimiento/descuento.
            monto: checked ? '' : prev.monto,
            fecha_vencimiento: checked ? '' : prev.fecha_vencimiento,
        }));
    }

    return (
        <FormDialog
            open={open}
            onOpenChange={(o) => {
                if (!o) {
                    form.clearErrors();
                    onClose();
                }
            }}
            size="md"
            icon={Siren}
            tone="destructive"
            title="Registrar multa"
            description="El chofer se determina automáticamente según la fecha."
            onSubmit={submit}
            footer={
                <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                        <X className="size-4" /> Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={!canSubmit || form.processing}
                    >
                        {form.processing ? (
                            'Guardando...'
                        ) : (
                            <>
                                <Check className="size-4" /> Registrar
                            </>
                        )}
                    </Button>
                </DialogFooter>
            }
        >
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="multa-patente">Patente</Label>
                <Combobox
                    id="multa-patente"
                    placeholder="Buscar patente..."
                    options={opciones}
                    value={form.data.vehiculo_id}
                    onSelect={(o) => form.setData('vehiculo_id', o.value)}
                    uppercase
                />
                <InputError message={form.errors.vehiculo_id} />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="multa-fecha">Fecha de infracción</Label>
                    <Input
                        id="multa-fecha"
                        type="date"
                        value={form.data.fecha}
                        max={today}
                        onChange={(e) => form.setData('fecha', e.target.value)}
                    />
                    <InputError message={form.errors.fecha} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="multa-vto">Fecha de vencimiento</Label>
                    <Input
                        id="multa-vto"
                        type="date"
                        value={form.data.fecha_vencimiento}
                        min={form.data.fecha}
                        disabled={puntoRojo}
                        onChange={(e) =>
                            form.setData('fecha_vencimiento', e.target.value)
                        }
                        className={cn(
                            puntoRojo && 'cursor-not-allowed opacity-50',
                        )}
                    />
                    <InputError message={form.errors.fecha_vencimiento} />
                </div>
            </div>

            <p className="-mt-2 text-xs text-muted-foreground">
                {puntoRojo
                    ? 'Las multas de punto rojo no tienen importe ni vencimiento.'
                    : form.data.jurisdiccion === 'GBA'
                      ? 'Las multas de GBA (provincia) no tienen descuento.'
                      : 'CABA: pagando antes del vencimiento, la multa tiene un 50% de descuento (GBA no tiene descuento).'}
            </p>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="multa-monto">Monto total</Label>
                    <MoneyInput
                        id="multa-monto"
                        placeholder={puntoRojo ? 'Sin monto' : '0,00'}
                        value={
                            form.data.monto === ''
                                ? null
                                : Number(form.data.monto)
                        }
                        disabled={puntoRojo}
                        onValueChange={(n) =>
                            form.setData('monto', n == null ? '' : String(n))
                        }
                        className={cn(
                            puntoRojo && 'cursor-not-allowed opacity-50',
                        )}
                    />
                    <InputError message={form.errors.monto} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label>Jurisdicción</Label>
                    <div
                        role="group"
                        aria-label="Jurisdicción"
                        className="flex gap-1.5"
                    >
                        {(['CABA', 'GBA'] as const).map((j) => (
                            <button
                                key={j}
                                type="button"
                                aria-pressed={form.data.jurisdiccion === j}
                                onClick={() => form.setData('jurisdiccion', j)}
                                className={cn(
                                    'h-9 flex-1 rounded-lg border text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
                                    form.data.jurisdiccion === j
                                        ? 'border-primary/30 bg-primary/10 text-primary'
                                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                {j}
                            </button>
                        ))}
                    </div>
                    <InputError message={form.errors.jurisdiccion} />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="multa-desc">Descripción</Label>
                <textarea
                    id="multa-desc"
                    rows={3}
                    placeholder="Motivo de la multa..."
                    value={form.data.descripcion}
                    onChange={(e) => form.setData('descripcion', e.target.value)}
                    maxLength={1000}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                />
                <InputError message={form.errors.descripcion} />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>
                    PDF de la multa{' '}
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
                            form.data.pdf
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                        )}
                    >
                        {form.data.pdf
                            ? form.data.pdf.name
                            : 'Seleccionar archivo PDF...'}
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
                <InputError message={form.errors.pdf} />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
                <input
                    type="checkbox"
                    checked={form.data.punto_rojo}
                    onChange={(e) => setPuntoRojo(e.target.checked)}
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
        </FormDialog>
    );
}
