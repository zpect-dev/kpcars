import { useForm } from '@inertiajs/react';
import type React from 'react';
import { toast } from 'sonner';
import { formatARS } from '@/components/recaudaciones/format';
import type { RecaudacionFila } from '@/types';

export function useRecaudacionForm(
    fila: RecaudacionFila,
    endpoint: (fila: RecaudacionFila) => string,
) {
    const form = useForm({
        efectivo: fila.efectivo > 0 ? String(fila.efectivo) : '',
        transferencia: fila.transferencia > 0 ? String(fila.transferencia) : '',
        descuento: fila.descuento > 0 ? String(fila.descuento) : '',
        descripcion: fila.descripcion ?? '',
    });

    const efectivo = parseFloat(form.data.efectivo) || 0;
    const transferencia = parseFloat(form.data.transferencia) || 0;
    const descuento = parseFloat(form.data.descuento) || 0;
    const total = efectivo + transferencia;
    const precioEfectivo = Math.max(Number(fila.precio) - descuento, 0);
    const excede = total > precioEfectivo;
    const estado: 'pagado' | 'deuda' = total >= precioEfectivo ? 'pagado' : 'deuda';
    const deuda = Math.max(precioEfectivo - total, 0);

    function save() {
        // Sin aviso el usuario no entiende por qué el guardado no hace nada.
        if (excede) {
            toast.error(
                `${fila.patente}: el total supera el precio menos el descuento (${formatARS(precioEfectivo)}).`,
            );

            return;
        }

        form.transform((data) => ({
            efectivo: parseFloat(data.efectivo) || 0,
            transferencia: parseFloat(data.transferencia) || 0,
            descuento: parseFloat(data.descuento) || 0,
            descripcion: data.descripcion,
        }));
        form.patch(endpoint(fila), { preserveScroll: true });
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            save();
        }
    }

    return {
        form,
        efectivo,
        transferencia,
        descuento,
        total,
        precioEfectivo,
        excede,
        estado,
        deuda,
        save,
        onKeyDown,
    };
}
