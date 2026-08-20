import { saldoTotalARS } from '@/components/deposito-cuenta-dialog';
import type {
    FilterAlertValue,
    SortField,
    User,
} from '@/components/users/tipos';

/** Saldo total de la cuenta de depósito expresado en ARS (USD × cotización). */
export function depositoTotalARS(u: User, cotizacion: number): number {
    return saldoTotalARS(u.deposito, cotizacion);
}

/**
 * El chofer no tiene depósito respaldando: nunca cargó o el saldo quedó
 * consumido por retiros y descuentos de multas.
 */
export function sinDeposito(u: User): boolean {
    return (u.deposito?.saldos ?? []).every((s) => s.saldo <= 0);
}

/** Al chofer le falta el DNI (frente o dorso sin cargar). */
export function faltaDocDni(u: User): boolean {
    return !u.documentos?.dni?.frente || !u.documentos?.dni?.dorso;
}

/** Al chofer le falta la licencia (sin foto de frente ni PDF). */
export function faltaDocLicencia(u: User): boolean {
    return !u.documentos?.licencia?.frente && !u.documentos?.licencia?.pdf;
}

/** El chofer no tiene domicilio cargado (nulo o sólo espacios). */
export function sinDireccion(u: User): boolean {
    return !u.direccion?.trim();
}

/** Al chofer le falta algún documento: DNI, licencia o foto de perfil. */
export function faltaAlgunDocChofer(u: User): boolean {
    return faltaDocDni(u) || faltaDocLicencia(u) || u.falta_foto === true;
}

export const FILTER_SHORT_LABELS: Record<FilterAlertValue, string> = {
    all: 'Todos',
    licencia_vencida: 'Lic. vencida',
    licencia_por_vencer: 'Lic. por vencer',
    sin_licencia: 'Sin licencia',
    falta_foto: 'Sin foto',
    falta_telefono: 'Sin teléfono',
    falta_correo: 'Sin correo',
    falta_direccion: 'Sin dirección',
    con_direccion: 'Con dirección',
    falta_deposito: 'Sin depósito',
    deposito_bajo: 'Depósito bajo',
    falta_docs: 'Faltan documentos',
    falta_doc_dni: 'Sin foto DNI',
    falta_doc_licencia: 'Sin foto licencia',
};

export const FILTER_SECTIONS: {
    label: string;
    items: { val: FilterAlertValue; label: string; desc: string }[];
}[] = [
    {
        label: 'Licencia',
        items: [
            {
                val: 'licencia_vencida',
                label: 'Vencida',
                desc: 'La licencia ya está vencida',
            },
            {
                val: 'licencia_por_vencer',
                label: 'Próxima a vencer',
                desc: 'Vence en los próximos 30 días',
            },
            {
                val: 'sin_licencia',
                label: 'Sin fecha cargada',
                desc: 'No tiene vencimiento registrado',
            },
        ],
    },
    {
        label: 'Documentos',
        items: [
            {
                val: 'falta_docs',
                label: 'Faltan documentos',
                desc: 'Le falta el DNI, la licencia o la foto de perfil',
            },
            {
                val: 'falta_doc_dni',
                label: 'Sin foto de DNI',
                desc: 'Le falta frente o dorso del DNI',
            },
            {
                val: 'falta_doc_licencia',
                label: 'Sin foto de licencia',
                desc: 'No tiene foto ni PDF de licencia cargado',
            },
        ],
    },
    {
        label: 'Contacto',
        items: [
            {
                val: 'falta_foto',
                label: 'Sin foto de perfil',
                desc: 'Sin imagen de identificación',
            },
            {
                val: 'falta_telefono',
                label: 'Sin teléfono',
                desc: 'Sin número de contacto',
            },
            {
                val: 'falta_correo',
                label: 'Sin correo',
                desc: 'Sin dirección de email',
            },
        ],
    },
    {
        label: 'Domicilio',
        items: [
            {
                val: 'falta_direccion',
                label: 'Sin dirección',
                desc: 'No tiene domicilio cargado',
            },
            {
                val: 'con_direccion',
                label: 'Con dirección',
                desc: 'Tiene el domicilio cargado',
            },
        ],
    },
    {
        label: 'Garantía',
        items: [
            {
                val: 'falta_deposito',
                label: 'Sin depósito',
                desc: 'Sin garantía registrada',
            },
            {
                val: 'deposito_bajo',
                label: 'Depósito bajo',
                desc: 'Total (ARS + USD convertido) menor a 1.5× el valor del auto',
            },
        ],
    },
];

