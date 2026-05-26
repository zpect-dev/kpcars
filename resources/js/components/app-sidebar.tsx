import { Link, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { CalendarClock, CarFront, ClipboardCheck, Package, Receipt, Users, Wallet } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain, type NavGroup } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { index as articulosIndex } from '@/routes/articulos';
import { index as cobrosIndex } from '@/routes/cobros';
import type { NavItem } from '@/types';

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const { auth } = usePage<any>().props;
    const { url } = usePage();
    const { setOpenMobile, isMobile } = useSidebar();

    useEffect(() => {
        if (isMobile) setOpenMobile(false);
    }, [url, isMobile, setOpenMobile]);

    let groups: NavGroup[] = [];

    if (auth.user.role === 'inversor') {
        groups = [
            {
                items: [{ title: 'Mi Cuenta', href: '/mi-cuenta', icon: Wallet }],
            },
        ];
    } else if (auth.user.role === 'mecanico') {
        groups = [
            {
                items: [
                    { title: 'Turnos', href: '/appointments', icon: CalendarClock },
                    { title: 'Inventario', href: articulosIndex.url(), icon: Package },
                ],
            },
        ];
    } else {
        const currentRole = url.includes('/users')
            ? new URLSearchParams(url.split('?')[1] ?? '').get('role')
            : null;

        const tallerItems: NavItem[] = [
            { title: 'Vehículos', href: dashboard.url(), icon: CarFront },
            { title: 'Turnos', href: '/appointments', icon: CalendarClock },
            { title: 'Revisiones', href: '/revisiones', icon: ClipboardCheck },
        ];

        const gestionItems: NavItem[] = [];

        if (auth.user.role === 'administrador' && auth.user.absoluto) {
            gestionItems.push({ title: 'Cobros', href: cobrosIndex.url(), icon: Receipt });
        }

        gestionItems.push({ title: 'Inventario', href: articulosIndex.url(), icon: Package });

        gestionItems.push({
            title: 'Personal',
            href: '/users',
            icon: Users,
            items: [
                { title: 'Administración', href: '/users?role=administrador', isActive: currentRole === 'administrador' },
                { title: 'Mecánicos',       href: '/users?role=mecanico',      isActive: currentRole === 'mecanico'      },
                { title: 'Choferes',        href: '/users?role=chofer&status=activos', isActive: currentRole === 'chofer' },
                { title: 'Inversores',      href: '/users?role=inversor',      isActive: currentRole === 'inversor'      },
            ],
        });

        groups = [
            { label: 'Taller',   items: tallerItems  },
            { label: 'Gestión',  items: gestionItems },
        ];

        if (auth.user.absoluto) {
            groups.push({
                label: 'Inversiones',
                items: [{ title: 'Inversiones', href: '/inversiones', icon: Wallet }],
            });
        }
    }

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link
                                href={
                                    auth.user.role === 'mecanico' ? '/appointments' :
                                    auth.user.role === 'inversor' ? '/mi-cuenta' :
                                    dashboard.url()
                                }
                                prefetch
                            >
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain groups={groups} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
