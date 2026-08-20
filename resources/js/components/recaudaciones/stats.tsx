import { AlertCircle, ArrowLeftRight, Banknote, TrendingUp, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { formatARS } from '@/components/recaudaciones/format';
import { METODOS } from '@/components/recaudaciones/metodo';
import type { MetodoFiltro, MetodoPago } from '@/components/recaudaciones/metodo';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type GroupTone = 'neutral' | 'success' | 'destructive';

const GROUP_TONE: Record<GroupTone, { wrap: string; divide: string; hover: string }> = {
    neutral: {
        wrap: 'border-border bg-card',
        divide: 'divide-border',
        hover: 'hover:bg-muted/50',
    },
    success: {
        wrap: 'border-success/20 bg-success-soft/40',
        divide: 'divide-success/20',
        hover: 'hover:bg-success/10',
    },
    destructive: {
        wrap: 'border-destructive/20 bg-destructive-soft/40',
        divide: 'divide-destructive/20',
        hover: 'hover:bg-destructive/10',
    },
};

/**
 * Grupo de indicadores. En teléfono los ítems se apilan como lista; en
 * escritorio se acuestan en fila. Es un solo markup: antes había dos bloques
 * completos, uno con `sm:hidden` y otro con `hidden sm:flex`.
 */
function StatGroup({
    tone = 'neutral',
    grow = false,
    children,
}: {
    tone?: GroupTone;
    grow?: boolean;
    children: ReactNode;
}) {
    const styles = GROUP_TONE[tone];

    return (
        <div
            className={cn(
                'flex flex-col overflow-hidden rounded-xl border shadow-sm divide-y sm:flex-row sm:divide-x sm:divide-y-0',
                styles.wrap,
                styles.divide,
                grow && 'sm:flex-1',
            )}
        >
            {children}
        </div>
    );
}

function StatBody({
    icon: Icon,
    iconClass,
    label,
    labelClass,
    value,
    suffix,
}: {
    icon: LucideIcon;
    iconClass?: string;
    label: string;
    labelClass?: string;
    value: ReactNode;
    suffix?: ReactNode;
}) {
    return (
        <>
            <div className="flex items-center gap-2 sm:gap-1.5">
                <Icon
                    aria-hidden="true"
                    className={cn('size-4 shrink-0', iconClass)}
                />
                <span className={cn('text-sm sm:text-xs', labelClass)}>
                    {label}
                </span>
            </div>
            <span className="font-bold text-foreground tabular-nums">
                {value}
                {suffix}
            </span>
        </>
    );
}

const ITEM_LAYOUT =
    'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left sm:flex-1 sm:flex-col sm:items-start sm:justify-start sm:gap-1 sm:py-3';

function StatItem(props: React.ComponentProps<typeof StatBody>) {
    return (
        <div className={ITEM_LAYOUT}>
            <StatBody {...props} />
        </div>
    );
}

/**
 * Desglose por método de pago de un estado (pagado / deuda). Cada fila filtra
 * la lista por ese estado más ese método.
 *
 * Abre al pasar el mouse y al activar el botón con Enter o Espacio. El
 * disparador es un `<button>` y no un `<div>`: antes el desglose no existía
 * para el teclado.
 *
 * Ojo con el foco. El clic lo maneja el propio disparador de Radix, así que no
 * hay que agregarle un `onClick` encima —lo alternaría dos veces— y tampoco
 * `onFocus`/`onBlur`: al abrirse, Radix mueve el foco al panel, eso dispara el
 * blur del botón, el panel se cierra, Radix devuelve el foco al botón, eso
 * dispara el focus, y vuelve a abrir. Ese era el parpadeo infinito.
 */
function StatItemConDesglose({
    estado,
    counts,
    estadoFiltro,
    metodoFiltro,
    onSelect,
    tone,
    ...body
}: React.ComponentProps<typeof StatBody> & {
    estado: 'pagado' | 'deuda';
    counts: Record<MetodoPago, number>;
    estadoFiltro: 'all' | 'pagado' | 'deuda';
    metodoFiltro: MetodoFiltro;
    onSelect: (estado: 'pagado' | 'deuda', metodo: MetodoPago) => void;
    tone: GroupTone;
}) {
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelClose = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    // El temporizador tiene que morir con el componente: si no, dispara un
    // setState sobre algo ya desmontado al cambiar de empresa o de período.
    useEffect(() => cancelClose, []);

    const openNow = () => {
        cancelClose();
        setOpen(true);
    };

    const scheduleClose = () => {
        cancelClose();
        closeTimer.current = setTimeout(() => setOpen(false), 120);
    };

    const total = counts.efectivo + counts.transferencia + counts.mixto;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onMouseEnter={openNow}
                    onMouseLeave={scheduleClose}
                    onPointerDown={cancelClose}
                    aria-label={`${body.label}: ver el desglose por método de pago`}
                    className={cn(
                        ITEM_LAYOUT,
                        'cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        GROUP_TONE[tone].hover,
                    )}
                >
                    <StatBody {...body} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="center"
                sideOffset={6}
                className="w-56 p-1"
                // Al abrirse por hover el foco tiene que quedarse donde está;
                // moverlo al panel es lo que realimentaba el ciclo de apertura.
                // Con el teclado igual se llega al panel tabulando.
                onOpenAutoFocus={(event) => event.preventDefault()}
                // Y al cerrarse tampoco hay que devolverlo. Si no: al pasar de
                // un indicador al otro, el cierre demorado del primero le
                // devuelve el foco a su botón, el panel del segundo lo lee como
                // un focusOutside y se cierra también. Desaparecían los dos.
                onCloseAutoFocus={(event) => event.preventDefault()}
                onMouseEnter={openNow}
                onMouseLeave={scheduleClose}
            >
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {estado === 'pagado'
                        ? 'Pagados por método'
                        : 'Pago parcial por método'}
                </p>
                {total === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground italic">
                        Sin pagos registrados.
                    </p>
                ) : (
                    <>
                        {METODOS.map((m) => {
                            const count = counts[m.key];
                            const active =
                                estadoFiltro === estado &&
                                metodoFiltro === m.key;

                            return (
                                <button
                                    key={m.key}
                                    type="button"
                                    disabled={count === 0}
                                    aria-pressed={active}
                                    onClick={() => onSelect(estado, m.key)}
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        active ? 'bg-primary/10' : 'hover:bg-muted',
                                        count === 0 &&
                                            'cursor-default opacity-40 hover:bg-transparent',
                                    )}
                                >
                                    <m.icon
                                        aria-hidden="true"
                                        className={cn('size-4 shrink-0', m.color)}
                                    />
                                    <span
                                        className={cn(
                                            'flex-1 text-left',
                                            active
                                                ? 'font-medium text-primary'
                                                : 'text-foreground',
                                        )}
                                    >
                                        {m.label}
                                    </span>
                                    <span className="font-semibold text-foreground tabular-nums">
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                        <p className="px-2 pt-1 text-xs text-muted-foreground">
                            Click para filtrar
                        </p>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}

export type RecaudacionStatsData = {
    total: number;
    efectivo: number;
    transferencia: number;
    pagados: number;
    deudores: number;
    totalDeuda: number;
};

export function RecaudacionStats({
    stats,
    totalFilas,
    metodoBreakdown,
    estadoFiltro,
    metodoFiltro,
    onSelectMetodo,
}: {
    stats: RecaudacionStatsData;
    totalFilas: number;
    metodoBreakdown: { pagado: Record<MetodoPago, number>; deuda: Record<MetodoPago, number> };
    estadoFiltro: 'all' | 'pagado' | 'deuda';
    metodoFiltro: MetodoFiltro;
    onSelectMetodo: (estado: 'pagado' | 'deuda', metodo: MetodoPago) => void;
}) {
    const deTotal = (
        <span className="ml-1 text-xs font-normal text-muted-foreground">
            / {totalFilas}
        </span>
    );

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
            {/* Montos cobrados */}
            <StatGroup grow>
                <StatItem
                    icon={TrendingUp}
                    iconClass="text-primary"
                    label="Total"
                    labelClass="text-muted-foreground"
                    value={formatARS(stats.total)}
                />
                <StatItem
                    icon={Banknote}
                    iconClass="text-success"
                    label="Efectivo"
                    labelClass="text-success-soft-foreground"
                    value={formatARS(stats.efectivo)}
                />
                <StatItem
                    icon={ArrowLeftRight}
                    iconClass="text-info"
                    label="Transferencia"
                    labelClass="text-info-soft-foreground"
                    value={formatARS(stats.transferencia)}
                />
            </StatGroup>

            {/* Conteo pagados / deben */}
            <StatGroup tone="success">
                <StatItemConDesglose
                    estado="pagado"
                    tone="success"
                    counts={metodoBreakdown.pagado}
                    estadoFiltro={estadoFiltro}
                    metodoFiltro={metodoFiltro}
                    onSelect={onSelectMetodo}
                    icon={Users}
                    iconClass="text-success"
                    label="Pagados"
                    labelClass="text-success-soft-foreground"
                    value={stats.pagados}
                    suffix={deTotal}
                />
                <StatItemConDesglose
                    estado="deuda"
                    tone="success"
                    counts={metodoBreakdown.deuda}
                    estadoFiltro={estadoFiltro}
                    metodoFiltro={metodoFiltro}
                    onSelect={onSelectMetodo}
                    icon={AlertCircle}
                    iconClass="text-destructive"
                    label="Deben"
                    labelClass="text-destructive-soft-foreground"
                    value={stats.deudores}
                    suffix={deTotal}
                />
            </StatGroup>

            {/* Monto de la deuda */}
            <StatGroup tone="destructive">
                <StatItem
                    icon={AlertCircle}
                    iconClass="text-destructive"
                    label="Monto deuda"
                    labelClass="text-destructive-soft-foreground"
                    value={
                        stats.deudores > 0 ? formatARS(stats.totalDeuda) : '—'
                    }
                />
            </StatGroup>
        </div>
    );
}
