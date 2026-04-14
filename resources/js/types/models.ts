import type { User } from './auth';

export interface Empresa {
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
    empresa_id: number;
    user?: User | null;
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
