import { Head, router, usePage, useForm } from '@inertiajs/react';
import { useMemo, useState, useEffect } from 'react';
import { Car, Check, Filter, Plus, Search, Camera } from 'lucide-react';
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
import { cn } from '@/lib/utils';

import { index as usersIndex, updateRole, store } from '@/routes/users';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
    empresa_id?: number | null;
    deposito?: string | null;
    deposito_moneda?: string | null;
    vehiculo?: { patente: string; marca: string; modelo: string } | null;
    licencia_por_vencer?: boolean;
    falta_foto?: boolean;
}

interface RoleOption {
    value: string;
    label: string;
}

interface Empresa {
    id: number;
    nombre: string;
}

interface MonedaOption {
    value: string;
    label: string;
    symbol: string;
}

interface Props {
    users: User[];
    roles: RoleOption[];
    empresas: Empresa[];
    monedas: MonedaOption[];
    choferCounts?: { activos: number; inactivos: number } | null;
}

function AvatarDropzone({
    file,
    currentUrl,
    onDrop,
}: {
    file: File | null;
    currentUrl?: string | null;
    onDrop: (files: File[]) => void;
}) {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
        },
        maxFiles: 1,
        multiple: false,
    });

    const previewUrl = useMemo(
        () => (file ? URL.createObjectURL(file) : currentUrl),
        [file, currentUrl],
    );

    return (
        <div
            {...getRootProps()}
            className={`group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 transition-colors ${isDragActive ? 'border-solid border-primary bg-primary/10' : 'border-dashed border-border bg-muted hover:border-primary/50'}`}
        >
            <input {...getInputProps()} />
            {previewUrl ? (
                <>
                    <img
                        src={previewUrl}
                        alt="Avatar"
                        className="h-full w-full bg-muted object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="h-6 w-6 text-white" />
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center text-muted-foreground outline-none">
                    <Camera className="mb-1 h-6 w-6 opacity-50 transition-opacity group-hover:opacity-100" />
                    <span className="text-[10px] font-medium uppercase opacity-70 group-hover:opacity-100">
                        Subir
                    </span>
                </div>
            )}
        </div>
    );
}

