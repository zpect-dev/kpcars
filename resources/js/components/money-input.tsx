import * as React from 'react';
import { Input } from '@/components/ui/input';

/**
 * Input de montos con formato es-AR mientras se escribe:
 * el usuario ve "500.000,00" pero el componente entrega el número 500000.
 *
 * Uso:
 *   <MoneyInput value={monto} onValueChange={(n) => setMonto(n)} />
 *
 * `value` es el número real (null = vacío). Al salir del campo se normaliza
 * la visualización con los decimales completos (500000 → "500.000,00").
 */

/** "1.234,5" → 1234.5 (null si está vacío o no es un número). */
export function parseMoney(display: string): number | null {
    const clean = display.replace(/\./g, '').replace(',', '.');
    if (clean === '') return null;
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
}

/** 1234.5 → "1.234,50" */
export function formatMoney(value: number, decimals = 2): string {
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

/** Separadores de miles sobre la parte entera: "1234567" → "1.234.567" */
function formatMiles(entero: string): string {
    return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

interface MoneyInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
    /** Valor numérico real (null = campo vacío). */
    value: number | null;
    /** Recibe el número parseado en cada tecla (null si quedó vacío). */
    onValueChange: (value: number | null) => void;
    /** Máximo de decimales aceptados (default 2). */
    decimals?: number;
}

export function MoneyInput({
    value,
    onValueChange,
    decimals = 2,
    onBlur,
    onFocus,
    ...props
}: MoneyInputProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [focused, setFocused] = React.useState(false);
    const [display, setDisplay] = React.useState<string>(
        value != null ? formatMoney(value, decimals) : '',
    );

    // Cambios externos del valor (reset del form, datos nuevos) se reflejan
    // sólo cuando el usuario no está escribiendo en el campo.
    React.useEffect(() => {
        if (!focused) {
            setDisplay(value != null ? formatMoney(value, decimals) : '');
        }
    }, [value, focused, decimals]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = e.target.value;
        const caret = e.target.selectionStart ?? raw.length;

        // Cuántos dígitos/coma hay antes del caret, para reubicarlo después
        // de re-formatear (los puntos de miles se mueven solos).
        const relevantesAntesDelCaret = raw
            .slice(0, caret)
            .replace(/[^\d,]/g, '').length;

        // Sanitizar: sólo dígitos y UNA coma decimal.
        let sane = raw.replace(/[^\d,]/g, '');
        const primeraComa = sane.indexOf(',');
        if (primeraComa !== -1) {
            sane = sane.slice(0, primeraComa + 1) + sane.slice(primeraComa + 1).replace(/,/g, '');
        }

        let [entero, decimal] = sane.split(',');
        entero = entero.replace(/^0+(?=\d)/, '');
        if (decimal !== undefined) {
            decimal = decimal.slice(0, decimals);
        }

        const formatted =
            formatMiles(entero) + (decimal !== undefined ? ',' + decimal : '');

        setDisplay(formatted);
        onValueChange(parseMoney(formatted));

        // Reponer el caret detrás de la misma cantidad de dígitos.
        requestAnimationFrame(() => {
            const el = inputRef.current;
            if (!el) return;
            let pos = 0;
            let vistos = 0;
            while (pos < formatted.length && vistos < relevantesAntesDelCaret) {
                if (/[\d,]/.test(formatted[pos])) vistos++;
                pos++;
            }
            el.setSelectionRange(pos, pos);
        });
    }

    return (
        <Input
            {...props}
            ref={inputRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={display}
            onChange={handleChange}
            onFocus={(e) => {
                setFocused(true);
                onFocus?.(e);
            }}
            onBlur={(e) => {
                setFocused(false);
                // Normalizar al salir: 500000 → "500.000,00".
                setDisplay(value != null ? formatMoney(value, decimals) : '');
                onBlur?.(e);
            }}
        />
    );
}
