import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function useFlashToast(): void {
    useEffect(() => {
        return router.on('success', (event) => {
            const flash = (event.detail.page.props as Record<string, unknown>).flash as {
                success?: string;
                warning?: string;
                error?: string;
            } | undefined;

            if (!flash) return;

            if (flash.success) {
                toast.success(flash.success);
            }

            if (flash.warning) {
                toast.warning(flash.warning);
            }

            if (flash.error) {
                toast.error(flash.error);
            }
        });
    }, []);
}
