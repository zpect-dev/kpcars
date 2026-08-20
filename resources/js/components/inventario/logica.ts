/** Descripción automática para los egresos de artículos del galpón. */
export const GALPON_DESC = 'Artículos para galpón';

/** Markup de venta: el precio se calcula sumándole un 45% al costo. */
export const MARKUP = 1.45;

export function precioDesdeCosto(costo: number): number {
    return Math.round(costo * MARKUP * 100) / 100;
}

export function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}
