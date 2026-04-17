import { Head, router, usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';
import { index as usersIndex, updateRole } from '@/routes/users';

interface User {
    id: number;
    name: string;
    dni: string;
    role: string;
    inactivo: boolean;
}

interface RoleOption {
    value: string;
    label: string;
}

interface Props {
    users: User[];
    roles: RoleOption[];
}

export default function UsersIndex({ users, roles }: Props) {
    const { auth } = usePage<PageProps>().props;

    const handleRoleChange = (userId: number, newRole: string) => {
        router.patch(updateRole.url(userId), { role: newRole }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    return (
        <>
            <Head title="Gestión de Usuarios" />
            <div className="flex h-full flex-1 gap-6 rounded-xl p-4">
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm self-start">
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed text-left text-sm text-muted-foreground">
                            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th scope="col" className="w-[35%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">Nombre</th>
                                    <th scope="col" className="w-[20%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">DNI</th>
                                    <th scope="col" className="w-[20%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">Estado</th>
                                    <th scope="col" className="w-[25%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">Rol</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground sm:px-6">
                                            No hay usuarios registrados en el sistema.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="transition-colors bg-card hover:bg-muted/40">
                                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground sm:px-6 sm:py-4">
                                                {user.name}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 sm:px-6 sm:py-4">
                                                {user.dni}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 font-medium sm:px-6 sm:py-4">
                                                {user.inactivo ? (
                                                    <span className="inline-flex rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                                                        Inactivo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                                                        Activo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 sm:px-6 sm:py-4">
                                                {user.id === auth.user.id ? (
                                                    <span className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
                                                        {roles.find(r => r.value === user.role)?.label || user.role} (Tú)
                                                    </span>
                                                ) : (
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                        className="block w-full max-w-xs rounded-md border-input bg-background px-3 py-1.5 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {roles.map((role) => (
                                                            <option key={role.value} value={role.value}>
                                                                {role.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

UsersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Gestión de Usuarios',
            href: usersIndex.url(),
        },
    ],
};
