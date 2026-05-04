import type { User } from './auth';

export interface Empresa {
    id: number;
    nombre: string;
    created_at?: string;
    updated_at?: string;
}

export interface Inversion {
    id: number;
    nombre: string;
    created_at?: string;
    updated_at?: string;
}

export interface Vehiculo {
    id: number;
    patente: string;
    marca: string;
    modelo: string;
    anio: string;
    propietario: string | null;
    user_id: number | null;
    inversion_id: number;
    empresa_id: number | null;
    fecha_vencimiento_vtv?: string | null;
    fecha_vencimiento_gnc?: string | null;
    user?: User | null;
    inversion?: Inversion | null;
    empresa?: Empresa | null;
    created_at?: string;
    updated_at?: string;
}

export interface Articulo {
    id: number;
    descripcion: string;
    stock: number;
    min_stock: number;
    precio: number;
    created_at?: string;
    updated_at?: string;
}

export interface ServiceType {
    id: number;
    name: string;
    description: string | null;
    required_slots: number;
    created_at?: string;
    updated_at?: string;
}

export interface Appointment {
    id: number;
    service_type_id: number;
    license_plate: string;
    applicant: string;
    scheduled_date: string;
    status: 'pending' | 'completed' | 'cancelled';
    service_type?: ServiceType;
    created_at?: string;
    updated_at?: string;
}

export interface Revision {
    id: number;
    vehiculo_id: number;
    revisado_por?: number | null;
    fecha_vencimiento_vtv?: string | null;
    fecha_vencimiento_gnc?: string | null;
    limpieza: 'mala' | 'buena';
    nivel_nafta: 'bajo' | 'optimo';
    kilometraje: number;
    rueda_auxiliar: boolean;
    kit_seguridad: boolean;
    sticker: boolean;
    observaciones?: string | null;
    vehiculo?: Vehiculo | null;
    revisor?: { id: number; name: string } | null;
    created_at?: string;
    updated_at?: string;
}

// ─── Cobros Module ──────────────────────────────────────────────────────────────

export interface CobroResumenInversion {
    inversion_id: number;
    empresa_id: number;
    inversion_nombre: string;
    empresa_nombre: string;
    total: number;
    transacciones_count: number;
}

export interface CierreDetalle {
    inversion_nombre: string;
    total: number;
}

export interface CierreHistorial {
    id: number;
    user: { id: number; name: string } | null;
    total: number;
    detalles: CierreDetalle[];
    created_at: string;
}

export interface CobroDesglose {
    vehiculo_id: number;
    patente: string;
    marca: string;
    modelo: string;
    subtotal: number;
}

export interface CobroTransaccion {
    id: number;
    patente: string;
    articulo: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
}
