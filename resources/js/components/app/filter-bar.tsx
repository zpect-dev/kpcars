import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FilterBarProps = {
    children: ReactNode;
    /** Habilita el botón de limpiar y comunica que hay filtros puestos. */
    hasActiveFilters?: boolean;
    onClear?: () => void;
    /**
     * Columnas del grid en pantallas grandes, como clase de Tailwind.
     * Ej: `'lg:grid-cols-[1fr_1fr_auto]'`.
     */
    gridClassName?: string;
    className?: string;
};

/**
 * Barra de filtros de una vista.
 *
 * Es una envoltura de disposición, no de controles: cada vista sigue poniendo
 * su Input, su Select, su Combobox o su calendario. Lo que unifica es la
 * tarjeta, la grilla, el par rótulo/campo y el botón de limpiar, que hasta
 * ahora se copiaban a mano en cada archivo con variaciones.
 */
export function FilterBar({
    children,
    hasActiveFilters = false,
    onClear,
    gridClassName,
    className,
}: FilterBarProps) {
    return (
        <div
            className={cn(
                'rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4',
                className,
            )}
        >
            <div
                className={cn(
                    'grid grid-cols-1 items-end gap-3 sm:grid-cols-2',
                    gridClassName,
                )}
            >
                {children}

                {onClear && (
                    <div className="col-span-full flex items-end sm:col-span-2 lg:col-span-1">
                        <button
                            type="button"
                            onClick={onClear}
                            disabled={!hasActiveFilters}
                            title="Limpiar filtros"
                            aria-label="Limpiar filtros"
                            className={cn(
                                'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-9 lg:px-0',
                                hasActiveFilters
                                    ? 'border-border text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97]'
                                    : 'cursor-not-allowed border-border/40 text-muted-foreground/30',
                            )}
                        >
                            <X className="h-4 w-4" />
                            <span className="lg:hidden">Limpiar filtros</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

type FilterFieldProps = {
    label: string;
    /** Id del control, para que el rótulo apunte a él. */
    htmlFor?: string;
    children: ReactNode;
    className?: string;
};

/** Par rótulo/campo dentro de la barra. */
export function FilterField({
    label,
    htmlFor,
    children,
    className,
}: FilterFieldProps) {
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
        </div>
    );
}

type SearchInputProps = {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
};

/**
 * Campo de búsqueda con lupa y botón de borrar. Estaba copiado en catorce
 * vistas, y sólo en algunas se podía vaciar sin seleccionar el texto a mano.
 */
export function SearchInput({
    id,
    value,
    onChange,
    placeholder = 'Buscar...',
    className,
}: SearchInputProps) {
    return (
        <div className={cn('relative', className)}>
            <Search
                aria-hidden="true"
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
                id={id}
                type="text"
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={cn('pl-9', value && 'pr-9')}
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-label="Borrar la búsqueda"
                    className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <X className="size-3.5" />
                </button>
            )}
        </div>
    );
}
