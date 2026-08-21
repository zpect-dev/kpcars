import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from './popover';

export interface ComboboxOption {
    /** Unique identifier for the option */
    value: string;
    /** Primary text shown in the dropdown */
    label: string;
    /** Secondary text shown to the right */
    sub?: string;
    /** Short code shown as a badge before the label (e.g. "AMO-01") */
    code?: string;
}

/**
 * Normaliza para buscar: minúsculas y sin separadores, de modo que "amo01",
 * "AMO 01" y "amo-01" encuentren todos a "AMO-01".
 */
function normalizar(texto: string): string {
    return texto.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface ComboboxProps {
    /** Unique id for the input element */
    id?: string;
    /** Placeholder text shown when the input is empty */
    placeholder?: string;
    /** List of options to search through */
    options: ComboboxOption[];
    /** Currently selected value (the option's `value` field) */
    value: string;
    /** Called when the user selects an option */
    onSelect: (option: ComboboxOption) => void;
    /** Called when the text input changes (raw text) */
    onInputChange?: (text: string) => void;
    /** Whether to transform the input to uppercase */
    uppercase?: boolean;
    /** Disable the input */
    disabled?: boolean;
    /** Maximum number of suggestions to show */
    maxSuggestions?: number;
    /** Text to show when no suggestions match */
    emptyText?: string;
    /** Additional className for the wrapper */
    className?: string;
}

/**
 * A reusable autocomplete/combobox component.
 *
 * It displays an input with a dropdown list of suggestions
 * that filters as the user types. Supports keyboard navigation
 * (ArrowUp/ArrowDown/Enter/Tab/Escape).
 */
export function Combobox({
    id,
    placeholder,
    options,
    value,
    onSelect,
    onInputChange,
    uppercase = false,
    disabled = false,
    maxSuggestions = 8,
    emptyText = 'Sin coincidencias',
    className,
}: ComboboxProps) {
    // Display text: either the label from the selected option or the raw search
    const selectedOption = options.find((o) => o.value === value);
    const [inputText, setInputText] = useState(selectedOption?.label ?? '');
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync input text when external value changes (e.g. form reset)
    useEffect(() => {
        const opt = options.find((o) => o.value === value);
        setInputText(opt?.label ?? (value || ''));
    }, [value, options]);

    const filtered = useMemo(() => {
        const q = inputText.toLowerCase().trim();
        if (!q) return options.slice(0, maxSuggestions);

        // Cada palabra escrita debe aparecer en el texto de la opción, tal cual
        // o ignorando separadores (así "amo01" encuentra "AMO-01").
        const tokens = q.split(/\s+/).filter(Boolean);

        return options
            .filter((o) => {
                const texto = [o.code, o.label, o.sub]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                const plano = normalizar(texto);

                return tokens.every(
                    (t) => texto.includes(t) || plano.includes(normalizar(t)),
                );
            })
            .slice(0, maxSuggestions);
    }, [options, inputText, maxSuggestions]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = uppercase ? e.target.value.toUpperCase() : e.target.value;
        setInputText(raw);
        setHighlightedIndex(-1);
        setShowDropdown(true);
        onInputChange?.(raw);
    }

    function handleSelect(option: ComboboxOption) {
        setInputText(option.label);
        setShowDropdown(false);
        setHighlightedIndex(-1);
        onSelect(option);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!showDropdown || filtered.length === 0) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                setShowDropdown(true);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev + 1) % filtered.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev <= 0 ? filtered.length - 1 : prev - 1,
            );
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(filtered[highlightedIndex]);
        } else if (e.key === 'Tab') {
            const target =
                highlightedIndex >= 0 ? filtered[highlightedIndex] : filtered[0];
            if (target && showDropdown) {
                e.preventDefault();
                handleSelect(target);
            }
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
            setHighlightedIndex(-1);
        }
    }

    return (
        <Popover open={showDropdown} onOpenChange={setShowDropdown}>
            <PopoverAnchor asChild>
                <div className={cn('relative', className)}>
                    <Input
                        id={id}
                        ref={inputRef}
                        autoComplete="off"
                        placeholder={placeholder}
                        value={inputText}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setShowDropdown(true)}
                        onMouseDown={() => setShowDropdown(true)}
                        disabled={disabled}
                    />
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="p-0 border-none shadow-none"
                style={{ width: inputRef.current?.offsetWidth }}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => {
                    // El target del CustomEvent de Radix es el propio Content,
                    // el elemento realmente clickeado está en detail.originalEvent.target.
                    const original = (e.detail as { originalEvent: PointerEvent })
                        .originalEvent.target as Node | null;
                    if (original && inputRef.current?.contains(original)) {
                        e.preventDefault();
                    }
                }}
                onFocusOutside={(e) => {
                    // Mismo caso para el evento de foco fuera.
                    const original = (e.detail as { originalEvent: FocusEvent })
                        .originalEvent.target as Node | null;
                    if (original && inputRef.current?.contains(original)) {
                        e.preventDefault();
                    }
                }}
            >
                <div className="w-full overflow-hidden rounded-md border border-border bg-popover shadow-md min-w-[var(--radix-popover-trigger-width)]">
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-muted-foreground">
                                {emptyText}
                            </p>
                        ) : (
                            filtered.map((option, idx) => (
                                <button
                                    key={`${option.value}-${idx}`}
                                    type="button"
                                    className={cn(
                                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                                        highlightedIndex === idx
                                            ? 'bg-accent text-accent-foreground'
                                            : 'hover:bg-accent/60',
                                    )}
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    onPointerDown={(e) => {
                                        // Evita que el input pierda el foco al
                                        // presionar; la seleccion ocurre en el
                                        // click, que tambien cubre tactil.
                                        e.preventDefault();
                                    }}
                                    onClick={() => handleSelect(option)}
                                >
                                    <span className="flex min-w-0 flex-1 items-center gap-2">
                                        {option.code && (
                                            <span
                                                className={cn(
                                                    'shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-semibold',
                                                    highlightedIndex === idx
                                                        ? 'bg-background/70 text-foreground'
                                                        : 'bg-muted text-muted-foreground',
                                                )}
                                            >
                                                {option.code}
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1 truncate font-medium">
                                            {option.label}
                                        </span>
                                    </span>
                                    {option.sub && (
                                        <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                                            {option.sub}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
