import { Link, router, usePage } from '@inertiajs/react';
import { Building2, Check, LogOut, Monitor, Moon, Palette, Sun } from 'lucide-react';
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useAppearance } from '@/hooks/use-appearance';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { logout } from '@/routes';
import empresaRoutes from '@/routes/empresa';
import type { Auth, User } from '@/types';

type Props = {
    user: User;
};

const themes = [
    { value: 'light' as const, label: 'Claro', icon: Sun },
    { value: 'dark' as const, label: 'Oscuro', icon: Moon },
    { value: 'system' as const, label: 'Sistema', icon: Monitor },
];

export function UserMenuContent({ user }: Props) {
    const cleanup = useMobileNavigation();
    const { appearance, updateAppearance } = useAppearance();
    const { auth } = usePage<{ auth: Auth }>().props;

    const handleLogout = () => {
        cleanup();
        router.flushAll();
    };

    const canSwitchEmpresa = auth.permissions?.can_switch_empresa ?? false;
    const empresas = auth.empresas_disponibles ?? [];
    const activeCompanyId = auth.active_company?.id ?? null;

    const switchEmpresa = (empresaId: number) => {
        if (empresaId === activeCompanyId) return;
        router.post(
            empresaRoutes.switch.url(),
            { empresa_id: empresaId },
            { preserveScroll: true, preserveState: false },
        );
    };

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {canSwitchEmpresa && empresas.length > 1 && (
                <>
                    <DropdownMenuGroup>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="cursor-pointer">
                                <Building2 className="mr-2 h-4 w-4" />
                                <div className="flex flex-col">
                                    <span>Empresa</span>
                                    {auth.active_company && (
                                        <span className="text-xs text-muted-foreground">
                                            {auth.active_company.nombre}
                                        </span>
                                    )}
                                </div>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {empresas.map((empresa) => (
                                    <DropdownMenuItem
                                        key={empresa.id}
                                        onClick={() => switchEmpresa(empresa.id)}
                                        className="cursor-pointer"
                                    >
                                        <Building2 className="mr-2 h-4 w-4" />
                                        {empresa.nombre}
                                        {empresa.id === activeCompanyId && (
                                            <Check className="ml-auto h-4 w-4 text-primary" />
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                </>
            )}

            <DropdownMenuGroup>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                        <Palette className="mr-2 h-4 w-4" />
                        Temas
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        {themes.map(({ value, label, icon: Icon }) => (
                            <DropdownMenuItem
                                key={value}
                                onClick={() => updateAppearance(value)}
                                className="cursor-pointer"
                            >
                                <Icon className="mr-2 h-4 w-4" />
                                {label}
                                {appearance === value && (
                                    <Check className="ml-auto h-4 w-4 text-primary" />
                                )}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link
                    className="block w-full cursor-pointer"
                    href={logout()}
                    as="button"
                    onClick={handleLogout}
                    data-test="logout-button"
                >
                    <LogOut className="mr-2" />
                    Cerrar sesión
                </Link>
            </DropdownMenuItem>
        </>
    );
}
