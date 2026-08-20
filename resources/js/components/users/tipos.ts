import type { CuentaDeposito } from '@/components/deposito-cuenta-dialog';
import type { DocUrls } from '@/components/documentos';

/** Fila del depósito inicial que se carga en el alta del chofer. */
export interface DepositoInicial {
    monto: number;
    moneda: string;
    fecha: string;
}

export interface InversionAsignada {
    id: number;
    nombre: string;
    empresa: { id: number; nombre: string } | null;
    pivot: {
        es_financiador: boolean | number;
        deuda: string | number;
        es_deudor?: boolean | number;
    };
}

export interface User {
    id: number;
    name: string;
    dni: string;
    role: string;
    inactivo: boolean;
    estado_actualizado_en?: string | null;
    created_at?: string | null;
    alta_fecha?: string | null;
    baja_fecha?: string | null;
    correo?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    fecha_ingreso?: string | null;
    fecha_vencimiento_licencia?: string | null;
    profile_photo_url?: string | null;
    empresa_default_id?: number | null;
    empresa_restringida_id?: number | null;
    empresas?: { id: number; nombre: string }[];
    inversiones?: InversionAsignada[];
    /** Cuenta de depósito (garantía): saldo por moneda + extracto. */
    deposito?: CuentaDeposito | null;
    documentos?: {
        licencia: DocUrls;
        dni: DocUrls;
    };
    vehiculo?: {
        patente: string;
        marca: string;
        modelo: string;
        precio?: number;
    } | null;
    licencia_por_vencer?: boolean;
    sin_licencia?: boolean;
    falta_foto?: boolean;
}

export interface RoleOption {
    value: string;
    label: string;
}

export interface Empresa {
    id: number;
    nombre: string;
}

export interface MonedaOption {
    value: string;
    label: string;
    symbol: string;
}

export type FilterAlertValue =
    | 'all'
    | 'licencia_vencida'
    | 'licencia_por_vencer'
    | 'sin_licencia'
    | 'falta_foto'
    | 'falta_telefono'
    | 'falta_correo'
    | 'falta_direccion'
    | 'con_direccion'
    | 'falta_deposito'
    | 'deposito_bajo'
    | 'falta_docs'
    | 'falta_doc_dni'
    | 'falta_doc_licencia';

export type SortField =
    | 'nombre'
    | 'dni'
    | 'licencia'
    | 'estado'
    | 'fecha_estado'
    | 'deposito'
    | 'vehiculo';
