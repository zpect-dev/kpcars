import { Head, router, usePage, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    const [userToToggle, setUserToToggle] = useState<User | null>(null);

    function confirmToggleStatus(user: User) {
        if (user.id === auth.user.id) return;
        setUserToToggle(user);
    }

    function executeToggleStatus() {
        if (!userToToggle) return;
        router.patch(`/users/${userToToggle.id}/toggle-status`, {}, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setUserToToggle(null),
        });
    }


    const [showCreateModal, setShowCreateModal] = useState(false);
    const createForm = useForm({
        name: '',
        dni: '',
        role: 'MECANICO',
        password: '',
        password_confirmation: '',
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
        router.patch(updateRole.url(userId), { role: newRole }, {
            preserveScroll: true,
            preserveState: true,
        });
    }

    return (
        <>
            <Head title={pageTitle} />
            
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div></div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={openCreateModal}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Usuario
                        </Button>
                    </div>
                </div>
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm self-start">

                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed min-w-[700px] text-left text-sm text-muted-foreground">
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
                                            <td className="truncate px-4 py-3 font-semibold text-foreground sm:px-6 sm:py-4" title={user.name}>
                                                {user.name}
                                            </td>
                                            <td className="truncate px-4 py-3 sm:px-6 sm:py-4" title={user.dni}>
                                                {user.dni}
                                            </td>
                                            <td className="truncate px-4 py-3 font-medium sm:px-6 sm:py-4" title={user.inactivo ? 'Inactivo' : 'Activo'}>
                                                <button
                                                    onClick={() => confirmToggleStatus(user)}
                                                    disabled={user.id === auth.user.id}
                                                    className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors ${user.inactivo ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-green-100 text-green-800 hover:bg-green-200'} ${user.id === auth.user.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                >
                                                    {user.inactivo ? 'Inactivo' : 'Activo'}
                                                </button>
                                            </td>
                                            <td className="truncate px-4 py-3 sm:px-6 sm:py-4">
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
        
            <Dialog open={showCreateModal} onOpenChange={(open) => !open && closeCreateModal()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo Usuario</DialogTitle>
                        <DialogDescription>
                            Crea un nuevo usuario en el sistema. El usuario deberá cambiar su contraseña al iniciar sesión por primera vez desde la App o Web según su rol.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nombre Completo</Label>
                            <Input
                                id="name"
                                value={createForm.data.name}
                                onChange={(e) => createForm.setData('name', e.target.value)}
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
                                    onChange={(e) => createForm.setData('dni', e.target.value)}
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
                                    onChange={(e) => createForm.setData('role', e.target.value)}
                                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
                                >
                                    {roles.map(r => (
                                        <option key={r.value} value={r.value} className="text-foreground bg-background">
                                            {r.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={createForm.errors.role} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="password">Contraseña Provisional</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={createForm.data.password}
                                    onChange={(e) => createForm.setData('password', e.target.value)}
                                    required
                                />
                                <InputError message={createForm.errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">Confirmar Contraseña</Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    value={createForm.data.password_confirmation}
                                    onChange={(e) => createForm.setData('password_confirmation', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeCreateModal}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={createForm.processing}>
                                {createForm.processing ? 'Creando...' : 'Crear Usuario'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Confirmar Toggle de Estado */}
            <Dialog open={!!userToToggle} onOpenChange={(open) => !open && setUserToToggle(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Cambio de Estado</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de que deseas {userToToggle?.inactivo ? 'activar' : 'desactivar'} al usuario <strong>{userToToggle?.name}</strong>?
                            {!userToToggle?.inactivo && (
                                <span className="block mt-2 text-red-600 dark:text-red-400 font-semibold">
                                    Nota: Al desactivar al usuario, se cerrarán sus asignaciones activas de vehículos y se desvinculará de cualquier placa asociada automáticamente.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUserToToggle(null)}>
                            Cancelar
                        </Button>
                        <Button variant={!userToToggle?.inactivo ? "destructive" : "default"} onClick={executeToggleStatus}>
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
