import { Link, router } from '@inertiajs/react';
import { Check, LogOut, Monitor, Moon, Sun, Palette } from 'lucide-react';
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
import type { User } from '@/types';

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

    const handleLogout = () => {
        cleanup();
        router.flushAll();
    };

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
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