export default function UsersIndex({ users, roles, empresas, monedas, choferCounts }: Props) {
    const [userToToggle, setUserToToggle] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAlert, setFilterAlert] = useState<'all' | 'licencia_por_vencer' | 'falta_foto'>('all');
    const [previewImage, setPreviewImage] = useState<{
        url: string;
        name: string;
    } | null>(null);

    const urlParams = new URLSearchParams(window.location.search);
    const filterRole = urlParams.get('role');
    const filterStatus = urlParams.get('status');

    const filteredUsers = useMemo(() => {
        let result = users;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter(
                (u) => u.name.toLowerCase().includes(q) || u.dni.toLowerCase().includes(q),
            );
        }
        if (filterRole === 'chofer' && filterAlert !== 'all') {
            result = result.filter((u) => {
                if (filterAlert === 'licencia_por_vencer') return u.licencia_por_vencer === true;
                if (filterAlert === 'falta_foto') return u.falta_foto === true;
                return true;
            });
        }
        return result;
    }, [users, searchTerm, filterAlert, filterRole]);

    const alertCounts = useMemo(() => {
        if (filterRole !== 'chofer') return { licencia_por_vencer: 0, falta_foto: 0 };
        return {
            licencia_por_vencer: users.filter((u) => u.licencia_por_vencer).length,
            falta_foto: users.filter((u) => u.falta_foto).length,
        };
    }, [users, filterRole]);

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
        role: 'chofer',
        correo: '',
        telefono: '+54 ',
        fecha_vencimiento_licencia: '',
        profile_photo: null as File | null,
        empresa_id: '' as string,
        deposito: '' as string,
        deposito_moneda: 'USD' as string,
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
        empresa_id: '' as string,
        deposito: '' as string,
        deposito_moneda: 'USD' as string,
    });

    function openEditModal(user: User) {
        setUserToEdit(user);

        let formattedDate = '';

        if (user.fecha_vencimiento_licencia) {
            formattedDate = user.fecha_vencimiento_licencia
                .split('T')[0]
                .split(' ')[0];
        }

        editForm.setData({
            _method: 'put',
            name: user.name,
            dni: user.dni,
            correo: user.correo || '',
            telefono: user.telefono || '+54 ',
            fecha_vencimiento_licencia: formattedDate,
            profile_photo: null,
            empresa_id: user.empresa_id ? String(user.empresa_id) : '',
            deposito: user.deposito ?? '',
            deposito_moneda: user.deposito_moneda || 'USD',
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

    function formatDeposito(user: User) {
        if (!user.deposito) return null;
        const m = monedas.find((x) => x.value === user.deposito_moneda);
        const symbol = m?.symbol ?? '$';
        return `${symbol} ${Number(user.deposito).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function parseLicenciaDate(fechaStr: string): Date {
        const datePart = fechaStr.split('T')[0].split(' ')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    function formatLicenciaFecha(fechaStr: string): string {
        return parseLicenciaDate(fechaStr).toLocaleDateString('es-AR', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
    }

    function getLicenciaStatus(fechaStr: string | null | undefined) {
        if (!fechaStr) return null;
        const fecha = parseLicenciaDate(fechaStr);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diff = Math.floor((fecha.getTime() - today.getTime()) / 86400000);
        if (diff < 0) return { label: 'Vencida', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
        if (diff <= 30) return { label: 'Por vencer', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
        return { label: 'Vigente', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    }

    const { auth } = usePage<any>().props;
    const isInversor = auth.user.role === 'inversor';
    // El operador trabaja en una sola empresa por vez (sesión); ocultamos la columna.
    const hideEmpresa = true;

    useEffect(() => {
        if (!filterRole || (filterRole === 'chofer' && !filterStatus)) {
            router.get(
                usersIndex.url(),
                { role: 'chofer', status: 'activos' },
                { preserveState: false, replace: true },
            );
        }
    }, []);
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
                {filterRole === 'chofer' ? (
                    <div className="flex flex-col gap-4">
                        {/* Page header */}
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Choferes</h1>
                                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-foreground">
                                        {(choferCounts?.activos ?? 0) + (choferCounts?.inactivos ?? 0)}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Gestión de conductores asignados a la flota
                                </p>
                            </div>
                            {!isInversor && (
                                <Button onClick={openCreateModal} className="shrink-0">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Nuevo chofer
                                </Button>
                            )}
                        </div>

                        {/* Filter bar */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative min-w-[180px] flex-1 max-w-xs">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Buscar por nombre o DNI..."
                                    className="bg-card pl-9 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => router.get(usersIndex.url(), { role: 'chofer', status: 'activos' }, { preserveState: false })}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                        filterStatus === 'activos'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    Activos
                                    <span className={cn(
                                        'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                                        filterStatus === 'activos'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-muted-foreground/20 text-muted-foreground',
                                    )}>
                                        {choferCounts?.activos ?? 0}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.get(usersIndex.url(), { role: 'chofer', status: 'inactivos' }, { preserveState: false })}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                        filterStatus === 'inactivos'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    Inactivos
                                    <span className={cn(
                                        'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                                        filterStatus === 'inactivos'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-muted-foreground/20 text-muted-foreground',
                                    )}>
                                        {choferCounts?.inactivos ?? 0}
                                    </span>
                                </button>
                            </div>

                            {filterStatus === 'activos' && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                                                filterAlert !== 'all'
                                                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            <Filter className="h-3.5 w-3.5" />
                                            Filtros
                                            {filterAlert !== 'all' && (
                                                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                                                    1
                                                </span>
                                            )}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-60 p-0">
                                        <div className="p-3">
                                            <p className="mb-2 px-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                                                Filtrar por
                                            </p>
                                            <div className="flex flex-col gap-0.5">
                                                {(
                                                    [
                                                        { val: 'all' as const, label: 'Todos los choferes', count: users.length, dot: null },
                                                        { val: 'licencia_por_vencer' as const, label: 'Licencia por vencer', count: alertCounts.licencia_por_vencer, dot: 'amber' },
                                                        { val: 'falta_foto' as const, label: 'Falta foto', count: alertCounts.falta_foto, dot: 'blue' },
                                                    ]
                                                ).map((item) => (
                                                    <button
                                                        key={item.val}
                                                        type="button"
                                                        onClick={() => setFilterAlert(item.val)}
                                                        className={cn(
                                                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                                                            filterAlert === item.val
                                                                ? 'bg-muted text-foreground'
                                                                : 'text-foreground hover:bg-muted/60',
                                                        )}
                                                    >
                                                        {item.dot ? (
                                                            <span className={cn(
                                                                'h-2 w-2 shrink-0 rounded-full',
                                                                item.dot === 'amber' ? 'bg-amber-500' : 'bg-blue-500',
                                                            )} />
                                                        ) : (
                                                            <span className="h-2 w-2 shrink-0" />
                                                        )}
                                                        <span className={cn('flex-1 text-left', filterAlert === item.val && 'font-semibold')}>
                                                            {item.label}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">{item.count}</span>
                                                        {filterAlert === item.val && (
                                                            <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="relative w-full lg:max-w-xs">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Buscar por nombre o DNI..."
                                    className="bg-card pl-9 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        {!isInversor && (
                            <div className="flex w-full sm:w-auto">
                                <Button className="w-full sm:w-auto" size="default" onClick={openCreateModal}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Nuevo Usuario
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                <div className="w-full self-start overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-sm text-muted-foreground">
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
                                    {filterRole === 'chofer' && (
                                        <th
                                            scope="col"
                                            className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                        >
                                            Depósito
                                        </th>
                                    )}
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        {filterRole === 'chofer' ? 'Vehículo' : 'Rol'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={filterRole === 'chofer' ? 7 : 6}
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
                                            onClick={() =>
                                                !isInversor &&
                                                openEditModal(user)
                                            }
                                            className={cn(
                                                'bg-card transition-colors',
                                                !isInversor &&
                                                    'cursor-pointer hover:bg-muted/40',
                                            )}
                                        >
                                            <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                <div className="flex items-center gap-3">
                                                    {user.profile_photo_url && (
                                                        <img
                                                            src={
                                                                user.profile_photo_url
                                                            }
                                                            alt={user.name}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPreviewImage(
                                                                    {
                                                                        url: user.profile_photo_url!,
                                                                        name: user.name,
                                                                    },
                                                                );
                                                            }}
                                                            className="h-8 w-8 shrink-0 cursor-zoom-in rounded-full border border-border bg-muted object-cover transition hover:opacity-80"
                                                        />
                                                    )}
                                                    <span
                                                        className="max-w-[150px] truncate font-semibold text-foreground"
                                                        title={user.name}
                                                    >
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
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-muted-foreground">
                                                            {formatLicenciaFecha(user.fecha_vencimiento_licencia)}
                                                        </span>
                                                        {(() => {
                                                            const s = getLicenciaStatus(user.fecha_vencimiento_licencia);
                                                            return s ? (
                                                                <span className={cn('inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', s.cls)}>
                                                                    {s.label}
                                                                </span>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isInversor) return;
                                                        confirmToggleStatus(user);
                                                    }}
                                                    disabled={user.id === auth.user.id || isInversor}
                                                    className={cn(
                                                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none',
                                                        user.inactivo
                                                            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                                            : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                                                        !isInversor && user.id !== auth.user.id
                                                            ? user.inactivo ? 'hover:bg-red-100 cursor-pointer' : 'hover:bg-green-100 cursor-pointer'
                                                            : 'cursor-default',
                                                    )}
                                                >
                                                    <span className={cn('h-1.5 w-1.5 rounded-full', user.inactivo ? 'bg-red-500' : 'bg-green-500')} />
                                                    {user.inactivo ? 'Inactivo' : 'Activo'}
                                                </button>
                                            </td>
                                            {filterRole === 'chofer' && (
                                                <td className="px-4 py-3 text-sm sm:px-6 sm:py-4">
                                                    {user.deposito ? (
                                                        <span className="font-medium text-foreground">
                                                            {formatDeposito(user)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/50 italic">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                {filterRole === 'chofer' ? (
                                                    <div className="flex flex-col gap-1">
                                                        {user.vehiculo ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Car className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                                <span className="font-mono text-xs font-bold text-foreground">{user.vehiculo.patente}</span>
                                                                <span className="truncate text-xs text-muted-foreground">{user.vehiculo.marca} {user.vehiculo.modelo}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground/50 italic">Sin vehículo</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1.5">
                                                        {user.id === auth.user.id ? (
                                                            <span className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
                                                                {roles.find((r) => r.value === user.role)?.label || user.role}{' '}(Tú)
                                                            </span>
                                                        ) : isInversor ? (
                                                            <span className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
                                                                {roles.find((r) => r.value === user.role)?.label || user.role}
                                                            </span>
                                                        ) : (
                                                            <select
                                                                onClick={(e) => e.stopPropagation()}
                                                                value={user.role}
                                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                                className="block w-full max-w-xs rounded-md border-input bg-background px-3 py-1.5 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {roles.map((role) => (
                                                                    <option key={role.value} value={role.value}>{role.label}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <ul className="divide-y divide-border md:hidden">
                        {filteredUsers.length === 0 ? (
                            <li className="px-4 py-12 text-center text-sm text-muted-foreground">
                                No se encontraron usuarios que coincidan con la
                                búsqueda.
                            </li>
                        ) : (
                            filteredUsers.map((user) => (
                                <li
                                    key={user.id}
                                    role={isInversor ? undefined : 'button'}
                                    tabIndex={isInversor ? -1 : 0}
                                    onClick={() =>
                                        !isInversor && openEditModal(user)
                                    }
                                    onKeyDown={(e) => {
                                        if (isInversor) return;
                                        if (
                                            e.key === 'Enter' ||
                                            e.key === ' '
                                        ) {
                                            e.preventDefault();
                                            openEditModal(user);
                                        }
                                    }}
                                    className={cn(
                                        'flex flex-col gap-3 p-4 transition-colors focus:outline-none',
                                        !isInversor &&
                                            'cursor-pointer hover:bg-muted/40 focus:bg-muted/40',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            {user.profile_photo_url && (
                                                <img
                                                    src={user.profile_photo_url}
                                                    alt={user.name}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewImage({
                                                            url: user.profile_photo_url!,
                                                            name: user.name,
                                                        });
                                                    }}
                                                    className="h-10 w-10 shrink-0 cursor-zoom-in rounded-full border border-border bg-muted object-cover transition hover:opacity-80"
                                                />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p
                                                    className="truncate font-semibold text-foreground"
                                                    title={user.name}
                                                >
                                                    {user.name}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {roles.find(
                                                        (r) =>
                                                            r.value ===
                                                            user.role,
                                                    )?.label || user.role}
                                                    {user.id === auth.user.id
                                                        ? ' (Tú)'
                                                        : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isInversor) return;
                                                confirmToggleStatus(user);
                                            }}
                                            disabled={user.id === auth.user.id || isInversor}
                                            className={cn(
                                                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none',
                                                user.inactivo
                                                    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                                    : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                                                !isInversor && user.id !== auth.user.id
                                                    ? user.inactivo ? 'hover:bg-red-100 cursor-pointer' : 'hover:bg-green-100 cursor-pointer'
                                                    : 'cursor-default',
                                            )}
                                        >
                                            <span className={cn('h-1.5 w-1.5 rounded-full', user.inactivo ? 'bg-red-500' : 'bg-green-500')} />
                                            {user.inactivo ? 'Inactivo' : 'Activo'}
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-0.5 text-xs">
                                        {user.correo ? (
                                            <span
                                                className="truncate"
                                                title={user.correo}
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
                                                className="truncate"
                                                title={user.telefono}
                                            >
                                                {user.telefono}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground/50 italic">
                                                Sin teléfono
                                            </span>
                                        )}
                                    </div>

                                    <div className={cn('grid gap-3 text-xs', filterRole === 'chofer' ? 'grid-cols-3' : 'grid-cols-2')}>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="tracking-wider text-muted-foreground uppercase">
                                                DNI
                                            </span>
                                            <span className="font-medium text-foreground">
                                                {user.dni}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="tracking-wider text-muted-foreground uppercase">
                                                Licencia
                                            </span>
                                            {user.fecha_vencimiento_licencia ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-foreground">
                                                        {formatLicenciaFecha(user.fecha_vencimiento_licencia)}
                                                    </span>
                                                    {(() => {
                                                        const s = getLicenciaStatus(user.fecha_vencimiento_licencia);
                                                        return s ? (
                                                            <span className={cn('inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', s.cls)}>
                                                                {s.label}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground/50 italic">N/A</span>
                                            )}
                                        </div>
                                        {filterRole === 'chofer' && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="tracking-wider text-muted-foreground uppercase">
                                                    Depósito
                                                </span>
                                                {user.deposito ? (
                                                    <span className="font-medium text-foreground">
                                                        {formatDeposito(user)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic">
                                                        —
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {filterRole === 'chofer' && (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">Vehículo</span>
                                            {user.vehiculo ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Car className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    <span className="font-mono text-sm font-bold text-foreground">{user.vehiculo.patente}</span>
                                                    <span className="text-xs text-muted-foreground">{user.vehiculo.marca} {user.vehiculo.modelo}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/50 italic">Sin vehículo</span>
                                            )}
                                        </div>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
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

                        <div className="mb-2 flex flex-col items-center gap-2">
                            <Label>Foto de Perfil (Opcional)</Label>
                            <AvatarDropzone
                                file={createForm.data.profile_photo}
                                onDrop={(files) =>
                                    createForm.setData(
                                        'profile_photo',
                                        files[0],
                                    )
                                }
                            />
                            <InputError
                                message={createForm.errors.profile_photo}
                            />
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

                        {createForm.data.role === 'inversor' &&
                            !hideEmpresa && (
                                <div className="grid gap-2">
                                    <Label htmlFor="empresa_id">Empresa</Label>
                                    <select
                                        id="empresa_id"
                                        value={createForm.data.empresa_id}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'empresa_id',
                                                e.target.value,
                                            )
                                        }
                                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option
                                            value=""
                                            className="bg-background text-foreground"
                                        >
                                            Sin empresa
                                        </option>
                                        {empresas.map((e) => (
                                            <option
                                                key={e.id}
                                                value={e.id}
                                                className="bg-background text-foreground"
                                            >
                                                {e.nombre}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError
                                        message={createForm.errors.empresa_id}
                                    />
                                </div>
                            )}

                        {createForm.data.role === 'chofer' && (
                            <div className="grid gap-2">
                                <Label htmlFor="correo">Correo</Label>
                                <Input
                                    id="correo"
                                    type="email"
                                    value={createForm.data.correo}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'correo',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="usuario@correo.com"
                                />
                                <InputError
                                    message={createForm.errors.correo}
                                />
                            </div>
                        )}

                        {createForm.data.role === 'chofer' && (
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
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="deposito">
                                    Depósito (Garantía)
                                </Label>
                                <Input
                                    id="deposito"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={createForm.data.deposito}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'deposito',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="0.00"
                                />
                                <InputError
                                    message={createForm.errors.deposito}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="deposito_moneda">Moneda</Label>
                                <select
                                    id="deposito_moneda"
                                    value={createForm.data.deposito_moneda}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'deposito_moneda',
                                            e.target.value,
                                        )
                                    }
                                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {monedas.map((m) => (
                                        <option
                                            key={m.value}
                                            value={m.value}
                                            className="bg-background text-foreground"
                                        >
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    message={createForm.errors.deposito_moneda}
                                />
                            </div>
                        </div>

                        <div className="rounded-lg border border-border bg-muted/50 p-3">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                <span className="font-semibold text-foreground">
                                    Contraseña Automática:
                                </span>{' '}
                                La contraseña provisional se generará combinando
                                la{' '}
                                <span className="font-medium text-foreground text-red-600">
                                    primera letra del nombre (Mayúscula)
                                </span>{' '}
                                seguido del{' '}
                                <span className="font-medium text-foreground text-red-600">
                                    DNI
                                </span>{' '}
                                sin puntos.
                            </p>
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
                        <div className="mb-2 flex flex-col items-center gap-2">
                            <Label>Foto Actual</Label>
                            <AvatarDropzone
                                file={editForm.data.profile_photo}
                                currentUrl={userToEdit?.profile_photo_url}
                                onDrop={(files) =>
                                    editForm.setData('profile_photo', files[0])
                                }
                            />
                            <InputError
                                message={editForm.errors.profile_photo}
                            />
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

                        {userToEdit?.role === 'inversor' && !hideEmpresa && (
                            <div className="grid gap-2">
                                <Label htmlFor="edit-empresa_id">Empresa</Label>
                                <select
                                    id="edit-empresa_id"
                                    value={editForm.data.empresa_id}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'empresa_id',
                                            e.target.value,
                                        )
                                    }
                                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option
                                        value=""
                                        className="bg-background text-foreground"
                                    >
                                        Sin empresa
                                    </option>
                                    {empresas.map((e) => (
                                        <option
                                            key={e.id}
                                            value={e.id}
                                            className="bg-background text-foreground"
                                        >
                                            {e.nombre}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    message={editForm.errors.empresa_id}
                                />
                            </div>
                        )}

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
                                <InputError
                                    message={editForm.errors.telefono}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="edit-fecha_vencimiento_licencia">
                                    Vencimiento Licencia
                                </Label>
                                <Input
                                    id="edit-fecha_vencimiento_licencia"
                                    type="date"
                                    value={
                                        editForm.data.fecha_vencimiento_licencia
                                    }
                                    onChange={(e) =>
                                        editForm.setData(
                                            'fecha_vencimiento_licencia',
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={
                                        editForm.errors
                                            .fecha_vencimiento_licencia
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-deposito">
                                    Depósito (Garantía)
                                </Label>
                                <Input
                                    id="edit-deposito"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editForm.data.deposito}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'deposito',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="0.00"
                                />
                                <InputError
                                    message={editForm.errors.deposito}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="edit-deposito_moneda">
                                    Moneda
                                </Label>
                                <select
                                    id="edit-deposito_moneda"
                                    value={editForm.data.deposito_moneda}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'deposito_moneda',
                                            e.target.value,
                                        )
                                    }
                                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {monedas.map((m) => (
                                        <option
                                            key={m.value}
                                            value={m.value}
                                            className="bg-background text-foreground"
                                        >
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    message={editForm.errors.deposito_moneda}
                                />
                            </div>
                        </div>

                        <DialogFooter className="sm:justify-between">
                            {userToEdit && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() =>
                                        router.get(
                                            `/users/${userToEdit.id}/asignaciones`,
                                        )
                                    }
                                    className="mb-2 sm:mb-0"
                                >
                                    Ver Asignaciones
                                </Button>
                            )}
                            <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
                                    {editForm.processing
                                        ? 'Guardando...'
                                        : 'Guardar Cambios'}
                                </Button>
                            </div>
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

            <Dialog
                open={!!previewImage}
                onOpenChange={(open) => !open && setPreviewImage(null)}
            >
                <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
                    <DialogHeader className="sr-only">
                        <DialogTitle>
                            {previewImage?.name ?? 'Imagen'}
                        </DialogTitle>
                    </DialogHeader>
                    {previewImage && (
                        <img
                            src={previewImage.url}
                            alt={previewImage.name}
                            className="max-h-[85vh] w-full rounded-lg object-contain"
                        />
                    )}
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
