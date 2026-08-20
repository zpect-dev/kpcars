import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type Tone = 'destructive' | 'warning' | 'default';

const TONE_STYLES: Record<Tone, { icon: string; action: string }> = {
    destructive: {
        icon: 'bg-destructive-soft text-destructive-soft-foreground',
        action: 'bg-destructive text-white hover:bg-destructive/90 dark:text-background',
    },
    warning: {
        icon: 'bg-warning-soft text-warning-soft-foreground',
        action: 'bg-warning text-warning-foreground hover:bg-warning/90',
    },
    default: {
        icon: 'bg-accent text-accent-foreground',
        action: '',
    },
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Pregunta concreta, no "¿Estás seguro?". Ej: "¿Eliminar el service del AB123CD?" */
    title: string;
    /** Qué pasa al confirmar y qué no se puede deshacer. */
    description?: ReactNode;
    /** Verbo real de la acción, no "Aceptar". Ej: "Eliminar service". */
    confirmLabel: string;
    cancelLabel?: string;
    tone?: Tone;
    /** Deshabilita los botones y muestra spinner mientras se envía. */
    processing?: boolean;
    onConfirm: () => void;
};

/**
 * Confirmación de una acción que no se puede deshacer. Reemplaza a
 * window.confirm(): respeta el tema y, al montarse sobre AlertDialog, se
 * anuncia como alertdialog, no se cierra al clickear afuera y arranca con el
 * foco en Cancelar, que es la opción segura.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancelar',
    tone = 'destructive',
    processing = false,
    onConfirm,
}: Props) {
    const styles = TONE_STYLES[tone];

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-[420px]">
                <AlertDialogHeader className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                    <span
                        className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-full',
                            styles.icon,
                        )}
                    >
                        <AlertTriangle aria-hidden="true" className="size-5" />
                    </span>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    {description && (
                        <AlertDialogDescription>
                            {description}
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>

                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel disabled={processing}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className={styles.action}
                        disabled={processing}
                        onClick={(event) => {
                            // El cierre lo decide quien llama: puede querer
                            // mantenerlo abierto mientras la petición viaja.
                            event.preventDefault();
                            onConfirm();
                        }}
                    >
                        {processing && (
                            <Loader2
                                aria-hidden="true"
                                className="size-4 animate-spin"
                            />
                        )}
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
