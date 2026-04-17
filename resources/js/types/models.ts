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
