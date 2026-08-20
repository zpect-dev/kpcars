import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';


function CollapsibleNavItem({
    item,
    isActive,
    isCurrentUrl,
}: {
    item: NavItem;
    isActive: boolean;
    isCurrentUrl: (href: NavItem['href']) => boolean;
}) {
    const [open, setOpen] = useState(isActive);

    // El grupo se despliega solo cuando pasa a estar activo, pero después el
    // usuario puede volver a plegarlo. Se ajusta durante el render, no con un
    // efecto, para no encadenar un segundo commit en cada navegación.
    const [activoPrevio, setActivoPrevio] = useState(isActive);

    if (isActive !== activoPrevio) {
        setActivoPrevio(isActive);

        if (isActive) {
            setOpen(true);
        }
    }

    return (
        <Collapsible
            asChild
            open={open}
            onOpenChange={setOpen}
            className="group/collapsible"
        >
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title} isActive={isActive}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {item.items!.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                    asChild
                                    isActive={subItem.isActive ?? isCurrentUrl(subItem.href)}
                                >
                                    <Link href={subItem.href}>
                                        <span>{subItem.title}</span>
                                    </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}

export interface NavGroup {
    label?: string;
    items: NavItem[];
}

function NavGroupSection({ group, isCurrentUrl }: { group: NavGroup; isCurrentUrl: (href: NavItem['href']) => boolean }) {
    return (
        <SidebarGroup className="px-2 py-0">
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
                {group.items.map((item) => {
                    const isActive =
                        item.isActive ??
                        (isCurrentUrl(item.href) ||
                            !!item.items?.some((sub) => sub.isActive ?? isCurrentUrl(sub.href)));

                    return item.items && item.items.length > 0 ? (
                        <CollapsibleNavItem
                            key={item.title}
                            item={item}
                            isActive={isActive}
                            isCurrentUrl={isCurrentUrl}
                        />
                    ) : (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                tooltip={{ children: item.title }}
                            >
                                <Link href={item.href} prefetch>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}

export function NavMain({ groups }: { groups: NavGroup[] }) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <>
            {groups.map((group, i) => (
                <NavGroupSection key={group.label ?? i} group={group} isCurrentUrl={isCurrentUrl} />
            ))}
        </>
    );
}
