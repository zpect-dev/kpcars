import { useForm } from '@inertiajs/react';
import { AlertCircle, Check, Minus, Package, Plus, Warehouse, Wrench } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { formatARS, precioDesdeCosto } from '@/components/inventario/logica';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { update } from '@/routes/articulos';
import type { Articulo } from '@/types';

/** Modal de edición de un artículo del inventario. */
export function EditarArticuloModal({
    item,
    isAdmin,
    canWrite,
    onClose,
}: {
    item: Articulo | null;
    isAdmin: boolean;
    canWrite: boolean;
    onClose: () => void;
}) {
    const form = useForm({
        descripcion: '',
        codigo: '',
        repuestos: true as boolean,
        min_stock: '0',
        costo: '',
    });

    const [lastId, setLastId] = useState<number | null>(null);

    if (item && item.id !== lastId) {
        form.setData({
            descripcion: item.descripcion,
            codigo: item.codigo ?? '',
            repuestos: Boolean(item.repuestos),
            min_stock: String(item.min_stock),
            costo: item.costo != null ? String(item.costo) : '',
        });
        setLastId(item.id);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!item) {
return;
}

        form.patch(update.url(item.id), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: onClose,
        });
    }

    const sinStock = item ? item.stock === 0 : false;
    const lowStock = item ? item.stock > 0 && item.stock <= item.min_stock : false;

    const costoNum = parseFloat(form.data.costo);
    const precioPreview = !isNaN(costoNum) && costoNum > 0
        ? precioDesdeCosto(costoNum)
        : item?.precio ?? 0;

    return (
        <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                {/* Header */}
                <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <DialogTitle className="truncate text-base font-semibold">
                            {item?.descripcion}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {item?.repuestos ? 'Repuesto' : 'Galpón'}
                            {item?.codigo ? ` · Cód. ${item.codigo}` : ''}
                        </DialogDescription>
                    </div>
                </div>

                {/* Stock actual — info destacada */}
                <div className="flex items-center gap-6 border-b border-border bg-muted/30 px-5 py-4">
                    <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Stock actual</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className={cn(
                                'text-3xl font-bold tabular-nums',
                                sinStock ? 'text-destructive' : lowStock ? 'text-warning-soft-foreground' : 'text-foreground',
                            )}>
                                {item?.stock ?? 0}
                            </span>
                            <span className="text-sm text-muted-foreground">unidades</span>
                        </div>
                    </div>
                    {(sinStock || lowStock) && (
                        <div className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium',
                            sinStock
                                ? 'bg-destructive-soft text-destructive-soft-foreground'
                                : 'bg-warning-soft text-warning-soft-foreground',
                        )}>
                            <AlertCircle className="h-3.5 w-3.5" />
                            {sinStock ? 'Sin stock' : 'Por debajo del mínimo'}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
                    {/* Descripción */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edit-descripcion" className="text-sm font-medium">Descripción</Label>
                        <Input
                            id="edit-descripcion"
                            value={form.data.descripcion}
                            onChange={(e) => form.setData('descripcion', e.target.value)}
                            disabled={!canWrite}
                        />
                        <InputError message={form.errors.descripcion} />
                    </div>

                    {/* Código interno: se autogenera al crear, se puede ajustar acá. */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edit-codigo" className="text-sm font-medium">Código</Label>
                        <Input
                            id="edit-codigo"
                            value={form.data.codigo}
                            onChange={(e) => form.setData('codigo', e.target.value.toUpperCase())}
                            disabled={!canWrite}
                            className="font-mono uppercase"
                            placeholder="AMO-01"
                        />
                        <p className="text-xs text-muted-foreground">
                            Código corto para anotar en papel y buscar rápido. Tiene que ser único.
                        </p>
                        <InputError message={form.errors.codigo} />
                    </div>

                    {/* Stock mínimo con stepper */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium">Stock mínimo</Label>
                        <p className="text-xs text-muted-foreground">
                            Si el stock cae por debajo de este número, aparece una alerta.
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="flex overflow-hidden rounded-lg border border-border">
                                <button
                                    type="button"
                                    onClick={() => form.setData('min_stock', String(Math.max(0, Number(form.data.min_stock) - 1)))}
                                    className="flex h-10 w-10 items-center justify-center border-r border-border bg-muted transition-colors hover:bg-muted/70"
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={form.data.min_stock}
                                    onChange={(e) => form.setData('min_stock', e.target.value)}
                                    className="w-16 bg-card text-center text-xl font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => form.setData('min_stock', String(Number(form.data.min_stock) + 1))}
                                    className="flex h-10 w-10 items-center justify-center border-l border-border bg-muted transition-colors hover:bg-muted/70"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            <span className="text-sm text-muted-foreground">unidades mínimas</span>
                        </div>
                        <InputError message={form.errors.min_stock} />
                    </div>

                    {/* Tipo */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium">Tipo</Label>
                        <div className="flex gap-1 rounded-xl bg-muted p-1">
                            <button
                                type="button"
                                onClick={() => form.setData('repuestos', true)}
                                className={cn(
                                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all',
                                    form.data.repuestos ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Wrench className="h-3.5 w-3.5" /> Repuesto
                            </button>
                            <button
                                type="button"
                                onClick={() => form.setData('repuestos', false)}
                                className={cn(
                                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all',
                                    !form.data.repuestos ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Warehouse className="h-3.5 w-3.5" /> Galpón
                            </button>
                        </div>
                    </div>

                    {/* Costo — solo admin */}
                    {isAdmin && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edit-costo" className="text-sm font-medium">Costo (ARS)</Label>
                            <MoneyInput
                                id="edit-costo"
                                value={form.data.costo === '' ? null : Number(form.data.costo)}
                                onValueChange={(n) => form.setData('costo', n == null ? '' : String(n))}
                                placeholder="0,00"
                            />
                            {precioPreview > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Precio de venta (+45%): <span className="font-semibold text-foreground">{formatARS(precioPreview)}</span>
                                </p>
                            )}
                            <InputError message={form.errors.costo} />
                        </div>
                    )}

                    <DialogFooter className="flex-row gap-2 border-t border-border pt-4">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={form.processing} className="flex-1">
                            {form.processing ? 'Guardando...' : <><Check className="h-4 w-4" /> Guardar cambios</>}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