/** Fecha del último cambio de estado: baja si está inactivo, alta si no. */
export function estadoFecha(user: User): string | null {
    if (user.inactivo) {
        return user.baja_fecha ?? user.estado_actualizado_en ?? null;
    }

    return user.alta_fecha ?? user.created_at ?? null;
}

export function formatEstadoFecha(fechaStr?: string | null): string | null {
    if (!fechaStr) {
        return null;
    }

    const fecha = new Date(fechaStr);

    if (isNaN(fecha.getTime())) {
        return null;
    }

    return fecha.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/** La licencia viene como fecha suelta: se arma en hora local, sin UTC. */
export function parseLicenciaDate(fechaStr: string): Date {
    const datePart = fechaStr.split('T')[0].split(' ')[0];
    const [year, month, day] = datePart.split('-').map(Number);

    return new Date(year, month - 1, day);
}

export function formatLicenciaFecha(fechaStr: string): string {
    return parseLicenciaDate(fechaStr).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Valor comparable de un usuario para una columna. Vive fuera del componente y
 * recibe la cotización por parámetro: si se declara en el cuerpo se recrea en
 * cada render, la memoización que la usa pasa a mentir sobre sus dependencias
 * y el compilador de React descarta el componente entero.
 */
export function getSortValue(
    user: User,
    field: SortField,
    cotizacionDolar: number,
): string | number | null {
    switch (field) {
        case 'nombre':
            return user.name?.toLowerCase() ?? '';
        case 'dni':
            return user.dni ?? '';
        case 'licencia':
            return user.fecha_vencimiento_licencia
                ? parseLicenciaDate(user.fecha_vencimiento_licencia).getTime()
                : null;
        case 'estado':
            return user.inactivo ? 1 : 0;
        case 'fecha_estado': {
            const fecha = estadoFecha(user);

            if (!fecha) {
                return null;
            }

            const parsed = new Date(fecha);

            return isNaN(parsed.getTime()) ? null : parsed.getTime();
        }
        case 'deposito':
            return depositoTotalARS(user, cotizacionDolar);
        case 'vehiculo':
            return user.vehiculo?.patente?.toLowerCase() ?? null;
        default:
            return null;
    }
}

/**
 * ¿El chofer entra en la alerta elegida? Vive fuera del componente para que la
 * memoización que la usa no dependa de una función recreada en cada render.
 */
export function coincideAlerta(
    u: User,
    filterAlert: FilterAlertValue,
    cotizacionDolar: number,
): boolean {
    switch (filterAlert) {
        case 'licencia_vencida': {
            if (!u.fecha_vencimiento_licencia) {
                return false;
            }

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            return parseLicenciaDate(u.fecha_vencimiento_licencia) < hoy;
        }
        case 'licencia_por_vencer':
            return u.licencia_por_vencer === true;
        case 'sin_licencia':
            return u.sin_licencia === true;
        case 'falta_foto':
            return u.falta_foto === true;
        case 'falta_docs':
            return faltaAlgunDocChofer(u);
        case 'falta_doc_dni':
            return faltaDocDni(u);
        case 'falta_doc_licencia':
            return faltaDocLicencia(u);
        case 'falta_telefono':
            return !u.telefono;
        case 'falta_correo':
            return !u.correo;
        case 'falta_direccion':
            return sinDireccion(u);
        case 'con_direccion':
            return !sinDireccion(u);
        case 'falta_deposito':
            return sinDeposito(u);
        case 'deposito_bajo':
            if (!u.vehiculo?.precio) {
                return false;
            }

            return (
                depositoTotalARS(u, cotizacionDolar) < 1.5 * u.vehiculo.precio
            );
        default:
            return true;
    }
}

/** ¿El texto libre coincide con nombre, DNI o patente? */
export function coincideBusqueda(u: User, termino: string): boolean {
    const q = termino.toLowerCase();

    return (
        u.name.toLowerCase().includes(q) ||
        u.dni.toLowerCase().includes(q) ||
        (u.vehiculo?.patente?.toLowerCase().includes(q) ?? false)
    );
}
