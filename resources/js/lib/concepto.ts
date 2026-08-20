// Labels y colores para los conceptos de pago de inversión.
// Fuente única — importar desde acá en todos los componentes.
//
// Los tonos salen de los tokens semánticos del tema, no de la paleta cruda:
//   parte_completa              cobra completo            -> success
//   media_parte_deudor          cobra la mitad por deuda   -> warning
//   cero_deudor                 no cobra                   -> destructive
//   redistribucion_financiador  es una categoría, no un
//                               estado bueno ni malo       -> info

export const CONCEPTO_LABEL: Record<string, string> = {
    parte_completa:             'Parte completa',
    media_parte_deudor:         'Media parte (deudor que abonó)',
    cero_deudor:                'Cero (deudor)',
    redistribucion_financiador: 'Redistribución (financiador)',
};

export const CONCEPTO_COLOR: Record<string, string> = {
    parte_completa:             'text-foreground',
    media_parte_deudor:         'text-warning-soft-foreground',
    cero_deudor:                'text-muted-foreground',
    redistribucion_financiador: 'text-info-soft-foreground',
};

// Estilo "píldora" (borde + fondo tintado + texto) para resaltar el concepto.
export const CONCEPTO_PILL: Record<string, string> = {
    parte_completa:             'border-success/25 bg-success-soft text-success-soft-foreground',
    media_parte_deudor:         'border-warning/25 bg-warning-soft text-warning-soft-foreground',
    cero_deudor:                'border-destructive/25 bg-destructive-soft text-destructive-soft-foreground',
    redistribucion_financiador: 'border-info/25 bg-info-soft text-info-soft-foreground',
};

// Vista del inversor (Mi Cuenta): labels amigables
const CONCEPTO_DISPLAY: Record<string, { label: string; cls: string }> = {
    parte_completa:             { label: 'Sueldo flota',        cls: 'text-success' },
    redistribucion_financiador: { label: 'Sueldo financista',   cls: 'text-info-soft-foreground' },
    media_parte_deudor:         { label: 'Media parte · deudor', cls: 'text-warning-soft-foreground' },
    cero_deudor:                { label: 'Sin cobro · deudor',   cls: 'text-muted-foreground' },
};

export function getConceptoDisplay(concepto: string): { label: string; cls: string } {
    return CONCEPTO_DISPLAY[concepto] ?? { label: concepto, cls: 'text-muted-foreground' };
}

export const FLOTA_CONCEPTOS = new Set(['parte_completa', 'media_parte_deudor', 'cero_deudor']);
