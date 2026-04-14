import type { Auth } from '@/types/auth';

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            flash: {
                success?: string;
                warning?: string;
                error?: string;
            };
            [key: string]: unknown;
        };
    }
}
