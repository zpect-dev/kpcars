import { router, usePage } from '@inertiajs/react';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import empresaRoutes from '@/routes/empresa';
import type { Auth } from '@/types';

/**
 * Selector de empresa para la barra superior. Siempre visible:
 *  - Si el usuario puede cambiar y tiene >=2 empresas → dropdown interactivo.
 *  - Si tiene una empresa fija (inversor con 1, administrativo restringido) →
 *    chip informativo no interactivo.
 *  - Si no hay empresa activa (mecánico/chofer) → no renderiza nada.
 */
export function CompanySwitcher() {
    const { auth } = usePage<{ auth: Auth }>().props;

    const active = auth.active_company;
    const empresas = auth.empresas_disponibles ?? [];
    const canSwitch = (auth.permissions?.can_switch_empresa ?? false) && empresas.length > 1;

    if (!active) {
        return null;
    }

    // Chip estático cuando no puede cambiar.
    if (!canSwitch) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="max-w-[10rem] truncate">{active.nombre}</span>
            </span>
        );
    }

    const switchEmpresa = (empresaId: number) => {
        if (empresaId === active.id) return;
        router.post(
            empresaRoutes.switch.url(),
            { empresa_id: empresaId },
            { preserveScroll: true, preserveState: false },
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:ring-2 focus:ring-ring focus:outline-none"
                >
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[8rem] truncate sm:max-w-[12rem]">{active.nombre}</span>
                    <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Cambiar de empresa
                </DropdownMenuLabel>
                {empresas.map((empresa) => (
                    <DropdownMenuItem
                        key={empresa.id}
                        onClick={() => switchEmpresa(empresa.id)}
                        className="cursor-pointer"
                    >
                        <Building2 className="mr-2 h-4 w-4" />
                        <span className="truncate">{empresa.nombre}</span>
                        {empresa.id === active.id && (
                            <Check className={cn('ml-auto h-4 w-4 text-primary')} />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
