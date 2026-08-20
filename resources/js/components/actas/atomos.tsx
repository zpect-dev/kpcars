import type { TriangleAlert } from 'lucide-react';
import { formatFecha } from '@/components/actas/tipos';
import type { Acta } from '@/components/actas/tipos';
import { cn } from '@/lib/utils';

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
            <mark className="rounded bg-warning-soft px-0.5 text-warning-soft-foreground">
                {text.slice(idx, idx + q.length)}
            </mark>
            {text.slice(idx + q.length)}
        </>
    );
}


export function Chip({
    label,
    valor,
    tone,
}: {
    label: string;
    valor: string;
    tone: 'amber' | 'emerald' | 'plain';
}) {
    const color = {
        amber: 'text-warning-soft-foreground',
        emerald: 'text-success',
        plain: 'text-foreground',
    }[tone];

    return (
        <span className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn('font-medium tabular-nums', color)}>
                {valor}
            </span>
        </span>
    );
}

export function StatCard({
    label,
    value,
    sub,
    tone,
    icon: Icon,
}: {
    label: string;
    value: string;
    sub: string;
    tone: 'amber' | 'emerald';
    icon: typeof TriangleAlert;
}) {
    const tones = {
        amber: 'bg-warning-soft text-warning-soft-foreground',
        emerald: 'bg-success-soft text-success-soft-foreground',
    }[tone];

    return (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <span
                className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    tones,
                )}
            >
                <Icon className="h-5 w-5" />
            </span>
            <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {label}
                </span>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                    {value}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {sub}
                </span>
            </div>
        </div>
    );
}

export function EstadoBadge({ acta }: { acta: Acta }) {
    if (acta.estado === 'resuelta') {
        return (
            <span
                className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-success-soft-foreground"
                title={
                    acta.resuelta_en
                        ? `Dejó de aparecer el ${formatFecha(acta.resuelta_en)}`
                        : undefined
                }
            >
                <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
                Pagada
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-warning-soft-foreground">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
            Vigente
        </span>
    );
}

export function FilterButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex h-full items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                active
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            {children}
        </button>
    );
}
