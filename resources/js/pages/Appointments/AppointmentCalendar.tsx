import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppointmentCalendarProps {
    value?: string; // YYYY-MM-DD
    onChange?: (date: string) => void;
    rangeValue?: { from: string; to: string };
    onRangeChange?: (range: { from: string; to: string }) => void;
    mode?: 'single' | 'range';
    minDate?: string; // YYYY-MM-DD
    dailySlots?: Record<string, number>;
    maxSlots?: number;
    title?: React.ReactNode;
    className?: string;
    isFilterMode?: boolean;
    viewMode?: 'month' | 'week';
    /** Muestra la leyenda de cupos. Off para filtros ajenos a turnos (ej. Historial). */
    showLegend?: boolean;
    /**
     * Habilita los miércoles, que por defecto están bloqueados. Sólo lo activa
     * el alta de turnos de administrativo/administrador.
     */
    allowWednesday?: boolean;
}

/** Clases de un día según su estado. Todo sale de los tokens del tema. */
const DAY_STYLES = {
    base: 'bg-muted text-foreground hover:bg-accent hover:text-accent-foreground',
    conCupo: 'border border-success/25 bg-success-soft text-success-soft-foreground hover:bg-success/20',
    sinCupo: 'border border-destructive/25 bg-destructive-soft text-destructive-soft-foreground hover:bg-destructive/20',
    seleccionado: 'border-2 border-primary bg-primary/10 font-semibold text-foreground',
    enRango: 'border-y border-primary/25 bg-primary/15 text-foreground',
    deshabilitado: 'cursor-not-allowed bg-transparent text-muted-foreground/40',
    // Hoy se marca con un anillo, no con color de texto: el ámbar de --primary
    // sobre --muted no llega a 4.5:1 en tema claro.
    hoy: 'font-bold ring-1 ring-inset ring-primary/70',
} as const;

const fechaLarga = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

function hoyISO(): string {
    const d = new Date();

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
    ].join('-');
}

