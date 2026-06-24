import { Head, router, usePage, useForm } from '@inertiajs/react';
import { useMemo, useState, useEffect } from 'react';
import { Check, ChevronDown, Filter, Plus, Search, Camera, UserPlus, UserCog } from 'lucide-react';
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
import { DocumentSection, DocPreviewDialog, type DocUrls, type DocMode } from '@/components/documentos';

interface User {
    id: number;
    name: string;
    dni: string;
    role: string;
    inactivo: boolean;
    estado_actualizado_en?: string | null;
    created_at?: string | null;
    correo?: string | null;
    telefono?: string | null;
    fecha_vencimiento_licencia?: string | null;
    profile_photo_url?: string | null;
    empresa_default_id?: number | null;
    empresa_restringida_id?: number | null;
    empresas?: { id: number; nombre: string }[];
    deposito?: string | null;
    deposito_moneda?: string | null;
    documentos?: {
        licencia: DocUrls;
        dni: DocUrls;
    };
    vehiculo?: { patente: string; marca: string; modelo: string; precio?: number } | null;
    licencia_por_vencer?: boolean;
    sin_licencia?: boolean;
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

type FilterAlertValue = 'all' | 'licencia_vencida' | 'licencia_por_vencer' | 'sin_licencia' | 'falta_foto' | 'falta_telefono' | 'falta_correo' | 'falta_deposito' | 'deposito_bajo';

const FILTER_SHORT_LABELS: Record<FilterAlertValue, string> = {
    all:                  'Todos',
    licencia_vencida:     'Lic. vencida',
    licencia_por_vencer:  'Lic. por vencer',
    sin_licencia:         'Sin licencia',
    falta_foto:           'Sin foto',
    falta_telefono:       'Sin teléfono',
    falta_correo:         'Sin correo',
    falta_deposito:       'Sin depósito',
    deposito_bajo:        'Depósito bajo',
};

const FILTER_SECTIONS: { label: string; items: { val: FilterAlertValue; label: string; desc: string }[] }[] = [
    {
        label: 'Licencia',
        items: [
            { val: 'licencia_vencida',     label: 'Vencida',           desc: 'La licencia ya está vencida' },
            { val: 'licencia_por_vencer',  label: 'Próxima a vencer',  desc: 'Vence en los próximos 30 días' },
            { val: 'sin_licencia',         label: 'Sin fecha cargada', desc: 'No tiene vencimiento registrado' },
        ],
    },
    {
        label: 'Contacto',
        items: [
            { val: 'falta_foto',     label: 'Sin foto de perfil', desc: 'Sin imagen de identificación' },
            { val: 'falta_telefono', label: 'Sin teléfono',       desc: 'Sin número de contacto' },
            { val: 'falta_correo',   label: 'Sin correo',         desc: 'Sin dirección de email' },
        ],
    },
    {
        label: 'Garantía',
        items: [
            { val: 'falta_deposito', label: 'Sin depósito',  desc: 'Sin garantía registrada' },
            { val: 'deposito_bajo',  label: 'Depósito bajo', desc: 'ARS inferior a 1.5× el valor semanal del vehículo' },
        ],
    },
];

function FilterPopoverItem({
    label,
    desc,
    count,
    isActive,
    onClick,
}: {
    label: string;
    desc?: string;
    count: number;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                isActive ? 'bg-muted' : 'hover:bg-muted/60',
            )}
        >
            <div className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                isActive ? 'border-foreground bg-foreground' : 'border-border bg-transparent',
            )}>
                {isActive && <Check className="h-3 w-3 text-background" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className={cn('text-sm leading-tight', isActive ? 'font-semibold text-foreground' : 'text-foreground')}>
                    {label}
                </span>
                {desc && (
                    <span className="text-xs text-muted-foreground leading-tight mt-0.5">{desc}</span>
                )}
            </div>
            <span className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                isActive ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground',
            )}>
                {count}
            </span>
        </button>
    );
}

