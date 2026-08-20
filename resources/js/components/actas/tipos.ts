export interface Acta {
    id: number;
    patente: string;
    jurisdiccion: string;
    acta: string | null;
    motivo: string | null;
    monto: number | null;
    fecha_infraccion: string | null;
    fecha_vencimiento: string | null;
    estado: 'vigente' | 'resuelta';
    resuelta_en: string | null;
    vista_primera_en: string | null;
    vehiculo: string | null;
    conductor_id: number | null;
    conductor: string | null;
    posible_duplicado: boolean;
    pago_voluntario: boolean;
    punto_rojo: boolean;
    sin_importe: boolean;
    monto_efectivo: number;
    cobrado: boolean;
    cobrada_en: string | null;
    monto_cobrado: number;
    adeudado: number;
    pagos: Pago[];
}

export interface Pago {
    id: number;
    fecha: string | null;
    monto: number;
    comprobante_url: string | null;
    es_transferencia: boolean;
}

/** Estado del cobro al chofer: sin cobrar / parcial / cobrada. */
export function estadoCobro(a: Acta): 'sin' | 'parcial' | 'cobrada' {
    if (a.cobrado) {
return 'cobrada';
}

    if (a.monto_cobrado > 0) {
return 'parcial';
}

    return 'sin';
}

export interface UltimaSync {
    ok: boolean;
    origen: string;
    error: string | null;
    cuando: string | null;
}

export interface Stats {
    vigentes: number;
    resueltas: number;
    monto_vigente: number;
    bsas: number;
    caba: number;
}

/** Fila de la lista de reportes: una corrida de sincronización y lo que movió. */
export interface Reporte {
    id: number;
    cuando: string | null;
    origen: string;
    ok: boolean;
    error: string | null;
    snapshot: string | null;
    nuevas: number;
    monto_nuevas: number;
    resueltas: number;
    monto_resueltas: number;
    reabiertas: number;
    deuda_vigente: number;
    pagos: number;
    cobrado: number;
    sin_movimiento: boolean;
}

export interface ActaFila {
    id: number;
    patente: string;
    conductor: string | null;
    jurisdiccion: string;
    acta: string | null;
    motivo: string | null;
    monto: number | null;
    fecha_infraccion: string | null;
    fecha_vencimiento: string | null;
    adeudado: number;
}

export interface CobroFila {
    id: number;
    fecha: string | null;
    registrado_en: string | null;
    monto: number;
    es_transferencia: boolean;
    patente: string | null;
    conductor: string | null;
}

export interface DesgloseFila {
    label: string;
    nuevas: number;
    monto_nuevas: number;
    pagos: number;
    cobrado: number;
    adeuda: number;
}

export interface ReporteDetalle {
    run: {
        id: number;
        cuando: string | null;
        origen: string;
        ok: boolean;
        error: string | null;
        snapshot: string | null;
    };
    periodo: { desde: string | null; hasta: string | null };
    totales: {
        nuevas: number;
        monto_nuevas: number;
        resueltas: number;
        monto_resueltas: number;
        reabiertas: number;
        deuda_vigente: number;
        pagos: number;
        cobrado: number;
    };
    nuevas: ActaFila[];
    resueltas: ActaFila[];
    cobros: CobroFila[];
    por_chofer: DesgloseFila[];
    por_vehiculo: DesgloseFila[];
}

export interface Props {
    actas: Acta[];
    stats: Stats;
    ultimoSnapshot: string | null;
    diasResueltas: number;
    ultimaSync: UltimaSync | null;
    reportes: Reporte[];
    reporteDetalle: ReporteDetalle | null;
}

export type EstadoFiltro = 'todas' | 'vigente' | 'resuelta';
export type JurisFiltro = 'todas' | 'BSAS' | 'CABA';
export type ChoferFiltro = 'todos' | 'con' | 'sin';
export type Orden = 'vigentes' | 'monto' | 'cantidad' | 'alfabetico';

export interface Grupo {
    key: string;
    patente: string;
    sub: string;
    conductor: string | null;
    actas: Acta[];
    vigentes: number;
    total: number;
}

export const ORDEN_LABEL: Record<Orden, string> = {
    vigentes: 'Vigentes',
    monto: 'Monto',
    cantidad: 'Cantidad',
    alfabetico: 'A-Z',
};

/** Fecha ISO (Y-m-d) a dd/mm/aaaa, sin corrimiento de zona horaria. */
export function formatFecha(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);

    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function formatFechaHora(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    const d = new Date(iso);

    if (Number.isNaN(d.getTime())) {
        return iso;
    }

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');

    return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}
