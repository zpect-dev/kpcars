import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
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
    title = <><span className="text-foreground">Elegí un día disponible</span> <span className="text-amber-500">*</span></>,
    className,
    isFilterMode = false,
    viewMode = 'month',
}: AppointmentCalendarProps) {
    // Current month/year being viewed
    const [viewDate, setViewDate] = useState(() => {
        const d = value ? new Date(value + 'T00:00:00') : new Date();
        if (viewMode === 'week') return d;
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : null;
    if (minDateObj) minDateObj.setHours(0, 0, 0, 0);

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
            if (dayOfWeek === -1) dayOfWeek = 6;
            
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
            if (startDayIndex === -1) startDayIndex = 6;

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

    return (
        <div className="w-full flex flex-col gap-4">
            {title && (
                <label className="text-sm font-medium">
                    {title}
                </label>
            )}

            <div className={cn(
                "rounded-xl border border-border bg-[#18181b] text-white shadow-sm", 
                viewMode === 'week' ? "p-3 sm:p-4" : "p-4 sm:p-6",
                className
            )}>
                {/* Header */}
                <div className={cn("flex items-center justify-between", viewMode === 'week' ? "mb-4" : "mb-6")}>
                    <button
                        type="button"
                        onClick={prevPeriod}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-[#27272a] text-muted-foreground hover:bg-[#3f3f46] hover:text-white transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-base font-bold capitalize tracking-wide">
                        {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                    </span>
                    <button
                        type="button"
                        onClick={nextPeriod}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-[#27272a] text-muted-foreground hover:bg-[#3f3f46] hover:text-white transition-colors"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Days of week */}
                <div className={cn("grid grid-cols-7", viewMode === 'week' ? "mb-1" : "mb-2")}>
                    {daysOfWeek.map((day) => (
                        <div key={day} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground tracking-wider mb-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className={cn("grid grid-cols-7", viewMode === 'week' ? "gap-1 sm:gap-2" : "gap-2 sm:gap-3")}>
                    {calendarGrid.map((dayObj, i) => {
                        if (!dayObj) {
                            return <div key={`empty-${i}`} className="aspect-square" />;
                        }

                        const { date, dateStr, dayNumber } = dayObj;
                        
                        // State checks
                        const isPast = minDateObj ? date < minDateObj : false;
                        const isWednesday = date.getDay() === 3;
                        const slotsUsed = dailySlots ? (dailySlots[dateStr] ?? 0) : 0;
                        const isFull = maxSlots !== undefined ? slotsUsed >= maxSlots : false;

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

                        let defaultStyle = 'bg-[#27272a] text-white hover:bg-[#3f3f46] hover:scale-105';
                        if (isFilterMode && dailySlots && maxSlots !== undefined) {
                            if (isFull) {
                                defaultStyle = 'bg-red-950/40 text-red-200 border border-red-900/30 hover:bg-red-900/50 hover:scale-105';
                            } else {
                                defaultStyle = 'bg-emerald-950/40 text-emerald-200 border border-emerald-900/30 hover:bg-emerald-900/50 hover:scale-105';
                            }
                        }

                        return (
                            <button
                                key={dateStr}
                                type="button"
                                disabled={isDisabled}
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
                                    'aspect-square flex items-center justify-center text-sm font-semibold transition-all',
                                    mode === 'range' ? (isInRange ? 'bg-amber-500/20 border-y border-amber-500/30 text-amber-200' : 'rounded-xl') : 'rounded-xl',
                                    isSelected
                                        ? 'bg-[#27272a] border-2 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.15)] z-10 rounded-xl'
                                        : isDisabled
                                        ? 'bg-transparent text-[#3f3f46] cursor-not-allowed'
                                        : !isInRange ? defaultStyle : ''
                                )}
                            >
                                {dayNumber}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                {viewMode !== 'week' && (
                    <div className={cn("flex flex-wrap items-center gap-3 text-[10px] sm:text-xs font-medium text-muted-foreground", viewMode === 'week' ? "mt-4" : "mt-8")}>
                        {!isFilterMode ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-sm bg-[#27272a]"></div>
                                    <span>Disponible</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-sm border-2 border-amber-500 bg-[#27272a]"></div>
                                    <span>Seleccionado</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-sm bg-transparent border border-[#3f3f46]"></div>
                                    <span>Sin cupo / no disponible</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-sm bg-emerald-950/40 border border-emerald-900/30"></div>
                                    <span>Con cupo disponible</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-sm bg-red-950/40 border border-red-900/30"></div>
                                    <span>Sin cupo (Lleno)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-sm border-2 border-amber-500 bg-[#27272a]"></div>
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
