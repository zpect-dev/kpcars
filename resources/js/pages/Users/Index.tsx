import { Head, router, usePage, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';

import { index as usersIndex, updateRole, store } from '@/routes/users';

interface User {
    id: number;
    name: string;
    dni: string;
    role: string;
    inactivo: boolean;
    correo?: string | null;
    telefono?: string | null;
    fecha_vencimiento_licencia?: string | null;
}

interface RoleOption {
    value: string;
    label: string;
}

interface Props {
    users: User[];
    roles: RoleOption[];
    filterRoles: RoleOption[];
}

export default function UsersIndex({ users, roles, filterRoles }: Props) {
    const [userToToggle, setUserToToggle] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const q = searchTerm.toLowerCase();
        return users.filter(
            (u) =>
                u.name.toLowerCase().includes(q) ||
                u.dni.toLowerCase().includes(q),
        );
    }, [users, searchTerm]);

    function confirmToggleStatus(user: User) {
        if (user.id === auth.user.id) return;
        setUserToToggle(user);
    }

    function executeToggleStatus() {
        if (!userToToggle) return;
        router.patch(
            `/users/${userToToggle.id}/toggle-status`,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setUserToToggle(null),
            },
        );
    }

    const [showCreateModal, setShowCreateModal] = useState(false);
    const createForm = useForm({
        name: '',
        dni: '',
        role: 'MECANICO',
        password: '',
        password_confirmation: '',
        correo: '',
        telefono: '',
        fecha_vencimiento_licencia: '',
    });

    function openCreateModal() {
        createForm.reset();
        createForm.clearErrors();
        setShowCreateModal(true);
    }

    function closeCreateModal() {
        setShowCreateModal(false);
        createForm.reset();
    }

    function handleCreateSubmit(e: React.FormEvent) {
        e.preventDefault();
        createForm.post(store.url(), {
            onSuccess: () => closeCreateModal(),
            preserveScroll: true,
        });
    }

    const { auth } = usePage<any>().props;
    const urlParams = new URLSearchParams(window.location.search);
    const filterRole = urlParams.get('role');
    const pageTitle = filterRole
        ? `Usuarios - ${filterRole.charAt(0).toUpperCase() + filterRole.slice(1)}`
        : 'Gestión de Usuarios';

    const handleRoleChange = (userId: number, newRole: string) => {
        router.patch(
            updateRole.url(userId),
            { role: newRole },
            {
                preserveScroll: true,
                preserveState: true,
            },
        );
    };

    return (
        <>
            <Head title={pageTitle} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Buscar por nombre o DNI..."
                                className="bg-card pl-9 shadow-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            {filterRoles.map((r) => (
                                <Button
                                    key={r.value}
                                    variant={
                                        filterRole === r.value
                                            ? 'default'
                                            : 'outline'
                                    }
                                    size="sm"
                                    className="h-8 rounded-md px-4 text-xs font-medium"
                                    onClick={() =>
                                        router.get(
                                            usersIndex.url(),
                                            { role: r.value },
                                            { preserveState: false },
                                        )
                                    }
                                >
                                    {r.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button size="sm" onClick={openCreateModal}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Usuario
                        </Button>
                    </div>
                </div>

                <div className="w-full self-start overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] table-fixed text-left text-sm text-muted-foreground">
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th
                                        scope="col"
                                        className="w-[20%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Nombre
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[20%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Contacto
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[15%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        DNI
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[15%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Licencia
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[10%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Estado
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[20%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Rol
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-12 text-center text-muted-foreground sm:px-6"
                                        >
                                            No se encontraron usuarios que
                                            coincidan con la búsqueda.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr
                                            key={user.id}
                                            className="bg-card transition-colors hover:bg-muted/40"
                                        >
                                            <td
                                                className="truncate px-4 py-3 font-semibold text-foreground sm:px-6 sm:py-4"
                                                title={user.name}
                                            >
                                                {user.name}
                                            </td>
                                            <td className="px-4 py-3 text-xs sm:px-6 sm:py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    {user.correo ? (
                                                        <span
                                                            title={user.correo}
                                                            className="truncate"
                                                        >
                                                            {user.correo}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/50 italic">
                                                            Sin correo
                                                        </span>
                                                    )}
                                                    {user.telefono ? (
                                                        <span
                                                            title={
                                                                user.telefono
                                                            }
                                                        >
                                                            {user.telefono}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/50 italic">
                                                            Sin teléfono
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm sm:px-6 sm:py-4">
                                                <span className="font-medium text-foreground">
                                                    {user.dni}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs sm:px-6 sm:py-4">
                                                {user.fecha_vencimiento_licencia ? (
                                                    <span
                                                        className="text-muted-foreground"
                                                        title="Vencimiento de Licencia"
                                                    >
                                                        {new Date(
                                                            user.fecha_vencimiento_licencia,
                                                        ).toLocaleDateString()}
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="text-muted-foreground/50 italic"
                                                        title="No tiene licencia registrada"
                                                    >
                                                        N/A
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                className="truncate px-4 py-3 font-medium sm:px-6 sm:py-4"
                                                title={
                                                    user.inactivo
                                                        ? 'Inactivo'
                                                        : 'Activo'
                                                }
                                            >
                                                <button
                                                    onClick={() =>
                                                        confirmToggleStatus(
                                                            user,
                                                        )
                                                    }
                                                    disabled={
                                                        user.id === auth.user.id
                                                    }
                                                    className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold transition-colors focus:ring-2 focus:ring-gray-950 focus:ring-offset-1 focus:outline-none ${user.inactivo ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-green-100 text-green-800 hover:bg-green-200'} ${user.id === auth.user.id ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                                >
                                                    {user.inactivo
                                                        ? 'Inactivo'
                                                        : 'Activo'}
                                                </button>
                                            </td>
                                            <td className="truncate px-4 py-3 sm:px-6 sm:py-4">
                                                {user.id === auth.user.id ? (
                                                    <span className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
                                                        {roles.find(
                                                            (r) =>
                                                                r.value ===
                                                                user.role,
                                                        )?.label ||
                                                            user.role}{' '}
                                                        (Tú)
                                                    </span>
                                                ) : (
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) =>
                                                            handleRoleChange(
                                                                user.id,
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="block w-full max-w-xs rounded-md border-input bg-background px-3 py-1.5 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {roles.map((role) => (
                                                            <option
                                                                key={role.value}
                                                                value={
                                                                    role.value
                                                                }
                                                            >
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

            <Dialog
                open={showCreateModal}
                onOpenChange={(open) => !open && closeCreateModal()}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo Usuario</DialogTitle>
                        <DialogDescription>
                            Crea un nuevo usuario en el sistema. El usuario
                            deberá cambiar su contraseña al iniciar sesión por
                            primera vez desde la App o Web según su rol.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nombre Completo</Label>
                            <Input
                                id="name"
                                value={createForm.data.name}
                                onChange={(e) =>
                                    createForm.setData('name', e.target.value)
                                }
                                placeholder="Ej. Juan Pérez"
                                required
                            />
                            <InputError message={createForm.errors.name} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="dni">DNI</Label>
                                <Input
                                    id="dni"
                                    value={createForm.data.dni}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'dni',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Sin puntos"
                                    required
                                />
                                <InputError message={createForm.errors.dni} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="role">Rol</Label>
                                <select
                                    id="role"
                                    value={createForm.data.role}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'role',
                                            e.target.value,
                                        )
                                    }
                                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
                                >
                                    {roles.map((r) => (
                                        <option
                                            key={r.value}
                                            value={r.value}
                                            className="bg-background text-foreground"
                                        >
                                            {r.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={createForm.errors.role} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="correo">Correo</Label>
                            <Input
                                id="correo"
                                type="email"
                                value={createForm.data.correo}
                                onChange={(e) =>
                                    createForm.setData('correo', e.target.value)
                                }
                                placeholder="usuario@correo.com"
                            />
                            <InputError message={createForm.errors.correo} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="telefono">Teléfono</Label>
                                <Input
                                    id="telefono"
                                    value={createForm.data.telefono}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'telefono',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="+56 9..."
                                />
                                <InputError
                                    message={createForm.errors.telefono}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="fecha_vencimiento_licencia">
                                    Vencimiento Licencia
                                </Label>
                                <Input
                                    id="fecha_vencimiento_licencia"
                                    type="date"
                                    value={
                                        createForm.data
                                            .fecha_vencimiento_licencia
                                    }
                                    onChange={(e) =>
                                        createForm.setData(
                                            'fecha_vencimiento_licencia',
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={
                                        createForm.errors
                                            .fecha_vencimiento_licencia
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="password">
                                    Contraseña Provisional
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={createForm.data.password}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'password',
                                            e.target.value,
                                        )
                                    }
                                    required
                                />
                                <InputError
                                    message={createForm.errors.password}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Confirmar Contraseña
                                </Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    value={
                                        createForm.data.password_confirmation
                                    }
                                    onChange={(e) =>
                                        createForm.setData(
                                            'password_confirmation',
                                            e.target.value,
                                        )
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeCreateModal}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={createForm.processing}
                            >
                                {createForm.processing
                                    ? 'Creando...'
                                    : 'Crear Usuario'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Confirmar Toggle de Estado */}
            <Dialog
                open={!!userToToggle}
                onOpenChange={(open) => !open && setUserToToggle(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Cambio de Estado</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de que deseas{' '}
                            {userToToggle?.inactivo ? 'activar' : 'desactivar'}{' '}
                            al usuario <strong>{userToToggle?.name}</strong>?
                            {!userToToggle?.inactivo && (
                                <span className="mt-2 block font-semibold text-red-600 dark:text-red-400">
                                    Nota: Al desactivar al usuario, se cerrarán
                                    sus asignaciones activas de vehículos y se
                                    desvinculará de cualquier placa asociada
                                    automáticamente.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setUserToToggle(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant={
                                !userToToggle?.inactivo
                                    ? 'destructive'
                                    : 'default'
                            }
                            onClick={executeToggleStatus}
                        >
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
