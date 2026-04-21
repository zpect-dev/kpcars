import { Head, router, usePage, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Plus, Search, Camera } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
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
    profile_photo_url?: string | null;
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

function AvatarDropzone({ file, currentUrl, onDrop }: { file: File | null, currentUrl?: string | null, onDrop: (files: File[]) => void }) {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
        },
        maxFiles: 1,
        multiple: false
    });

    const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : currentUrl, [file, currentUrl]);

    return (
        <div 
            {...getRootProps()} 
            className={`group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 transition-colors ${isDragActive ? 'border-primary bg-primary/10 border-solid' : 'border-dashed border-border bg-muted hover:border-primary/50'}`}
        >
            <input {...getInputProps()} />
            {previewUrl ? (
                <>
                    <img src={previewUrl} alt="Avatar" className="h-full w-full object-cover bg-muted" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="h-6 w-6 text-white" />
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center text-muted-foreground outline-none">
                    <Camera className="h-6 w-6 mb-1 opacity-50 transition-opacity group-hover:opacity-100" />
                    <span className="text-[10px] font-medium uppercase opacity-70 group-hover:opacity-100">Subir</span>
                </div>
            )}
        </div>
    );
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
        telefono: '+54 ',
        fecha_vencimiento_licencia: '',
        profile_photo: null as File | null,
    });

    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const editForm = useForm({
        _method: 'put',
        name: '',
        dni: '',
        correo: '',
        telefono: '',
        fecha_vencimiento_licencia: '',
        profile_photo: null as File | null,
    });

    function openEditModal(user: User) {
        setUserToEdit(user);
        
        let formattedDate = '';
        if (user.fecha_vencimiento_licencia) {
            formattedDate = user.fecha_vencimiento_licencia.split('T')[0].split(' ')[0];
        }

        editForm.setData({
            _method: 'put',
            name: user.name,
            dni: user.dni,
            correo: user.correo || '',
            telefono: user.telefono || '+54 ',
            fecha_vencimiento_licencia: formattedDate,
            profile_photo: null,
        });
        editForm.clearErrors();
    }

    function closeEditModal() {
        setUserToEdit(null);
        editForm.reset();
    }

    function handleEditSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!userToEdit) return;
        
        editForm.post(`/users/${userToEdit.id}`, {
            onSuccess: () => closeEditModal(),
            preserveScroll: true,
        });
    }

    function openCreateModal() {
        createForm.reset();
        createForm.setData('telefono', '+54 ');
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

    function formatPhone(value: string) {
        // Eliminar todo lo que no sea número
        const digits = value.replace(/\D/g, '');
        
        // Si no tiene el 54 al inicio, intentamos agregarlo o mantenerlo simple
        // Pero basándonos en tu requerimiento: +54 9 11 2585-9685
        if (digits.length <= 2) return '+54 ';
        
        let formatted = '+54 ';
        const rest = digits.slice(2); // Lo que viene después del 54
        
        if (rest.length > 0) {
            // El 9 (móvil)
            formatted += rest.slice(0, 1);
            if (rest.length > 1) {
                // Espacio y el 11 (área)
                formatted += ' ' + rest.slice(1, 3);
                if (rest.length > 3) {
                    // Espacio y los primeros 4 del número
                    formatted += ' ' + rest.slice(3, 7);
                    if (rest.length > 7) {
                        // Guion y los últimos 4
                        formatted += '-' + rest.slice(7, 11);
                    }
                }
            }
        }
        return formatted;
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
                                            onClick={() => openEditModal(user)}
                                            className="bg-card transition-colors hover:bg-muted/40 cursor-pointer"
                                        >
                                            <td
                                                className="px-4 py-3 sm:px-6 sm:py-4"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {user.profile_photo_url && (
                                                        <img 
                                                            src={user.profile_photo_url} 
                                                            alt={user.name} 
                                                            className="h-8 w-8 rounded-full border border-border object-cover shrink-0 bg-muted"
                                                        />
                                                    )}
                                                    <span className="truncate font-semibold text-foreground truncate max-w-[150px]" title={user.name}>
                                                        {user.name}
                                                    </span>
                                                </div>
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
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        confirmToggleStatus(user);
                                                    }}
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
                                                        onClick={(e) => e.stopPropagation()}
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

                        <div className="flex flex-col items-center gap-2 mb-2">
                            <Label>Foto de Perfil (Opcional)</Label>
                            <AvatarDropzone 
                                file={createForm.data.profile_photo} 
                                onDrop={(files) => createForm.setData('profile_photo', files[0])} 
                            />
                            <InputError message={createForm.errors.profile_photo} />
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
                                            formatPhone(e.target.value),
                                        )
                                    }
                                    placeholder="+54 9 11 1234-5678"
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

            <Dialog
                open={!!userToEdit}
                onOpenChange={(open) => !open && closeEditModal()}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Datos Personales</DialogTitle>
                        <DialogDescription>
                            Modifica los datos personales de {userToEdit?.name}.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleEditSubmit} className="grid gap-4">
                        <div className="flex flex-col items-center gap-2 mb-2">
                            <Label>Foto Actual</Label>
                            <AvatarDropzone 
                                file={editForm.data.profile_photo} 
                                currentUrl={userToEdit?.profile_photo_url}
                                onDrop={(files) => editForm.setData('profile_photo', files[0])} 
                            />
                            <InputError message={editForm.errors.profile_photo} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Nombre Completo</Label>
                            <Input
                                id="edit-name"
                                value={editForm.data.name}
                                onChange={(e) =>
                                    editForm.setData('name', e.target.value)
                                }
                                placeholder="Ej. Juan Pérez"
                                required
                            />
                            <InputError message={editForm.errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="edit-dni">DNI</Label>
                            <Input
                                id="edit-dni"
                                value={editForm.data.dni}
                                onChange={(e) =>
                                    editForm.setData('dni', e.target.value)
                                }
                                placeholder="Sin puntos"
                                required
                            />
                            <InputError message={editForm.errors.dni} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="edit-correo">Correo</Label>
                            <Input
                                id="edit-correo"
                                type="email"
                                value={editForm.data.correo}
                                onChange={(e) =>
                                    editForm.setData('correo', e.target.value)
                                }
                                placeholder="usuario@correo.com"
                            />
                            <InputError message={editForm.errors.correo} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-telefono">Teléfono</Label>
                                <Input
                                    id="edit-telefono"
                                    value={editForm.data.telefono}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'telefono',
                                            formatPhone(e.target.value),
                                        )
                                    }
                                    placeholder="+54 9 11 1234-5678"
                                />
                                <InputError message={editForm.errors.telefono} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="edit-fecha_vencimiento_licencia">
                                    Vencimiento Licencia
                                </Label>
                                <Input
                                    id="edit-fecha_vencimiento_licencia"
                                    type="date"
                                    value={editForm.data.fecha_vencimiento_licencia}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'fecha_vencimiento_licencia',
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={editForm.errors.fecha_vencimiento_licencia}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeEditModal}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={editForm.processing}
                            >
                                {editForm.processing ? 'Guardando...' : 'Guardar Cambios'}
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
