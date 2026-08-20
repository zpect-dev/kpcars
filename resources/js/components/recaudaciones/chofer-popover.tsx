import { IdCard, Mail, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { getInitials } from '@/components/recaudaciones/format';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { RecaudacionFila } from '@/types';

/** Un dato de contacto, o el hueco de que no está cargado. */
function DatoContacto({
    icon: Icon,
    valor,
    href,
    vacio,
    mono = false,
}: {
    icon: LucideIcon;
    valor: string | null | undefined;
    href?: string;
    vacio: string;
    mono?: boolean;
}) {
    if (!valor) {
        return (
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground/50">
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="italic">{vacio}</span>
            </div>
        );
    }

    const contenido = (
        <>
            <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
            />
            <span className={mono ? 'text-foreground tabular-nums' : 'truncate text-foreground'}>
                {valor}
            </span>
        </>
    );

    if (!href) {
        return (
            <div className="flex items-center gap-3 px-3 py-2 text-sm">
                {contenido}
            </div>
        );
    }

    return (
        <a
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
            {contenido}
        </a>
    );
}

/**
 * Ficha de contacto del chofer. Estaba escrita dos veces, idéntica: una en la
 * fila de escritorio y otra en la tarjeta de teléfono.
 */
export function ChoferPopover({
    fila,
    children,
}: {
    fila: RecaudacionFila;
    children: ReactNode;
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                    <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground"
                    >
                        {getInitials(fila.chofer)}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                            {fila.chofer}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                            {fila.patente}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-0 p-1">
                    <DatoContacto
                        icon={IdCard}
                        valor={fila.chofer_dni}
                        vacio="Sin DNI"
                        mono
                    />
                    <DatoContacto
                        icon={Phone}
                        valor={fila.chofer_telefono}
                        href={
                            fila.chofer_telefono
                                ? `tel:${fila.chofer_telefono}`
                                : undefined
                        }
                        vacio="Sin teléfono"
                    />
                    <DatoContacto
                        icon={Mail}
                        valor={fila.chofer_correo}
                        href={
                            fila.chofer_correo
                                ? `mailto:${fila.chofer_correo}`
                                : undefined
                        }
                        vacio="Sin correo"
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}

/** Botón que abre la ficha: avatar con iniciales + nombre y patente. */
export function ChoferTrigger({
    fila,
    size = 'sm',
}: {
    fila: RecaudacionFila;
    size?: 'sm' | 'md';
}) {
    return (
        <button
            type="button"
            aria-label={`Ver los datos de contacto de ${fila.chofer}`}
            className="flex items-center gap-2 rounded-md text-left transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
            <span
                aria-hidden="true"
                className={
                    size === 'md'
                        ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground'
                        : 'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground'
                }
            >
                {getInitials(fila.chofer)}
            </span>
            <span className="min-w-0">
                <span
                    className={
                        size === 'md'
                            ? 'block truncate text-sm font-semibold text-foreground'
                            : 'block truncate text-sm font-medium text-foreground'
                    }
                >
                    {fila.chofer}
                </span>
                <span className="block font-mono text-xs text-muted-foreground">
                    {fila.patente}
                </span>
            </span>
        </button>
    );
}
