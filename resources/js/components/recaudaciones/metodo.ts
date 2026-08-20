import { ArrowLeftRight, Banknote, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RecaudacionFila } from '@/types';

export type MetodoPago = 'efectivo' | 'transferencia' | 'mixto';
export type MetodoFiltro = 'all' | MetodoPago;

/**
 * Clasifica una fila por método de pago según lo cargado. Los que no pagaron
 * nada (efectivo = 0 y transferencia = 0) devuelven null y no entran al
 * desglose.
 */
export function clasificarMetodo(f: RecaudacionFila): MetodoPago | null {
    const e = Number(f.efectivo) > 0;
    const t = Number(f.transferencia) > 0;

    if (e && t) {
        return 'mixto';
    }

    if (e) {
        return 'efectivo';
    }

    if (t) {
        return 'transferencia';
    }

    return null;
}

/**
 * Los métodos de pago son categorías, no estados: ninguno es mejor ni peor que
 * otro. Por eso van con tonos que no sugieren juicio.
 */
export const METODOS: {
    key: MetodoPago;
    label: string;
    icon: LucideIcon;
    color: string;
}[] = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote, color: 'text-success' },
    {
        key: 'transferencia',
        label: 'Transferencia',
        icon: ArrowLeftRight,
        color: 'text-info',
    },
    { key: 'mixto', label: 'Mixto', icon: Wallet, color: 'text-primary' },
];

export const METODO_LABEL: Record<MetodoPago, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    mixto: 'Mixto',
};
