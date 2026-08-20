import type {
    FiltroEstado,
    FiltroPeriodo,
    Multa,
    Orden,
    Tab,
} from '@/components/multas/tipos';

export function formatFecha(d: string): string {
    const [y, m, day] = d.slice(0, 10).split('-');

    return `${day}/${m}/${y}`;
}

export const HOY = new Date().toISOString().slice(0, 10);

const _d3 = new Date();
_d3.setDate(_d3.getDate() + 3);
export const HOY_PLUS_3 = _d3.toISOString().slice(0, 10);

const _d7 = new Date();
_d7.setDate(_d7.getDate() + 7);
export const HOY_PLUS_7 = _d7.toISOString().slice(0, 10);

export function diasHastaVenc(v: string): number {
    return Math.round(
        (new Date(v).getTime() - new Date(HOY).getTime()) / 86_400_000,
    );
}

/** Una multa está pendiente mientras no esté pagada al sistema de infracciones o no esté cobrada al chofer. */
export function pendiente(m: Multa): boolean {
    return !m.pagado || !m.cobrado;
}

/**
 * Solo las multas de CABA tienen 50% de descuento si se pagan antes (o el mismo
 * día) del vencimiento. Las de GBA (provincia) nunca tienen descuento, y sin
 * fecha de vencimiento tampoco aplica.
 */
export function tieneDescuento(m: Multa): boolean {
    return (
        m.jurisdiccion === 'CABA' &&
        !!m.fecha_vencimiento &&
        HOY <= m.fecha_vencimiento
    );
}

/** Monto vigente hoy: 50% si todavía no venció, total en caso contrario. */
export function montoEfectivo(m: Multa): number {
    return tieneDescuento(m) ? m.monto * 0.5 : m.monto;
}

/**
 * Punto rojo "de seguimiento" sin importe (monto 0): no tiene precio, se muestra
 * como "—" y queda fuera de todos los cálculos financieros. Un punto rojo con
 * monto cargado (monto > 0) cuenta como una multa normal a todos los efectos;
 * solo lleva además la marca roja.
 */
export function sinImporte(m: { punto_rojo: boolean; monto: number }): boolean {
    return m.punto_rojo && m.monto <= 0;
}

/** Lo que falta cobrarle al chofer hoy (0 si ya está cobrada del todo o no tiene importe). */
export function faltante(m: Multa): number {
    if (m.cobrado || sinImporte(m)) {
        return 0;
    }

    return Math.max(montoEfectivo(m) - m.monto_cobrado, 0);
}

/** Estado del cobro al chofer: sin cobrar / parcial / cobrada. */
export function estadoCobro(m: Multa): 'sin' | 'parcial' | 'cobrada' {
    if (m.cobrado) {
        return 'cobrada';
    }

    if (m.monto_cobrado > 0) {
        return 'parcial';
    }

    return 'sin';
}

export function periodoRango(p: FiltroPeriodo): { desde: string; hasta: string } {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    if (p === 'mes') {
        return {
            desde: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
            hasta: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        };
    }

    if (p === 'mes-ant') {
        return {
            desde: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
            hasta: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
        };
    }

    if (p === '3m') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);

        return { desde: iso(d), hasta: iso(now) };
    }

    if (p === 'año') {
        return { desde: `${now.getFullYear()}-01-01`, hasta: iso(now) };
    }

    return { desde: '', hasta: '' };
}

export const ORDEN_LABEL: Record<Orden, string> = {
    pendientes: 'Pendientes primero',
    monto: 'Mayor monto',
    cantidad: 'Más multas',
    alfabetico: 'Alfabético',
};

export const TABS: Tab[] = ['vehiculo', 'chofer', 'ex-chofer', 'ranking', 'reporte'];

export function readParams(): URLSearchParams {
    if (typeof window === 'undefined') {
        return new URLSearchParams();
    }

    return new URLSearchParams(window.location.search);
}

export function normEstado(v: string | null): FiltroEstado {
    return v === 'si' || v === 'no' ? v : '';
}

/** Lunes de la semana a la que pertenece la fecha. */
export function lunesDe(d: Date): Date {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (x.getDay() + 6) % 7; // 0 = lunes
    x.setDate(x.getDate() - dow);

    return x;
}

export function isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
