import { Link, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { CalendarClock, LayoutGrid, Package, Users } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
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
import type { NavItem } from '@/types';

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const { auth } = usePage<any>().props;
    const { url } = usePage();
    const { setOpenMobile, isMobile } = useSidebar();

    // Close the mobile sidebar when the URL changes (navigation)
    useEffect(() => {
        if (isMobile) {
            setOpenMobile(false);
        }
    }, [url, isMobile, setOpenMobile]);

    const mainNavItems: NavItem[] = [
        {
            title: 'Dashboard',
            href: dashboard.url(),
            icon: LayoutGrid,
        },
        {
            title: 'Inventario',
            href: articulosIndex.url(),
            icon: Package,
        },
        {
            title: 'Turnos',
            href: '/appointments',
            icon: CalendarClock,
        },
    ];

    if (auth.user.role === 'administrador') {
        mainNavItems.push({
            title: 'Usuarios',
            href: '#',
            icon: Users,
            items: [
                { title: 'Administradores', href: '/users?role=administrador' },
                { title: 'Mecánicos', href: '/users?role=mecanico' },
                { title: 'Choferes', href: '/users?role=chofer' },
            ],
        });
    }

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard.url()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
