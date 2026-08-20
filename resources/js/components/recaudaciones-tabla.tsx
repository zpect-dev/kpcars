/**
 * Punto de entrada de Recaudaciones. El archivo tenía 1.093 líneas con cinco
 * modales adentro; ahora vive partido en `components/recaudaciones/` y esto
 * queda como fachada para no tocar a las tres vistas que lo consumen.
 */
export { EstadoBadge } from '@/components/recaudaciones/estado-badge';
export { formatARS, formatDate, getInitials } from '@/components/recaudaciones/format';
export { ResumenRecaudacionModal } from '@/components/recaudaciones/resumen-modal';
export { RecaudacionesTabla } from '@/components/recaudaciones/tabla';
