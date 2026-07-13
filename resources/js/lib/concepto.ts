// Labels y colores para los conceptos de pago de inversión.
// Fuente única — importar desde acá en todos los componentes.

export const CONCEPTO_LABEL: Record<string, string> = {
    parte_completa:             'Parte completa',
    media_parte_deudor:         'Media parte (deudor que abonó)',
    cero_deudor:                'Cero (deudor)',
    redistribucion_financiador: 'Redistribución (financiador)',
};

export const CONCEPTO_COLOR: Record<string, string> = {
    parte_completa:             'text-foreground',
    media_parte_deudor:         'text-amber-500 dark:text-amber-400',
    cero_deudor:                'text-muted-foreground',
    redistribucion_financiador: 'text-violet-500 dark:text-violet-400',
};

// Estilo "píldora" (borde + fondo tintado + texto) para resaltar el concepto.
export const CONCEPTO_PILL: Record<string, string> = {
    parte_completa:             'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    media_parte_deudor:         'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    cero_deudor:                'border-rose-500/25 bg-rose-500/10 text-rose-500 dark:text-rose-400',
    redistribucion_financiador: 'border-violet-500/25 bg-violet-500/10 text-violet-500 dark:text-violet-400',
};

// Vista del inversor (Mi Cuenta): labels amigables
const CONCEPTO_DISPLAY: Record<string, { label: string; cls: string }> = {
    parte_completa:             { label: 'Sueldo flota',          cls: 'text-emerald-600 dark:text-emerald-400' },
    redistribucion_financiador: { label: 'Sueldo financista',      cls: 'text-violet-500 dark:text-violet-400'  },
    media_parte_deudor:         { label: 'Media parte · deudor',   cls: 'text-amber-500 dark:text-amber-400'    },
    cero_deudor:                { label: 'Sin cobro · deudor',     cls: 'text-muted-foreground'                 },
};

export function getConceptoDisplay(concepto: string): { label: string; cls: string } {
    return CONCEPTO_DISPLAY[concepto] ?? { label: concepto, cls: 'text-muted-foreground' };
}

export const FLOTA_CONCEPTOS = new Set(['parte_completa', 'media_parte_deudor', 'cero_deudor']);
