export interface Pago {
    id: number;
    fecha: string;
    monto: number;
    comprobante_url: string | null;
    es_transferencia: boolean;
}

export interface Multa {
    id: number;
    vehiculo_id: number;
    patente: string;
    marca?: string | null;
    modelo?: string | null;
    conductor_id: number | null;
    conductor?: string | null;
    conductor_inactivo: boolean;
    fecha: string;
    fecha_vencimiento: string | null;
    monto: number;
    descripcion: string;
    punto_rojo: boolean;
    jurisdiccion: 'CABA' | 'GBA' | null;
    pdf_url: string | null;
    pagado: boolean;
    pagada_en: string | null;
    cobrado: boolean;
    cobrada_en: string | null;
    monto_cobrado: number;
    created_at: string;
    pagos: Pago[];
}

export interface MultaEliminada {
    id: number;
    patente: string;
    conductor: string | null;
    conductor_inactivo: boolean;
    monto: number;
    punto_rojo: boolean;
    fecha: string;
    descripcion: string;
    deleted_at: string;
}

export interface VehiculoOpt {
    id: number;
    patente: string;
    marca: string;
    modelo: string;
}

export interface Grupo {
    key: string;
    id: number | null;
    titulo: string;
    sub: string;
    multas: Multa[];
    pendientes: number;
    total: number;
}

export type Tab = 'vehiculo' | 'chofer' | 'ex-chofer' | 'ranking' | 'reporte';

export type FiltroEstado = '' | 'si' | 'no';
export type FiltroJurisdiccion = '' | 'CABA' | 'GBA';
export type FiltroPeriodo = '' | 'mes' | 'mes-ant' | '3m' | 'año';

export type Orden = 'pendientes' | 'monto' | 'cantidad' | 'alfabetico';