export function AppointmentCalendar({
    value,
    onChange,
    rangeValue,
    onRangeChange,
    mode = 'single',
    minDate,
    dailySlots,
    maxSlots,
    title = (
        <>
            <span className="text-foreground">Elegí un día disponible</span>{' '}
            <span className="text-destructive">*</span>
        </>
    ),
    className,
    isFilterMode = false,
    viewMode = 'month',
    showLegend = true,
    allowWednesday = false,
}: AppointmentCalendarProps) {
    // Current month/year being viewed
    const [viewDate, setViewDate] = useState(() => {
        const d = value ? new Date(value + 'T00:00:00') : new Date();

        if (viewMode === 'week') {
return d;
}

        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : null;

    if (minDateObj) {
minDateObj.setHours(0, 0, 0, 0);
}

    const today = hoyISO();

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const daysOfWeek = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

    const nextPeriod = () => {
        if (viewMode === 'week') {
            setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + 7));
        } else {
            setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
        }
    };

    const prevPeriod = () => {
        if (viewMode === 'week') {
            setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() - 7));
        } else {
            setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
        }
    };

    const calendarGrid = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const days = [];

        if (viewMode === 'week') {
            const d = new Date(year, month, viewDate.getDate());
            let dayOfWeek = d.getDay() - 1;

            if (dayOfWeek === -1) {
dayOfWeek = 6;
}

            d.setDate(d.getDate() - dayOfWeek); // go to Monday

            for (let i = 0; i < 7; i++) {
                const current = new Date(d);
                const dateStr = [
                    current.getFullYear(),
                    String(current.getMonth() + 1).padStart(2, '0'),
                    String(current.getDate()).padStart(2, '0')
                ].join('-');

                days.push({
                    date: current,
                    dateStr,
                    dayNumber: current.getDate()
                });
                d.setDate(d.getDate() + 1);
            }
        } else {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            let startDayIndex = firstDay.getDay() - 1;

            if (startDayIndex === -1) {
startDayIndex = 6;
}

            for (let i = 0; i < startDayIndex; i++) {
                days.push(null);
            }

            for (let d = 1; d <= lastDay.getDate(); d++) {
                const dateObj = new Date(year, month, d);
                const dateStr = [
                    year,
                    String(month + 1).padStart(2, '0'),
                    String(d).padStart(2, '0')
                ].join('-');

                days.push({
                    date: dateObj,
                    dateStr,
                    dayNumber: d
                });
            }
        }

        return days;
    }, [viewDate, viewMode]);

    const periodoLabel = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

    return (
        <div className="flex w-full flex-col gap-4">
            {title && (
                <label className="text-sm font-medium">
                    {title}
                </label>
            )}

            <div className={cn(
                'rounded-xl border border-border bg-card text-card-foreground shadow-sm',
                viewMode === 'week' ? 'p-3 sm:p-4' : 'p-4 sm:p-6',
                className
            )}>
                {/* Header */}
                <div className={cn('flex items-center justify-between', viewMode === 'week' ? 'mb-4' : 'mb-6')}>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={prevPeriod}
                        aria-label={viewMode === 'week' ? 'Semana anterior' : 'Mes anterior'}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span
                        aria-live="polite"
                        className="text-sm font-semibold tracking-wide text-foreground capitalize"
                    >
                        {periodoLabel}
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={nextPeriod}
                        aria-label={viewMode === 'week' ? 'Semana siguiente' : 'Mes siguiente'}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Days of week */}
                <div className={cn('grid grid-cols-7', viewMode === 'week' ? 'mb-1' : 'mb-2')}>
                    {daysOfWeek.map((day) => (
                        <div
                            key={day}
                            aria-hidden="true"
                            className="mb-2 text-center text-xs font-medium tracking-wider text-muted-foreground"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div
                    role="group"
                    aria-label={`Días de ${periodoLabel}`}
                    className={cn('grid grid-cols-7', viewMode === 'week' ? 'gap-1 sm:gap-2' : 'gap-2 sm:gap-3')}
                >
                    {calendarGrid.map((dayObj, i) => {
                        if (!dayObj) {
                            return <div key={`empty-${i}`} aria-hidden="true" className="aspect-square" />;
                        }

                        const { date, dateStr, dayNumber } = dayObj;

                        // State checks
                        const isPast = minDateObj ? date < minDateObj : false;
                        // Miércoles cerrado, salvo que quien agenda tenga permiso.
                        const isWednesday = date.getDay() === 3 && !allowWednesday;
                        const slotsUsed = dailySlots ? (dailySlots[dateStr] ?? 0) : 0;
                        const isFull = maxSlots !== undefined ? slotsUsed >= maxSlots : false;
                        const isToday = dateStr === today;

                        let isSelected = false;
                        let isInRange = false;

                        if (mode === 'range' && rangeValue) {
                            if (rangeValue.from && rangeValue.to) {
                                isSelected = dateStr === rangeValue.from || dateStr === rangeValue.to;
                                isInRange = dateStr > rangeValue.from && dateStr < rangeValue.to;
                            } else if (rangeValue.from) {
                                isSelected = dateStr === rangeValue.from;
                            }
                        } else {
                            isSelected = value === dateStr;
                        }

                        const isDisabled = isFilterMode ? false : (isPast || isWednesday || (isFull && !isSelected));

                        // Estilo de fondo cuando el día no está seleccionado ni dentro del rango.
                        let defaultStyle: string = DAY_STYLES.base;

                        if (isFilterMode && dailySlots && maxSlots !== undefined) {
                            defaultStyle = isFull ? DAY_STYLES.sinCupo : DAY_STYLES.conCupo;
                        }

                        // Nombre accesible: "15" solo no dice nada fuera de la grilla.
                        const estado = isSelected
                            ? ', seleccionado'
                            : isDisabled
                                ? isFull
                                    ? ', sin cupo'
                                    : ', no disponible'
                                : isFilterMode && isFull
                                    ? ', sin cupo'
                                    : '';

                        return (
                            <button
                                key={dateStr}
                                type="button"
                                disabled={isDisabled}
                                aria-label={`${fechaLarga.format(date)}${estado}`}
                                aria-pressed={isSelected}
                                aria-current={isToday ? 'date' : undefined}
                                onClick={() => {
                                    if (mode === 'range' && onRangeChange) {
                                        if (!rangeValue?.from || (rangeValue.from && rangeValue.to && rangeValue.from !== rangeValue.to)) {
                                            // Start new range
                                            onRangeChange({ from: dateStr, to: dateStr });
                                        } else if (rangeValue.from === rangeValue.to) {
                                            // Complete range
                                            if (dateStr < rangeValue.from) {
                                                onRangeChange({ from: dateStr, to: rangeValue.to });
                                            } else {
                                                onRangeChange({ from: rangeValue.from, to: dateStr });
                                            }
                                        }
                                    } else if (onChange) {
                                        onChange(dateStr);
                                    }
                                }}
                                className={cn(
                                    'flex aspect-square items-center justify-center text-sm font-semibold transition-colors',
                                    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                                    mode === 'range' && isInRange ? DAY_STYLES.enRango : 'rounded-xl',
                                    isSelected
                                        ? cn(DAY_STYLES.seleccionado, 'z-10 rounded-xl')
                                        : isDisabled
                                            ? DAY_STYLES.deshabilitado
                                            : isInRange
                                                ? ''
                                                : cn(defaultStyle, 'motion-safe:hover:scale-105'),
                                    isToday && !isSelected && !isDisabled && DAY_STYLES.hoy,
                                )}
                            >
                                {dayNumber}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                {showLegend && viewMode !== 'week' && (
                    <div className="mt-8 flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
                        {!isFilterMode ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-muted" />
                                    <span>Disponible</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span aria-hidden="true" className="h-3 w-3 rounded-sm border-2 border-primary bg-primary/10" />
                                    <span>Seleccionado</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-border bg-transparent" />
                                    <span>Sin cupo / no disponible</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-success/25 bg-success-soft" />
                                    <span>Con cupo disponible</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-destructive/25 bg-destructive-soft" />
                                    <span>Sin cupo (Lleno)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span aria-hidden="true" className="h-3 w-3 rounded-sm border-2 border-primary bg-primary/10" />
                                    <span>Seleccionado</span>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
