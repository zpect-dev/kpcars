import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Cuatro anchos y nada más. Antes convivían dieciocho combinaciones de clases
 * y ocho anchos sueltos en píxeles, y el tamaño de un modal dependía de qué
 * archivo se había copiado al crearlo.
 */
const SIZES = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-[480px]',
    lg: 'sm:max-w-[640px]',
    xl: 'sm:max-w-3xl',
} as const;

const TONES = {
    primary: 'bg-primary/15 text-primary',
    success: 'bg-success-soft text-success-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
    destructive: 'bg-destructive-soft text-destructive-soft-foreground',
    info: 'bg-info-soft text-info-soft-foreground',
} as const;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    tone?: keyof typeof TONES;
    size?: keyof typeof SIZES;
    children: ReactNode;
    /**
     * Si se pasa, el diálogo monta el <form> y el botón principal lo envía.
     * Sin esto el diálogo es de sólo lectura y hay que dar un `footer` propio.
     */
    onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
    submitLabel?: string;
    submitDisabled?: boolean;
    cancelLabel?: string;
    /** Reemplaza el pie completo. Para casos con más de una acción. */
    footer?: ReactNode;
    /** Deshabilita los botones y muestra spinner mientras se envía. */
    processing?: boolean;
    className?: string;
};

/**
 * Diálogo de alta o edición. Cuerpo con scroll propio, pie fijo, y el foco
 * inicial en el primer campo del formulario.
 */
export function FormDialog({
    open,
    onOpenChange,
    title,
    description,
    icon: Icon,
    tone = 'primary',
    size = 'md',
    children,
    onSubmit,
    submitLabel = 'Guardar',
    submitDisabled = false,
    cancelLabel = 'Cancelar',
    footer,
    processing = false,
    className,
}: Props) {
    const body = (
        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-5 py-5">
            {children}
        </div>
    );

    const defaultFooter = (
        <DialogFooter className="border-t border-border px-5 py-4">
            <Button
                type="button"
                variant="outline"
                disabled={processing}
                onClick={() => onOpenChange(false)}
            >
                {cancelLabel}
            </Button>
            {onSubmit && (
                <Button
                    type="submit"
                    disabled={processing || submitDisabled}
                >
                    {processing && (
                        <Loader2
                            aria-hidden="true"
                            className="size-4 animate-spin"
                        />
                    )}
                    {submitLabel}
                </Button>
            )}
        </DialogFooter>
    );

    const content = (
        <>
            {body}
            {footer ?? defaultFooter}
        </>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    'gap-0 overflow-hidden p-0',
                    SIZES[size],
                    className,
                )}
            >
                <DialogHeader className="flex-row items-start gap-3 space-y-0 border-b border-border px-5 pt-5 pb-4">
                    {Icon && (
                        <span
                            className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                                TONES[tone],
                            )}
                        >
                            <Icon aria-hidden="true" className="size-5" />
                        </span>
                    )}
                    <div className="min-w-0 flex-1 text-left">
                        <DialogTitle className="text-base font-semibold">
                            {title}
                        </DialogTitle>
                        {description && (
                            <DialogDescription className="text-xs">
                                {description}
                            </DialogDescription>
                        )}
                    </div>
                </DialogHeader>

                {onSubmit ? (
                    <form onSubmit={onSubmit} className="contents">
                        {content}
                    </form>
                ) : (
                    content
                )}
            </DialogContent>
        </Dialog>
    );
}
