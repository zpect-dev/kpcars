import type { Vehiculo } from '@/types';

export type EstadoPatente = 'buen_estado' | 'mal_estado' | 'provisional' | 'no_posee' | null;

export const ESTADO_PATENTE_OPCIONES: { value: Exclude<EstadoPatente, null>; label: string }[] = [
    { value: 'buen_estado', label: 'Buen estado' },
    { value: 'mal_estado', label: 'Mal estado' },
    { value: 'provisional', label: 'Provisional' },
    { value: 'no_posee', label: 'No posee' },
];

export function estadoPatenteBadge(estado: EstadoPatente): { label: string; badge: string; dot: string } {
    switch (estado) {
        case 'buen_estado':
            return { label: 'Buen estado', badge: 'bg-success-soft text-success-soft-foreground', dot: 'bg-success' };
        case 'mal_estado':
            return { label: 'Mal estado', badge: 'bg-destructive-soft text-destructive-soft-foreground', dot: 'bg-destructive' };
        case 'provisional':
            return { label: 'Provisional', badge: 'bg-warning-soft text-warning-soft-foreground', dot: 'bg-warning' };
        case 'no_posee':
            return { label: 'No posee', badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/50' };
        default:
            return { label: 'Sin estado', badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/40' };
    }
}

/**
 * Documentos del vehículo. Cédula y título están completos con un PDF o con
 * frente + dorso; el seguro con su archivo. "Falta" si no hay ninguna modalidad.
 */
export function faltaCedula(v: Vehiculo): boolean {
    const c = v.documentos?.cedula;

    return !c?.pdf && !(c?.frente && c?.dorso);
}

export function faltaTitulo(v: Vehiculo): boolean {
    const t = v.documentos?.titulo;

    return !t?.pdf && !(t?.frente && t?.dorso);
}

export function faltaSeguroDoc(v: Vehiculo): boolean {
    return !v.documentos?.seguro?.archivo;
}

/** Al vehículo le falta al menos un documento (cédula, título o seguro). */
export function faltaAlgunDocVehiculo(v: Vehiculo): boolean {
    return faltaCedula(v) || faltaTitulo(v) || faltaSeguroDoc(v);
}
