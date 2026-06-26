import { Link, usePage } from '@inertiajs/react';
import { CalendarClock, CarFront, ClipboardCheck, Coins, Gauge, HandCoins, History, Package, Receipt, Users, Wallet } from 'lucide-react';
import { useEffect } from 'react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain  } from '@/components/nav-main';
import type {NavGroup} from '@/components/nav-main';
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
import { index as gastosIndex } from '@/routes/gastos';
import type { Auth, NavItem } from '@/types';

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const { url } = usePage();
    const { setOpenMobile, isMobile } = useSidebar();

    // Cerrar sidebar mobile al navegar
    useEffect(() => {
        if (isMobile) {
setOpenMobile(false);
}
    }, [url, isMobile, setOpenMobile]);

    const perms = auth.permissions ?? {};

    // ── Grupo Taller ─────────────────────────────────────────────────────
    const tallerItems: NavItem[] = [];

    if (perms.can_view_vehiculos) {
        tallerItems.push({ title: 'Vehículos', href: dashboard.url(), icon: CarFront });
    }

    if (perms.can_view_turnos) {
        tallerItems.push({ title: 'Turnos', href: '/appointments', icon: CalendarClock });
    }

    if (perms.can_view_revisiones) {
        tallerItems.push({ title: 'Revisiones', href: '/revisiones', icon: ClipboardCheck });
    }

    if (perms.can_view_service) {
        tallerItems.push({ title: 'Service', href: '/services', icon: Gauge });
    }

    // ── Grupo Gestión ────────────────────────────────────────────────────
    const gestionItems: NavItem[] = [];

    if (perms.can_view_cobros) {
        gestionItems.push({ title: 'Cobros', href: cobrosIndex.url(), icon: Receipt });
    }

    if (perms.can_view_recaudaciones) {
        gestionItems.push({ title: 'Recaudaciones', href: '/recaudaciones', icon: Coins });
    }

    if (perms.can_view_gastos) {
        gestionItems.push({ title: 'Gastos', href: gastosIndex.url(), icon: HandCoins });
    }

    if (perms.can_view_inventario) {
        gestionItems.push({ title: 'Inventario', href: articulosIndex.url(), icon: Package });
    }

    if (perms.can_view_personal) {
        const currentRole = url.includes('/users')
            ? new URLSearchParams(url.split('?')[1] ?? '').get('role')
            : null;

        gestionItems.push({
            title: 'Personal',
            href: '/users',
            icon: Users,
            items: [
                { title: 'Administración', href: '/users?role=administrador', isActive: currentRole === 'administrador' },
                { title: 'Administrativos', href: '/users?role=administrativo', isActive: currentRole === 'administrativo' },
                { title: 'Mecánicos', href: '/users?role=mecanico', isActive: currentRole === 'mecanico' },
                { title: 'Choferes', href: '/users?role=chofer&status=activos', isActive: currentRole === 'chofer' },
                { title: 'Inversores', href: '/users?role=inversor', isActive: currentRole === 'inversor' },
            ],
        });
    }

    if (perms.can_view_historial) {
        gestionItems.push({ title: 'Historial', href: '/historial', icon: History });
    }

    // ── Grupo Inversiones (admin only) ──────────────────────────────────
    const inversionesItems: NavItem[] = [];

    if (perms.can_view_inversiones) {
        inversionesItems.push({ title: 'Inversiones', href: '/inversiones', icon: Wallet });
    }

    // ── Grupo Mi Cuenta (inversor) ──────────────────────────────────────
    const miCuentaItems: NavItem[] = [];

    if (perms.can_view_mi_cuenta) {
        miCuentaItems.push({ title: 'Mi Cuenta', href: '/mi-cuenta', icon: Wallet });
    }

    // ── Ensamblado ──────────────────────────────────────────────────────
    const groups: NavGroup[] = [];

    if (miCuentaItems.length) {
groups.push({ items: miCuentaItems });
}

    if (tallerItems.length) {
groups.push({ label: 'Taller', items: tallerItems });
}

    if (gestionItems.length) {
groups.push({ label: 'Gestión', items: gestionItems });
}

    if (inversionesItems.length) {
groups.push({ label: 'Inversiones', items: inversionesItems });
}

    // ── Destino del logo ────────────────────────────────────────────────
    const role = auth.user?.role;
    const logoHref =
        role === 'mecanico' ? '/appointments'
            : role === 'inversor' ? '/mi-cuenta'
            : dashboard.url();

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={logoHref} prefetch>
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
