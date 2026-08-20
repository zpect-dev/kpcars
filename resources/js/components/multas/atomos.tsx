import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/app/status-badge';
import { cn } from '@/lib/utils';

/** Resalta las coincidencias de `query` dentro de `text` (búsqueda en vivo). */
export function Highlight({ text, query }: { text: string; query: string }) {
    const q = query.trim();

    if (!q) {
        return <>{text}</>;
    }

    const idx = text.toLowerCase().indexOf(q.toLowerCase());

    if (idx === -1) {
        return <>{text}</>;
    }

    return (
        <>
            {text.slice(0, idx)}
            <mark className="rounded-[3px] bg-warning-soft px-0.5 text-warning-soft-foreground">
                {text.slice(idx, idx + q.length)}
            </mark>
            {text.slice(idx + q.length)}
        </>
    );
}

export function InactivoBadge() {
    return (
        <StatusBadge
            tone="neutral"
            size="sm"
            className="tracking-wide uppercase"
        >
            Inactivo
        </StatusBadge>
    );
}

/** Patente en monoespaciada, como se la lee en la calle. */
export function PatenteChip({ patente }: { patente: string }) {
    return (
        <span className="shrink-0 rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground uppercase">
            {patente}
        </span>
    );
}

/** Celda compacta patente + chofer, reutilizada en las tablas del reporte. */
export function PatenteChofer({
    patente,
    conductor,
    inactivo,
}: {
    patente: string;
    conductor: string | null;
    inactivo?: boolean;
}) {
    return (
        <div className="flex min-w-0 items-center gap-2">
            <PatenteChip patente={patente} />
            <span className="truncate text-xs text-muted-foreground">
                {conductor ?? (
                    <span className="italic opacity-60">Sin chofer</span>
                )}
            </span>
            {inactivo && <InactivoBadge />}
        </div>
    );
}

/** Chip de filtro con estado activo. */
export function Chip({
    activo,
    onClick,
    children,
}: {
    activo: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={activo}
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]',
                activo
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            {children}
        </button>
    );
}