export default function UsersIndex({ users, roles, empresas, monedas, choferCounts }: Props) {
    const [userToToggle, setUserToToggle] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAlert, setFilterAlert] = useState<FilterAlertValue>('all');
    const [openFilterSections, setOpenFilterSections] = useState<Record<string, boolean>>({});
    const [previewImage, setPreviewImage] = useState<{
        url: string;
        name: string;
        type?: 'image' | 'pdf';
    } | null>(null);

    const urlParams = new URLSearchParams(window.location.search);
    const filterRole = urlParams.get('role');
    const filterStatus = urlParams.get('status');

    const filteredUsers = useMemo(() => {
        let result = users;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter(
                (u) =>
                    u.name.toLowerCase().includes(q) ||
                    u.dni.toLowerCase().includes(q) ||
                    (u.vehiculo?.patente?.toLowerCase().includes(q) ?? false),
            );
        }
        if (filterRole === 'chofer' && filterAlert !== 'all') {
            result = result.filter((u) => {
                if (filterAlert === 'licencia_vencida') {
                    if (!u.fecha_vencimiento_licencia) return false;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    return parseLicenciaDate(u.fecha_vencimiento_licencia) < today;
                }
                if (filterAlert === 'licencia_por_vencer') return u.licencia_por_vencer === true;
                if (filterAlert === 'sin_licencia') return u.sin_licencia === true;
                if (filterAlert === 'falta_foto') return u.falta_foto === true;
                if (filterAlert === 'falta_telefono') return !u.telefono;
                if (filterAlert === 'falta_correo') return !u.correo;
                if (filterAlert === 'falta_deposito') return !u.deposito;
                if (filterAlert === 'deposito_bajo') {
                    if (!u.vehiculo?.precio) return false;
                    if (!u.deposito) return true;
                    if (u.deposito_moneda === 'USD') return false;
                    return Number(u.deposito) < 1.5 * u.vehiculo.precio;
                }
                return true;
            });
        }
        return result;
    }, [users, searchTerm, filterAlert, filterRole]);

    const alertCounts = useMemo(() => {
        if (filterRole !== 'chofer') return { licencia_vencida: 0, licencia_por_vencer: 0, sin_licencia: 0, falta_foto: 0, falta_telefono: 0, falta_correo: 0, falta_deposito: 0, deposito_bajo: 0 };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return {
            licencia_vencida: users.filter((u) => {
                if (!u.fecha_vencimiento_licencia) return false;
                return parseLicenciaDate(u.fecha_vencimiento_licencia) < today;
            }).length,
            licencia_por_vencer: users.filter((u) => u.licencia_por_vencer).length,
            sin_licencia: users.filter((u) => u.sin_licencia).length,
            falta_foto: users.filter((u) => u.falta_foto).length,
            falta_telefono: users.filter((u) => !u.telefono).length,
            falta_correo: users.filter((u) => !u.correo).length,
            falta_deposito: users.filter((u) => !u.deposito).length,
            deposito_bajo: users.filter((u) => {
                if (!u.vehiculo?.precio) return false;
                if (!u.deposito) return true;
                if (u.deposito_moneda === 'USD') return false;
                return Number(u.deposito) < 1.5 * u.vehiculo.precio;
            }).length,
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
        empresas: [] as number[],
        empresa_restringida_id: '' as string,
        deposito: '' as string,
        deposito_moneda: 'USD' as string,
        licencia_pdf: null as File | null,
        licencia_frente: null as File | null,
        licencia_dorso: null as File | null,
        dni_pdf: null as File | null,
        dni_frente: null as File | null,
        dni_dorso: null as File | null,
    });
    const [createLicMode, setCreateLicMode] = useState<DocMode>('imagenes');
    const [createDniMode, setCreateDniMode] = useState<DocMode>('imagenes');

    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const editForm = useForm({
        _method: 'put',
        name: '',
        dni: '',
        correo: '',
        telefono: '',
        fecha_vencimiento_licencia: '',
        profile_photo: null as File | null,
        empresas: [] as number[],
        empresa_restringida_id: '' as string,
        deposito: '' as string,
        deposito_moneda: 'USD' as string,
        licencia_pdf: null as File | null,
        licencia_frente: null as File | null,
        licencia_dorso: null as File | null,
        dni_pdf: null as File | null,
        dni_frente: null as File | null,
        dni_dorso: null as File | null,
    });
    const [editLicMode, setEditLicMode] = useState<DocMode>('imagenes');
    const [editDniMode, setEditDniMode] = useState<DocMode>('imagenes');

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
            empresas: (user.empresas ?? []).map((e) => e.id),
            empresa_restringida_id: user.empresa_restringida_id ? String(user.empresa_restringida_id) : '',
            deposito: user.deposito ?? '',
            deposito_moneda: user.deposito_moneda || 'USD',
            licencia_pdf: null,
            licencia_frente: null,
            licencia_dorso: null,
            dni_pdf: null,
            dni_frente: null,
            dni_dorso: null,
        });
        // El modo arranca según lo ya cargado: PDF si hay PDF, si no imágenes.
        setEditLicMode(user.documentos?.licencia.pdf ? 'pdf' : 'imagenes');
        setEditDniMode(user.documentos?.dni.pdf ? 'pdf' : 'imagenes');
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
        setCreateLicMode('imagenes');
        setCreateDniMode('imagenes');
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

    // Cambia la modalidad de un documento y limpia los archivos de la otra
    // modalidad, para que nunca se envíe PDF e imágenes juntos.
    function applyDocMode(
        form: any,
        tipo: 'licencia' | 'dni',
        setMode: (m: DocMode) => void,
        mode: DocMode,
    ) {
        setMode(mode);
        if (mode === 'pdf') {
            form.setData(`${tipo}_frente`, null);
            form.setData(`${tipo}_dorso`, null);
        } else {
            form.setData(`${tipo}_pdf`, null);
        }
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
        const currency = user.deposito_moneda ?? 'ARS';
        const amount = Number(user.deposito).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        return `${currency} ${amount}`;
    }

    // Fecha a mostrar en la columna Alta/Baja:
    // - Inactivo (baja): el momento real en que se desactivó.
    // - Activo (alta): el momento en que se (re)activó; si nunca pasó por el
    //   toggle, su alta es la fecha de creación del chofer.
    function estadoFecha(user: User): string | null {
        if (user.inactivo) return user.estado_actualizado_en ?? null;
        return user.estado_actualizado_en ?? user.created_at ?? null;
    }

    function formatEstadoFecha(fechaStr?: string | null): string | null {
        if (!fechaStr) return null;
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) return null;
        return fecha.toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
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
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-lg font-semibold text-foreground sm:text-xl">Choferes</h1>
                                    <span className="inline-flex items-center rounded-full border border-border/50 bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                        {choferCounts?.activos ?? 0} activos
                                    </span>
                                </div>
                            </div>
                            {!isInversor && (
                                <Button size="sm" onClick={openCreateModal} className="shrink-0">
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Nuevo chofer</span>
                                </Button>
                            )}
                        </div>

                        {/* Filter bar */}
                        <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                            <div className="flex flex-wrap items-end gap-3">

                                {/* Buscar */}
                                <div className="flex w-full flex-col gap-2 lg:min-w-[240px] lg:flex-1">
                                    <Label htmlFor="chofer-search">Buscar</Label>
                                    <div className="relative">
                                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="chofer-search"
                                            type="text"
                                            placeholder="Buscar por nombre, DNI o patente..."
                                            className="pl-9"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Estado */}
                                <div className="flex w-full flex-col gap-2 lg:w-auto">
                                    <Label>Estado</Label>
                                    <div className="flex h-9 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => router.get(usersIndex.url(), { role: 'chofer', status: 'activos' }, { preserveState: false })}
                                            className={cn(
                                                'flex h-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                                                filterStatus === 'activos'
                                                    ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            <span className="font-bold tabular-nums">{choferCounts?.activos ?? 0}</span>
                                            activos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => router.get(usersIndex.url(), { role: 'chofer', status: 'inactivos' }, { preserveState: false })}
                                            className={cn(
                                                'flex h-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                                                filterStatus === 'inactivos'
                                                    ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            <span className="font-bold tabular-nums">{choferCounts?.inactivos ?? 0}</span>
                                            inactivos
                                        </button>
                                    </div>
                                </div>

                                {/* Filtrar */}
                                <div className="flex w-full items-end gap-2 lg:w-auto">
                                    <div className="flex flex-col gap-2">
                                        <Label className="invisible hidden lg:block">Más</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'inline-flex items-center gap-2 rounded-lg border px-3 py-[9px] text-sm font-medium transition-all',
                                                        filterAlert !== 'all'
                                                            ? 'border-border bg-muted text-foreground shadow-sm'
                                                            : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                                                    )}
                                                >
                                                    <Filter className="h-4 w-4 shrink-0" />
                                                    <span className="hidden sm:inline">
                                                        {filterAlert !== 'all' ? FILTER_SHORT_LABELS[filterAlert] : 'Filtrar'}
                                                    </span>
                                                    {filterAlert !== 'all' && (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                                                    )}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent align="end" className="w-72 p-0 shadow-lg">
                                                <div className="p-1.5 border-b border-border">
                                                    <FilterPopoverItem
                                                        label="Todos los choferes"
                                                        count={users.length}
                                                        isActive={filterAlert === 'all'}
                                                        onClick={() => setFilterAlert('all')}
                                                    />
                                                </div>
                                                {FILTER_SECTIONS.map((section, i) => {
                                                    const isOpen = openFilterSections[section.label] ?? false;
                                                    const hasActive = section.items.some((it) => filterAlert === it.val);
                                                    const isLast = i === FILTER_SECTIONS.length - 1;
                                                    return (
                                                        <div key={section.label} className={!isLast ? 'border-b border-border' : ''}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenFilterSections((s) => ({ ...s, [section.label]: !s[section.label] }))}
                                                                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-medium text-foreground">{section.label}</span>
                                                                    {hasActive && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                                                                </div>
                                                                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                                                            </button>
                                                            {isOpen && (
                                                                <div className="px-1.5 pb-1.5">
                                                                    {section.items.map(({ val, label, desc }) => (
                                                                        <FilterPopoverItem
                                                                            key={val}
                                                                            label={label}
                                                                            desc={desc}
                                                                            count={alertCounts[val as keyof typeof alertCounts]}
                                                                            isActive={filterAlert === val}
                                                                            onClick={() => setFilterAlert(filterAlert === val ? 'all' : val)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                            </div>
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
                                            {filterStatus === 'inactivos' ? 'Baja' : 'Alta'}
                                        </th>
                                    )}
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
                                            colSpan={filterRole === 'chofer' ? 8 : 6}
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
                                                <td className="px-4 py-3 text-xs sm:px-6 sm:py-4">
                                                    {formatEstadoFecha(estadoFecha(user)) ? (
                                                        <span className="text-muted-foreground">
                                                            {formatEstadoFecha(estadoFecha(user))}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/50 italic">—</span>
                                                    )}
                                                </td>
                                            )}
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
                                                            <span className="text-xs font-bold tracking-widest uppercase text-foreground">{user.vehiculo.patente}</span>
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

                                    <div className="grid grid-cols-2 gap-3 text-xs">
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
                                        {filterRole === 'chofer' && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="tracking-wider text-muted-foreground uppercase">
                                                    {filterStatus === 'inactivos' ? 'Baja' : 'Alta'}
                                                </span>
                                                {formatEstadoFecha(estadoFecha(user)) ? (
                                                    <span className="text-foreground">
                                                        {formatEstadoFecha(estadoFecha(user))}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic">—</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {filterRole === 'chofer' && (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">Vehículo</span>
                                            {user.vehiculo ? (
                                                <span className="text-sm font-bold tracking-widest uppercase text-foreground">{user.vehiculo.patente}</span>
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
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
                            <UserPlus className="h-5 w-5 text-violet-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Nuevo usuario</DialogTitle>
                            <DialogDescription className="text-xs">
                                La contraseña provisional será la primera letra del nombre + DNI.
                            </DialogDescription>
                        </div>
                    </div>

                    <form onSubmit={handleCreateSubmit}>
                    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-5">
                        {/* Foto + Nombre */}
                        <div className="flex items-center gap-4">
                            <div className="shrink-0">
                                <AvatarDropzone
                                    file={createForm.data.profile_photo}
                                    onDrop={(files) => createForm.setData('profile_photo', files[0])}
                                />
                                <InputError message={createForm.errors.profile_photo} />
                            </div>
                            <div className="flex flex-1 flex-col gap-1.5">
                                <Label htmlFor="name">Nombre completo</Label>
                                <Input
                                    id="name"
                                    value={createForm.data.name}
                                    onChange={(e) => createForm.setData('name', e.target.value)}
                                    placeholder="Ej. Juan Pérez"
                                    required
                                />
                                <InputError message={createForm.errors.name} />
                            </div>
                        </div>

                        {/* DNI + Rol */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
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
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="role">Rol</Label>
                                <select
                                    id="role"
                                    value={createForm.data.role}
                                    onChange={(e) => createForm.setData('role', e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                >
                                    {roles.map((r) => (
                                        <option key={r.value} value={r.value} className="bg-background text-foreground">{r.label}</option>
                                    ))}
                                </select>
                                <InputError message={createForm.errors.role} />
                            </div>
                        </div>

                        {/* Campos por rol */}
                        {createForm.data.role === 'inversor' && empresas.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                <Label>Empresas</Label>
                                <div className="flex flex-col divide-y divide-border rounded-xl border border-input">
                                    {empresas.map((e) => {
                                        const checked = createForm.data.empresas.includes(e.id);
                                        return (
                                            <label key={e.id} className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-muted/40 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        const next = checked
                                                            ? createForm.data.empresas.filter((id) => id !== e.id)
                                                            : [...createForm.data.empresas, e.id];
                                                        createForm.setData('empresas', next);
                                                    }}
                                                    className="h-4 w-4 rounded border-input"
                                                />
                                                <span>{e.nombre}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <InputError message={createForm.errors.empresas as string | undefined} />
                            </div>
                        )}

                        {(createForm.data.role === 'administrativo' || createForm.data.role === 'administrador') && empresas.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="create-empresa-restringida">Acceso a empresa</Label>
                                <select
                                    id="create-empresa-restringida"
                                    value={createForm.data.empresa_restringida_id}
                                    onChange={(e) => createForm.setData('empresa_restringida_id', e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                >
                                    <option value="" className="bg-background text-foreground">Todas las empresas</option>
                                    {empresas.map((e) => (
                                        <option key={e.id} value={e.id} className="bg-background text-foreground">Sólo {e.nombre}</option>
                                    ))}
                                </select>
                                <InputError message={createForm.errors.empresa_restringida_id} />
                            </div>
                        )}

                        {createForm.data.role === 'chofer' && (
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 border-t border-border/60" />
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contacto y licencia</span>
                                    <div className="flex-1 border-t border-border/60" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="correo">Correo</Label>
                                    <Input id="correo" type="email" value={createForm.data.correo} onChange={(e) => createForm.setData('correo', e.target.value)} placeholder="usuario@correo.com" />
                                    <InputError message={createForm.errors.correo} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="telefono">Teléfono</Label>
                                        <Input id="telefono" value={createForm.data.telefono} onChange={(e) => createForm.setData('telefono', formatPhone(e.target.value))} placeholder="+54 9 11 1234-5678" />
                                        <InputError message={createForm.errors.telefono} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="fecha_vencimiento_licencia">Venc. licencia</Label>
                                        <Input id="fecha_vencimiento_licencia" type="date" value={createForm.data.fecha_vencimiento_licencia} onChange={(e) => createForm.setData('fecha_vencimiento_licencia', e.target.value)} />
                                        <InputError message={createForm.errors.fecha_vencimiento_licencia} />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="flex items-center gap-2">
                            <div className="flex-1 border-t border-border/60" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Garantía</span>
                            <div className="flex-1 border-t border-border/60" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="deposito">Depósito</Label>
                                <Input id="deposito" type="number" step="0.01" min="0" value={createForm.data.deposito} onChange={(e) => createForm.setData('deposito', e.target.value)} placeholder="0.00" />
                                <InputError message={createForm.errors.deposito} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="deposito_moneda">Moneda</Label>
                                <select id="deposito_moneda" value={createForm.data.deposito_moneda} onChange={(e) => createForm.setData('deposito_moneda', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none">
                                    {monedas.map((m) => <option key={m.value} value={m.value} className="bg-background text-foreground">{m.label}</option>)}
                                </select>
                                <InputError message={createForm.errors.deposito_moneda} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex-1 border-t border-border/60" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Documentación</span>
                            <div className="flex-1 border-t border-border/60" />
                        </div>
                        <DocumentSection
                            title="Licencia"
                            mode={createLicMode}
                            onModeChange={(m) => applyDocMode(createForm, 'licencia', setCreateLicMode, m)}
                            pdfFile={createForm.data.licencia_pdf}
                            onPdfDrop={(f) => createForm.setData('licencia_pdf', f[0])}
                            frenteFile={createForm.data.licencia_frente}
                            onFrenteDrop={(f) => createForm.setData('licencia_frente', f[0])}
                            dorsoFile={createForm.data.licencia_dorso}
                            onDorsoDrop={(f) => createForm.setData('licencia_dorso', f[0])}
                            onPreview={(url, name, type) => setPreviewImage({ url, name, type })}
                            error={createForm.errors.licencia_pdf || createForm.errors.licencia_frente || createForm.errors.licencia_dorso}
                        />
                        <DocumentSection
                            title="DNI"
                            mode={createDniMode}
                            onModeChange={(m) => applyDocMode(createForm, 'dni', setCreateDniMode, m)}
                            pdfFile={createForm.data.dni_pdf}
                            onPdfDrop={(f) => createForm.setData('dni_pdf', f[0])}
                            frenteFile={createForm.data.dni_frente}
                            onFrenteDrop={(f) => createForm.setData('dni_frente', f[0])}
                            dorsoFile={createForm.data.dni_dorso}
                            onDorsoDrop={(f) => createForm.setData('dni_dorso', f[0])}
                            onPreview={(url, name, type) => setPreviewImage({ url, name, type })}
                            error={createForm.errors.dni_pdf || createForm.errors.dni_frente || createForm.errors.dni_dorso}
                        />

                        </div>
                        <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                            <Button type="button" variant="outline" onClick={closeCreateModal}>Cancelar</Button>
                            <Button type="submit" disabled={createForm.processing}>
                                {createForm.processing ? 'Creando...' : <><Check className="h-4 w-4" /> Crear usuario</>}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!userToEdit}
                onOpenChange={(open) => !open && closeEditModal()}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
                            <UserCog className="h-5 w-5 text-violet-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Editar usuario</DialogTitle>
                            <DialogDescription className="text-xs">{userToEdit?.name}</DialogDescription>
                        </div>
                    </div>

                    <form onSubmit={handleEditSubmit}>
                    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-5">
                        {/* Foto + Nombre */}
                        <div className="flex items-center gap-4">
                            <div className="shrink-0">
                                <AvatarDropzone
                                    file={editForm.data.profile_photo}
                                    currentUrl={userToEdit?.profile_photo_url}
                                    onDrop={(files) => editForm.setData('profile_photo', files[0])}
                                />
                                <InputError message={editForm.errors.profile_photo} />
                            </div>
                            <div className="flex flex-1 flex-col gap-1.5">
                                <Label htmlFor="edit-name">Nombre completo</Label>
                                <Input id="edit-name" value={editForm.data.name} onChange={(e) => editForm.setData('name', e.target.value)} placeholder="Ej. Juan Pérez" required />
                                <InputError message={editForm.errors.name} />
                            </div>
                        </div>

                        {/* DNI */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edit-dni">DNI</Label>
                            <Input id="edit-dni" value={editForm.data.dni} onChange={(e) => editForm.setData('dni', e.target.value)} placeholder="Sin puntos" required />
                            <InputError message={editForm.errors.dni} />
                        </div>

                        {/* Campos por rol */}
                        {userToEdit?.role === 'inversor' && empresas.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                <Label>Empresas</Label>
                                <div className="flex flex-col divide-y divide-border rounded-xl border border-input">
                                    {empresas.map((e) => {
                                        const checked = editForm.data.empresas.includes(e.id);
                                        return (
                                            <label key={e.id} className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-muted/40 transition-colors">
                                                <input type="checkbox" checked={checked} onChange={() => { const next = checked ? editForm.data.empresas.filter((id) => id !== e.id) : [...editForm.data.empresas, e.id]; editForm.setData('empresas', next); }} className="h-4 w-4 rounded border-input" />
                                                <span>{e.nombre}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <InputError message={editForm.errors.empresas as string | undefined} />
                            </div>
                        )}

                        {(userToEdit?.role === 'administrativo' || userToEdit?.role === 'administrador') && empresas.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-empresa-restringida">Acceso a empresa</Label>
                                <select id="edit-empresa-restringida" value={editForm.data.empresa_restringida_id} onChange={(e) => editForm.setData('empresa_restringida_id', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none">
                                    <option value="" className="bg-background text-foreground">Todas las empresas</option>
                                    {empresas.map((e) => <option key={e.id} value={e.id} className="bg-background text-foreground">Sólo {e.nombre}</option>)}
                                </select>
                                <InputError message={editForm.errors.empresa_restringida_id} />
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <div className="flex-1 border-t border-border/60" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contacto y licencia</span>
                            <div className="flex-1 border-t border-border/60" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edit-correo">Correo</Label>
                            <Input id="edit-correo" type="email" value={editForm.data.correo} onChange={(e) => editForm.setData('correo', e.target.value)} placeholder="usuario@correo.com" />
                            <InputError message={editForm.errors.correo} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-telefono">Teléfono</Label>
                                <Input id="edit-telefono" value={editForm.data.telefono} onChange={(e) => editForm.setData('telefono', formatPhone(e.target.value))} placeholder="+54 9 11 1234-5678" />
                                <InputError message={editForm.errors.telefono} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-fecha_vencimiento_licencia">Venc. licencia</Label>
                                <Input id="edit-fecha_vencimiento_licencia" type="date" value={editForm.data.fecha_vencimiento_licencia} onChange={(e) => editForm.setData('fecha_vencimiento_licencia', e.target.value)} />
                                <InputError message={editForm.errors.fecha_vencimiento_licencia} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex-1 border-t border-border/60" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Garantía</span>
                            <div className="flex-1 border-t border-border/60" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-deposito">Depósito</Label>
                                <Input id="edit-deposito" type="number" step="0.01" min="0" value={editForm.data.deposito} onChange={(e) => editForm.setData('deposito', e.target.value)} placeholder="0.00" />
                                <InputError message={editForm.errors.deposito} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-deposito_moneda">Moneda</Label>
                                <select id="edit-deposito_moneda" value={editForm.data.deposito_moneda} onChange={(e) => editForm.setData('deposito_moneda', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none">
                                    {monedas.map((m) => <option key={m.value} value={m.value} className="bg-background text-foreground">{m.label}</option>)}
                                </select>
                                <InputError message={editForm.errors.deposito_moneda} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex-1 border-t border-border/60" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Documentación</span>
                            <div className="flex-1 border-t border-border/60" />
                        </div>
                        <DocumentSection
                            title="Licencia"
                            mode={editLicMode}
                            onModeChange={(m) => applyDocMode(editForm, 'licencia', setEditLicMode, m)}
                            pdfFile={editForm.data.licencia_pdf}
                            onPdfDrop={(f) => editForm.setData('licencia_pdf', f[0])}
                            frenteFile={editForm.data.licencia_frente}
                            onFrenteDrop={(f) => editForm.setData('licencia_frente', f[0])}
                            dorsoFile={editForm.data.licencia_dorso}
                            onDorsoDrop={(f) => editForm.setData('licencia_dorso', f[0])}
                            existing={userToEdit?.documentos?.licencia}
                            onPreview={(url, name, type) => setPreviewImage({ url, name, type })}
                            error={editForm.errors.licencia_pdf || editForm.errors.licencia_frente || editForm.errors.licencia_dorso}
                        />
                        <DocumentSection
                            title="DNI"
                            mode={editDniMode}
                            onModeChange={(m) => applyDocMode(editForm, 'dni', setEditDniMode, m)}
                            pdfFile={editForm.data.dni_pdf}
                            onPdfDrop={(f) => editForm.setData('dni_pdf', f[0])}
                            frenteFile={editForm.data.dni_frente}
                            onFrenteDrop={(f) => editForm.setData('dni_frente', f[0])}
                            dorsoFile={editForm.data.dni_dorso}
                            onDorsoDrop={(f) => editForm.setData('dni_dorso', f[0])}
                            existing={userToEdit?.documentos?.dni}
                            onPreview={(url, name, type) => setPreviewImage({ url, name, type })}
                            error={editForm.errors.dni_pdf || editForm.errors.dni_frente || editForm.errors.dni_dorso}
                        />

                        </div>
                        <DialogFooter className="flex-row items-center justify-between border-t border-border px-5 py-4">
                            {userToEdit && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => router.get(`/users/${userToEdit.id}/asignaciones`)}>
                                    Ver asignaciones
                                </Button>
                            )}
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={closeEditModal}>Cancelar</Button>
                                <Button type="submit" disabled={editForm.processing}>
                                    {editForm.processing ? 'Guardando...' : <><Check className="h-4 w-4" /> Guardar cambios</>}
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

            <DocPreviewDialog preview={previewImage} onClose={() => setPreviewImage(null)} />
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
