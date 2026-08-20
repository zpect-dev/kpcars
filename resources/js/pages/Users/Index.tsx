import { Head, router, usePage, useForm } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    Download,
    Filter,
    Plus,
    UserPlus,
    UserCog,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { SearchInput } from '@/components/app/filter-bar';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import {
    DepositoCuentaDialog,
    formatSaldos,
} from '@/components/deposito-cuenta-dialog';
import type { TipoMovimientoOption } from '@/components/deposito-cuenta-dialog';
import {
    DocumentSection,
    DocPreviewDialog
    
} from '@/components/documentos';
import type {DocMode} from '@/components/documentos';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { AvatarDropzone } from '@/components/users/avatar-dropzone';
import {
    DepositosField,
    FilterPopoverItem,
    SortHeader,
} from '@/components/users/campos';
import {
    coincideAlerta,
    coincideBusqueda,
    depositoTotalARS,
    estadoFecha,
    formatEstadoFecha,
    formatLicenciaFecha,
    getSortValue,
    faltaAlgunDocChofer,
    faltaDocDni,
    faltaDocLicencia,
    FILTER_SECTIONS,
    parseLicenciaDate,
    FILTER_SHORT_LABELS,
    sinDeposito,
    sinDireccion,
} from '@/components/users/logica';
import type {
    DepositoInicial,
    Empresa,
    FilterAlertValue,
    MonedaOption,
    RoleOption,
    SortField,
    User,
} from '@/components/users/tipos';
import { cn } from '@/lib/utils';
import { index as usersIndex, updateRole, store } from '@/routes/users';

interface Props {
    users: User[];
    roles: RoleOption[];
    empresas: Empresa[];
    monedas: MonedaOption[];
    tiposMovimiento?: TipoMovimientoOption[];
    choferCounts?: { activos: number; inactivos: number } | null;
    cotizacionDolar?: number;
    puedeConfigInversiones?: boolean;
}


export default function UsersIndex({
    users,
    roles,
    empresas,
    monedas,
    tiposMovimiento = [],
    choferCounts,
    cotizacionDolar = 0,
    puedeConfigInversiones = false,
}: Props) {
    const [userToToggle, setUserToToggle] = useState<User | null>(null);
    // Chofer cuya cuenta de depósito se está mirando. Se guarda el id (no el
    // objeto) para que el extracto se refresque solo al registrar movimientos.
    const [cuentaUserId, setCuentaUserId] = useState<number | null>(null);
    const cuentaUser = users.find((u) => u.id === cuentaUserId) ?? null;
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAlert, setFilterAlert] = useState<FilterAlertValue>('all');
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [openFilterSections, setOpenFilterSections] = useState<
        Record<string, boolean>
    >({});
    const [previewImage, setPreviewImage] = useState<{
        url: string;
        name: string;
        type?: 'image' | 'pdf';
    } | null>(null);

    const urlParams = new URLSearchParams(window.location.search);
    const filterRole = urlParams.get('role');
    const filterStatus = urlParams.get('status');

    function buildChoferesPdfUrl() {
        const p = new URLSearchParams();

        if (filterStatus) {
p.set('status', filterStatus);
}

        if (searchTerm.trim()) {
p.set('q', searchTerm.trim());
}

        if (filterAlert !== 'all') {
p.set('alert', filterAlert);
}

        const qs = p.toString();

        return `/users/choferes/pdf${qs ? `?${qs}` : ''}`;
    }

    const filteredUsers = useMemo(
        () =>
            // Un solo filter con predicados puros: encadenar reasignaciones de
            // `users` hacía que el compilador de React no pudiera preservar
            // esta memoización y descartara el componente entero.
            users.filter((u) => {
                if (searchTerm && !coincideBusqueda(u, searchTerm)) {
                    return false;
                }

                if (
                    filterRole === 'chofer' &&
                    filterAlert !== 'all' &&
                    !coincideAlerta(u, filterAlert, cotizacionDolar)
                ) {
                    return false;
                }

                return true;
            }),
        [users, searchTerm, filterAlert, filterRole, cotizacionDolar],
    );

    const sortedUsers = useMemo(() => {
        if (!sortField) {
return filteredUsers;
}

        const dir = sortDir === 'asc' ? 1 : -1;

        return [...filteredUsers].sort((a, b) => {
            const va = getSortValue(a, sortField, cotizacionDolar);
            const vb = getSortValue(b, sortField, cotizacionDolar);

            if (va == null && vb == null) {
return 0;
}

            if (va == null) {
return 1;
}

            if (vb == null) {
return -1;
}

            if (typeof va === 'string' && typeof vb === 'string') {
                return va.localeCompare(vb, 'es', { numeric: true }) * dir;
            }

            return ((va as number) - (vb as number)) * dir;
        });
    }, [filteredUsers, sortField, sortDir, cotizacionDolar]);

    function toggleSort(field: SortField) {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    }

    const alertCounts = useMemo(() => {
        if (filterRole !== 'chofer') {
return {
                licencia_vencida: 0,
                licencia_por_vencer: 0,
                sin_licencia: 0,
                falta_foto: 0,
                falta_docs: 0,
                falta_doc_dni: 0,
                falta_doc_licencia: 0,
                falta_telefono: 0,
                falta_correo: 0,
                falta_direccion: 0,
                con_direccion: 0,
                falta_deposito: 0,
                deposito_bajo: 0,
            };
}

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return {
            licencia_vencida: users.filter((u) => {
                if (!u.fecha_vencimiento_licencia) {
return false;
}

                return parseLicenciaDate(u.fecha_vencimiento_licencia) < today;
            }).length,
            licencia_por_vencer: users.filter((u) => u.licencia_por_vencer)
                .length,
            sin_licencia: users.filter((u) => u.sin_licencia).length,
            falta_foto: users.filter((u) => u.falta_foto).length,
            falta_docs: users.filter((u) => faltaAlgunDocChofer(u)).length,
            falta_doc_dni: users.filter((u) => faltaDocDni(u)).length,
            falta_doc_licencia: users.filter((u) => faltaDocLicencia(u)).length,
            falta_telefono: users.filter((u) => !u.telefono).length,
            falta_correo: users.filter((u) => !u.correo).length,
            falta_direccion: users.filter((u) => sinDireccion(u)).length,
            con_direccion: users.filter((u) => !sinDireccion(u)).length,
            falta_deposito: users.filter((u) => sinDeposito(u)).length,
            deposito_bajo: users.filter((u) => {
                if (!u.vehiculo?.precio) {
return false;
}

                return (
                    depositoTotalARS(u, cotizacionDolar) <
                    1.5 * u.vehiculo.precio
                );
            }).length,
        };
    }, [users, filterRole, cotizacionDolar]);

    function confirmToggleStatus(user: User) {
        if (user.id === auth.user.id) {
return;
}

        setUserToToggle(user);
    }

    function executeToggleStatus() {
        if (!userToToggle) {
return;
}

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
        direccion: '',
        fecha_ingreso: '',
        fecha_vencimiento_licencia: '',
        profile_photo: null as File | null,
        empresas: [] as number[],
        empresa_restringida_id: '' as string,
        depositos: [] as DepositoInicial[],
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
        direccion: '',
        fecha_ingreso: '',
        fecha_vencimiento_licencia: '',
        alta_fecha: '' as string,
        baja_fecha: '' as string,
        profile_photo: null as File | null,
        empresas: [] as number[],
        empresa_restringida_id: '' as string,
        licencia_pdf: null as File | null,
        licencia_frente: null as File | null,
        licencia_dorso: null as File | null,
        dni_pdf: null as File | null,
        dni_frente: null as File | null,
        dni_dorso: null as File | null,
    });
    const [editLicMode, setEditLicMode] = useState<DocMode>('imagenes');
    const [editDniMode, setEditDniMode] = useState<DocMode>('imagenes');

    // Cotización global del dólar (ARS por 1 USD) para el filtro de depósito bajo.
    const cotizacionForm = useForm({
        cotizacion_dolar: String(cotizacionDolar),
    });
    function guardarCotizacion(e: React.FormEvent) {
        e.preventDefault();
        cotizacionForm.patch('/users/cotizacion-dolar', {
            preserveScroll: true,
        });
    }

    function openEditModal(user: User) {
        setUserToEdit(user);

        let formattedDate = '';

        if (user.fecha_vencimiento_licencia) {
            formattedDate = user.fecha_vencimiento_licencia
                .split('T')[0]
                .split(' ')[0];
        }

        const toDateInput = (v?: string | null) =>
            v ? v.split('T')[0].split(' ')[0] : '';

        editForm.setData({
            _method: 'put',
            name: user.name,
            dni: user.dni,
            correo: user.correo || '',
            telefono: user.telefono || '+54 ',
            direccion: user.direccion || '',
            fecha_ingreso: toDateInput(user.fecha_ingreso),
            fecha_vencimiento_licencia: formattedDate,
            alta_fecha: toDateInput(user.alta_fecha),
            baja_fecha: toDateInput(user.baja_fecha),
            profile_photo: null,
            empresas: (user.empresas ?? []).map((e) => e.id),
            empresa_restringida_id: user.empresa_restringida_id
                ? String(user.empresa_restringida_id)
                : '',
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

        if (!userToEdit) {
return;
}

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
        if (digits.length <= 2) {
return '+54 ';
}

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

    /** Saldo de la cuenta de depósito por moneda, para la tabla de choferes. */
    function formatDeposito(user: User): string | null {
        return formatSaldos(user.deposito);
    }

    // Fecha a mostrar en la columna Alta/Baja, tomada de la auditoría
    // (chofer_eventos) — misma fuente que el reporte y editable desde el modal.
    // Fallback a los campos del usuario por si un chofer no tuviera eventos.




    function getLicenciaStatus(fechaStr: string | null | undefined) {
        if (!fechaStr) {
return null;
}

        const fecha = parseLicenciaDate(fechaStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.floor((fecha.getTime() - today.getTime()) / 86400000);

        if (diff < 0) {
return {
                label: 'Vencida',
                cls: 'bg-destructive-soft text-destructive-soft-foreground',
            };
}

        if (diff <= 30) {
return {
                label: 'Por vencer',
                cls: 'bg-warning-soft text-warning-soft-foreground',
            };
}

        return {
            label: 'Vigente',
            cls: 'bg-success-soft text-success-soft-foreground',
        };
    }

    const { auth } = usePage<any>().props;
    const isInversor = auth.user.role === 'inversor';
    useEffect(() => {
        if (!filterRole || (filterRole === 'chofer' && !filterStatus)) {
            router.get(
                usersIndex.url(),
                { role: 'chofer', status: 'activos' },
                { preserveState: false, replace: true },
            );
        }
    // Sólo al montar: es una redirección para fijar el filtro por defecto de la
    // URL. Con filterRole/filterStatus en las dependencias se volvería a
    // disparar cada vez que el usuario cambia de filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

            <PageContainer>
                {filterRole === 'chofer' ? (
                    <div className="flex flex-col gap-4">
                        <PageHeader
                            title="Choferes"
                            count={{
                                value: choferCounts?.activos ?? 0,
                                singular: 'activo',
                                plural: 'activos',
                            }}
                            actions={
                                !isInversor && (
                                    <Button size="sm" onClick={openCreateModal}>
                                        <Plus className="size-4" />
                                        <span className="hidden sm:inline">
                                            Nuevo chofer
                                        </span>
                                    </Button>
                                )
                            }
                        />

                        {/* Filter bar */}
                        <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                            <div className="flex flex-wrap items-end gap-3">
                                {/* Buscar */}
                                <div className="flex w-full flex-col gap-2 lg:min-w-[240px] lg:flex-1">
                                    <Label htmlFor="chofer-search">
                                        Buscar
                                    </Label>
                                    <SearchInput
                                        id="chofer-search"
                                        value={searchTerm}
                                        onChange={setSearchTerm}
                                        placeholder="Buscar por nombre, DNI o patente..."
                                    />
                                </div>

                                {/* Estado */}
                                <div className="flex w-full flex-col gap-2 lg:w-auto">
                                    <Label>Estado</Label>
                                    <div className="flex h-9 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.get(
                                                    usersIndex.url(),
                                                    {
                                                        role: 'chofer',
                                                        status: 'activos',
                                                    },
                                                    { preserveState: false },
                                                )
                                            }
                                            className={cn(
                                                'flex h-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                                                filterStatus === 'activos'
                                                    ? 'border-success/30 bg-success-soft text-success-soft-foreground'
                                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            <span className="font-bold tabular-nums">
                                                {choferCounts?.activos ?? 0}
                                            </span>
                                            activos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.get(
                                                    usersIndex.url(),
                                                    {
                                                        role: 'chofer',
                                                        status: 'inactivos',
                                                    },
                                                    { preserveState: false },
                                                )
                                            }
                                            className={cn(
                                                'flex h-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                                                filterStatus === 'inactivos'
                                                    ? 'border-destructive/30 bg-destructive-soft text-destructive-soft-foreground'
                                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            <span className="font-bold tabular-nums">
                                                {choferCounts?.inactivos ?? 0}
                                            </span>
                                            inactivos
                                        </button>
                                    </div>
                                </div>

                                {/* Filtrar */}
                                <div className="flex w-full items-end gap-2 lg:w-auto">
                                    <a
                                        href={buildChoferesPdfUrl()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-[9px] text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                                    >
                                        <Download className="h-4 w-4 shrink-0" />
                                        <span className="hidden sm:inline">
                                            Exportar PDF
                                        </span>
                                    </a>
                                    <div className="flex flex-col gap-2">
                                        <Label className="invisible hidden lg:block">
                                            Más
                                        </Label>
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
                                                        {filterAlert !== 'all'
                                                            ? FILTER_SHORT_LABELS[
                                                                  filterAlert
                                                              ]
                                                            : 'Filtrar'}
                                                    </span>
                                                    {filterAlert !== 'all' && (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                                                    )}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                align="end"
                                                className="w-72 p-0 shadow-lg"
                                            >
                                                <div className="border-b border-border p-1.5">
                                                    <FilterPopoverItem
                                                        label="Todos los choferes"
                                                        count={users.length}
                                                        isActive={
                                                            filterAlert ===
                                                            'all'
                                                        }
                                                        onClick={() =>
                                                            setFilterAlert(
                                                                'all',
                                                            )
                                                        }
                                                    />
                                                </div>
                                                {FILTER_SECTIONS.map(
                                                    (section, i) => {
                                                        const isOpen =
                                                            openFilterSections[
                                                                section.label
                                                            ] ?? false;
                                                        const hasActive =
                                                            section.items.some(
                                                                (it) =>
                                                                    filterAlert ===
                                                                    it.val,
                                                            );
                                                        const isLast =
                                                            i ===
                                                            FILTER_SECTIONS.length -
                                                                1;

                                                        return (
                                                            <div
                                                                key={
                                                                    section.label
                                                                }
                                                                className={
                                                                    !isLast
                                                                        ? 'border-b border-border'
                                                                        : ''
                                                                }
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setOpenFilterSections(
                                                                            (
                                                                                s,
                                                                            ) => ({
                                                                                ...s,
                                                                                [section.label]:
                                                                                    !s[
                                                                                        section
                                                                                            .label
                                                                                    ],
                                                                            }),
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-medium text-foreground">
                                                                            {
                                                                                section.label
                                                                            }
                                                                        </span>
                                                                        {hasActive && (
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                                                                        )}
                                                                    </div>
                                                                    <ChevronDown
                                                                        className={cn(
                                                                            'h-4 w-4 text-muted-foreground transition-transform',
                                                                            isOpen &&
                                                                                'rotate-180',
                                                                        )}
                                                                    />
                                                                </button>
                                                                {isOpen && (
                                                                    <div className="px-1.5 pb-1.5">
                                                                        {section.items.map(
                                                                            ({
                                                                                val,
                                                                                label,
                                                                                desc,
                                                                            }) => (
                                                                                <FilterPopoverItem
                                                                                    key={
                                                                                        val
                                                                                    }
                                                                                    label={
                                                                                        label
                                                                                    }
                                                                                    desc={
                                                                                        desc
                                                                                    }
                                                                                    count={
                                                                                        alertCounts[
                                                                                            val as keyof typeof alertCounts
                                                                                        ]
                                                                                    }
                                                                                    isActive={
                                                                                        filterAlert ===
                                                                                        val
                                                                                    }
                                                                                    onClick={() =>
                                                                                        setFilterAlert(
                                                                                            filterAlert ===
                                                                                                val
                                                                                                ? 'all'
                                                                                                : val,
                                                                                        )
                                                                                    }
                                                                                />
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    },
                                                )}
                                                <form
                                                    onSubmit={guardarCotizacion}
                                                    className="flex items-end gap-2 border-t border-border p-3"
                                                >
                                                    <div className="flex flex-1 flex-col gap-1">
                                                        <Label
                                                            htmlFor="cotizacion"
                                                            className="text-xs text-muted-foreground"
                                                        >
                                                            Cotización dólar
                                                            (ARS x USD)
                                                        </Label>
                                                        <MoneyInput
                                                            id="cotizacion"
                                                            value={
                                                                cotizacionForm
                                                                    .data
                                                                    .cotizacion_dolar ===
                                                                ''
                                                                    ? null
                                                                    : Number(
                                                                          cotizacionForm
                                                                              .data
                                                                              .cotizacion_dolar,
                                                                      )
                                                            }
                                                            onValueChange={(
                                                                n,
                                                            ) =>
                                                                cotizacionForm.setData(
                                                                    'cotizacion_dolar',
                                                                    n == null
                                                                        ? ''
                                                                        : String(
                                                                              n,
                                                                          ),
                                                                )
                                                            }
                                                            className="h-8"
                                                        />
                                                    </div>
                                                    <Button
                                                        type="submit"
                                                        size="sm"
                                                        disabled={
                                                            cotizacionForm.processing
                                                        }
                                                        className="h-8"
                                                    >
                                                        Guardar
                                                    </Button>
                                                </form>
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
                            <div className="w-full lg:max-w-xs">
                                <SearchInput
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    placeholder="Buscar por nombre o DNI..."
                                />
                            </div>
                        </div>
                        {puedeConfigInversiones && (
                            <div className="flex w-full sm:w-auto">
                                <Button
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    size="default"
                                    onClick={() =>
                                        router.visit('/users/inversiones')
                                    }
                                >
                                    <UserCog className="mr-2 h-4 w-4" />
                                    Configurar inversores
                                </Button>
                            </div>
                        )}
                        {!isInversor && (
                            <div className="flex w-full sm:w-auto">
                                <Button
                                    className="w-full sm:w-auto"
                                    size="default"
                                    onClick={openCreateModal}
                                >
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
                                        {filterRole === 'chofer' ? (
                                            <SortHeader
                                                label="Nombre"
                                                field="nombre"
                                                sortField={sortField}
                                                sortDir={sortDir}
                                                onSort={toggleSort}
                                            />
                                        ) : (
                                            'Nombre'
                                        )}
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
                                        {filterRole === 'chofer' ? (
                                            <SortHeader
                                                label="DNI"
                                                field="dni"
                                                sortField={sortField}
                                                sortDir={sortDir}
                                                onSort={toggleSort}
                                            />
                                        ) : (
                                            'DNI'
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[15%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        {filterRole === 'chofer' ? (
                                            <SortHeader
                                                label="Licencia"
                                                field="licencia"
                                                sortField={sortField}
                                                sortDir={sortDir}
                                                onSort={toggleSort}
                                            />
                                        ) : (
                                            'Licencia'
                                        )}
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[10%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        {filterRole === 'chofer' ? (
                                            <SortHeader
                                                label="Estado"
                                                field="estado"
                                                sortField={sortField}
                                                sortDir={sortDir}
                                                onSort={toggleSort}
                                            />
                                        ) : (
                                            'Estado'
                                        )}
                                    </th>
                                    {filterRole === 'chofer' && (
                                        <th
                                            scope="col"
                                            className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                        >
                                            <SortHeader
                                                label={
                                                    filterStatus ===
                                                    'inactivos'
                                                        ? 'Baja'
                                                        : 'Alta'
                                                }
                                                field="fecha_estado"
                                                sortField={sortField}
                                                sortDir={sortDir}
                                                onSort={toggleSort}
                                            />
                                        </th>
                                    )}
                                    {filterRole === 'chofer' && (
                                        <th
                                            scope="col"
                                            className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                        >
                                            <SortHeader
                                                label="Depósito"
                                                field="deposito"
                                                sortField={sortField}
                                                sortDir={sortDir}
                                                onSort={toggleSort}
                                            />
                                        </th>
                                    )}
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        {filterRole === 'chofer' ? (
                                            <SortHeader
                                                label="Vehículo"
                                                field="vehiculo"
                                                sortField={sortField}
                                                sortDir={sortDir}
                                                onSort={toggleSort}
                                            />
                                        ) : (
                                            'Rol'
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {sortedUsers.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={
                                                filterRole === 'chofer' ? 8 : 6
                                            }
                                            className="p-0"
                                        >
                                            <EmptyState
                                                variant={
                                                    searchTerm ||
                                                    filterAlert !== 'all'
                                                        ? 'filtered'
                                                        : 'empty'
                                                }
                                                title="No se encontraron usuarios"
                                                description={
                                                    searchTerm ||
                                                    filterAlert !== 'all'
                                                        ? 'Probá con otro nombre o quitá los filtros de alerta.'
                                                        : 'Todavía no hay nadie cargado con este rol.'
                                                }
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    sortedUsers.map((user) => (
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
                                                    <div className="flex min-w-0 flex-col">
                                                        <span
                                                            className="max-w-[150px] truncate font-semibold text-foreground"
                                                            title={user.name}
                                                        >
                                                            {user.name}
                                                        </span>
                                                        {(user.role ===
                                                            'administrador' ||
                                                            user.role ===
                                                                'administrativo' ||
                                                            user.role ===
                                                                'mecanico') &&
                                                            user.fecha_ingreso && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    Ingreso:{' '}
                                                                    {formatLicenciaFecha(
                                                                        user.fecha_ingreso,
                                                                    )}
                                                                </span>
                                                            )}
                                                    </div>
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
                                                            {formatLicenciaFecha(
                                                                user.fecha_vencimiento_licencia,
                                                            )}
                                                        </span>
                                                        {(() => {
                                                            const s =
                                                                getLicenciaStatus(
                                                                    user.fecha_vencimiento_licencia,
                                                                );

                                                            return s ? (
                                                                <span
                                                                    className={cn(
                                                                        'inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                                                                        s.cls,
                                                                    )}
                                                                >
                                                                    {s.label}
                                                                </span>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic">
                                                        N/A
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();

                                                        if (isInversor) {
return;
}

                                                        confirmToggleStatus(
                                                            user,
                                                        );
                                                    }}
                                                    disabled={
                                                        user.id ===
                                                            auth.user.id ||
                                                        isInversor
                                                    }
                                                    className={cn(
                                                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none',
                                                        user.inactivo
                                                            ? 'bg-destructive-soft text-destructive-soft-foreground'
                                                            : 'bg-success-soft text-success-soft-foreground',
                                                        !isInversor &&
                                                            user.id !==
                                                                auth.user.id
                                                            ? user.inactivo
                                                                ? 'cursor-pointer hover:bg-destructive/20'
                                                                : 'cursor-pointer hover:bg-success/20'
                                                            : 'cursor-default',
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'h-1.5 w-1.5 rounded-full',
                                                            user.inactivo
                                                                ? 'bg-destructive'
                                                                : 'bg-success',
                                                        )}
                                                    />
                                                    {user.inactivo
                                                        ? 'Inactivo'
                                                        : 'Activo'}
                                                </button>
                                            </td>
                                            {filterRole === 'chofer' && (
                                                <td className="px-4 py-3 text-xs sm:px-6 sm:py-4">
                                                    {formatEstadoFecha(
                                                        estadoFecha(user),
                                                    ) ? (
                                                        <span className="text-muted-foreground">
                                                            {formatEstadoFecha(
                                                                estadoFecha(
                                                                    user,
                                                                ),
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/50 italic">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            {filterRole === 'chofer' && (
                                                <td className="px-4 py-3 text-sm sm:px-6 sm:py-4">
                                                    {/* Abre el extracto de la
                                                        cuenta de depósito. */}
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCuentaUserId(
                                                                user.id,
                                                            )
                                                        }
                                                        title="Ver cuenta de depósito"
                                                        className="rounded-md px-1 py-0.5 transition-colors hover:bg-muted"
                                                    >
                                                        {formatDeposito(
                                                            user,
                                                        ) ? (
                                                            <span className="font-medium text-foreground">
                                                                {formatDeposito(
                                                                    user,
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground/50 italic">
                                                                —
                                                            </span>
                                                        )}
                                                    </button>
                                                </td>
                                            )}
                                            <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                {filterRole === 'chofer' ? (
                                                    <div className="flex flex-col gap-1">
                                                        {user.vehiculo ? (
                                                            <span className="text-xs font-bold tracking-widest text-foreground uppercase">
                                                                {
                                                                    user
                                                                        .vehiculo
                                                                        .patente
                                                                }
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground/50 italic">
                                                                Sin vehículo
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1.5">
                                                        {user.id ===
                                                        auth.user.id ? (
                                                            <span className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
                                                                {roles.find(
                                                                    (r) =>
                                                                        r.value ===
                                                                        user.role,
                                                                )?.label ||
                                                                    user.role}{' '}
                                                                (Tú)
                                                            </span>
                                                        ) : isInversor ? (
                                                            <span className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
                                                                {roles.find(
                                                                    (r) =>
                                                                        r.value ===
                                                                        user.role,
                                                                )?.label ||
                                                                    user.role}
                                                            </span>
                                                        ) : (
                                                            <select
                                                                onClick={(e) =>
                                                                    e.stopPropagation()
                                                                }
                                                                value={
                                                                    user.role
                                                                }
                                                                onChange={(e) =>
                                                                    handleRoleChange(
                                                                        user.id,
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="block w-full max-w-xs rounded-md border-input bg-background px-3 py-1.5 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {roles.map(
                                                                    (role) => (
                                                                        <option
                                                                            key={
                                                                                role.value
                                                                            }
                                                                            value={
                                                                                role.value
                                                                            }
                                                                        >
                                                                            {
                                                                                role.label
                                                                            }
                                                                        </option>
                                                                    ),
                                                                )}
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
                        {sortedUsers.length === 0 ? (
                            <li>
                                <EmptyState
                                    variant={
                                        searchTerm || filterAlert !== 'all'
                                            ? 'filtered'
                                            : 'empty'
                                    }
                                    title="No se encontraron usuarios"
                                    description={
                                        searchTerm || filterAlert !== 'all'
                                            ? 'Probá con otro nombre o quitá los filtros de alerta.'
                                            : 'Todavía no hay nadie cargado con este rol.'
                                    }
                                />
                            </li>
                        ) : (
                            sortedUsers.map((user) => (
                                <li
                                    key={user.id}
                                    role={isInversor ? undefined : 'button'}
                                    tabIndex={isInversor ? -1 : 0}
                                    onClick={() =>
                                        !isInversor && openEditModal(user)
                                    }
                                    onKeyDown={(e) => {
                                        if (isInversor) {
return;
}

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
                                                {(user.role ===
                                                    'administrador' ||
                                                    user.role ===
                                                        'administrativo' ||
                                                    user.role === 'mecanico') &&
                                                    user.fecha_ingreso && (
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            Ingreso:{' '}
                                                            {formatLicenciaFecha(
                                                                user.fecha_ingreso,
                                                            )}
                                                        </p>
                                                    )}
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

                                                if (isInversor) {
return;
}

                                                confirmToggleStatus(user);
                                            }}
                                            disabled={
                                                user.id === auth.user.id ||
                                                isInversor
                                            }
                                            className={cn(
                                                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none',
                                                user.inactivo
                                                    ? 'bg-destructive-soft text-destructive-soft-foreground'
                                                    : 'bg-success-soft text-success-soft-foreground',
                                                !isInversor &&
                                                    user.id !== auth.user.id
                                                    ? user.inactivo
                                                        ? 'cursor-pointer hover:bg-destructive/20'
                                                        : 'cursor-pointer hover:bg-success/20'
                                                    : 'cursor-default',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'h-1.5 w-1.5 rounded-full',
                                                    user.inactivo
                                                        ? 'bg-destructive'
                                                        : 'bg-success',
                                                )}
                                            />
                                            {user.inactivo
                                                ? 'Inactivo'
                                                : 'Activo'}
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
                                                        {formatLicenciaFecha(
                                                            user.fecha_vencimiento_licencia,
                                                        )}
                                                    </span>
                                                    {(() => {
                                                        const s =
                                                            getLicenciaStatus(
                                                                user.fecha_vencimiento_licencia,
                                                            );

                                                        return s ? (
                                                            <span
                                                                className={cn(
                                                                    'inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                                                                    s.cls,
                                                                )}
                                                            >
                                                                {s.label}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground/50 italic">
                                                    N/A
                                                </span>
                                            )}
                                        </div>
                                        {filterRole === 'chofer' && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="tracking-wider text-muted-foreground uppercase">
                                                    Depósito
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setCuentaUserId(user.id)
                                                    }
                                                    className="text-left"
                                                >
                                                    {formatDeposito(user) ? (
                                                        <span className="font-medium text-foreground">
                                                            {formatDeposito(
                                                                user,
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/50 italic">
                                                            —
                                                        </span>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                        {filterRole === 'chofer' && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="tracking-wider text-muted-foreground uppercase">
                                                    {filterStatus ===
                                                    'inactivos'
                                                        ? 'Baja'
                                                        : 'Alta'}
                                                </span>
                                                {formatEstadoFecha(
                                                    estadoFecha(user),
                                                ) ? (
                                                    <span className="text-foreground">
                                                        {formatEstadoFecha(
                                                            estadoFecha(user),
                                                        )}
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
                                            <span className="text-xs tracking-wider text-muted-foreground uppercase">
                                                Vehículo
                                            </span>
                                            {user.vehiculo ? (
                                                <span className="text-sm font-bold tracking-widest text-foreground uppercase">
                                                    {user.vehiculo.patente}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/50 italic">
                                                    Sin vehículo
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </PageContainer>

            <Dialog
                open={showCreateModal}
                onOpenChange={(open) => !open && closeCreateModal()}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft">
                            <UserPlus aria-hidden="true" className="size-5 text-info-soft-foreground" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">
                                Nuevo usuario
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                La contraseña provisional será la primera letra
                                del nombre + DNI.
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
                                        onDrop={(files) =>
                                            createForm.setData(
                                                'profile_photo',
                                                files[0],
                                            )
                                        }
                                    />
                                    <InputError
                                        message={
                                            createForm.errors.profile_photo
                                        }
                                    />
                                </div>
                                <div className="flex flex-1 flex-col gap-1.5">
                                    <Label htmlFor="name">
                                        Nombre completo
                                    </Label>
                                    <Input
                                        id="name"
                                        value={createForm.data.name}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'name',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Ej. Juan Pérez"
                                        required
                                    />
                                    <InputError
                                        message={createForm.errors.name}
                                    />
                                </div>
                            </div>

                            {/* DNI + Rol */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
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
                                    <InputError
                                        message={createForm.errors.dni}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
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
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none"
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
                                    <InputError
                                        message={createForm.errors.role}
                                    />
                                </div>
                            </div>

                            {/* Campos por rol */}
                            {createForm.data.role === 'inversor' &&
                                empresas.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Empresas</Label>
                                        <div className="flex flex-col divide-y divide-border rounded-xl border border-input">
                                            {empresas.map((e) => {
                                                const checked =
                                                    createForm.data.empresas.includes(
                                                        e.id,
                                                    );

                                                return (
                                                    <label
                                                        key={e.id}
                                                        className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/40"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                const next =
                                                                    checked
                                                                        ? createForm.data.empresas.filter(
                                                                              (
                                                                                  id,
                                                                              ) =>
                                                                                  id !==
                                                                                  e.id,
                                                                          )
                                                                        : [
                                                                              ...createForm
                                                                                  .data
                                                                                  .empresas,
                                                                              e.id,
                                                                          ];
                                                                createForm.setData(
                                                                    'empresas',
                                                                    next,
                                                                );
                                                            }}
                                                            className="h-4 w-4 rounded border-input"
                                                        />
                                                        <span>{e.nombre}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <InputError
                                            message={
                                                createForm.errors.empresas as
                                                    | string
                                                    | undefined
                                            }
                                        />
                                    </div>
                                )}

                            {(createForm.data.role === 'administrativo' ||
                                createForm.data.role === 'administrador') &&
                                empresas.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="create-empresa-restringida">
                                            Acceso a empresa
                                        </Label>
                                        <select
                                            id="create-empresa-restringida"
                                            value={
                                                createForm.data
                                                    .empresa_restringida_id
                                            }
                                            onChange={(e) =>
                                                createForm.setData(
                                                    'empresa_restringida_id',
                                                    e.target.value,
                                                )
                                            }
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                        >
                                            <option
                                                value=""
                                                className="bg-background text-foreground"
                                            >
                                                Todas las empresas
                                            </option>
                                            {empresas.map((e) => (
                                                <option
                                                    key={e.id}
                                                    value={e.id}
                                                    className="bg-background text-foreground"
                                                >
                                                    Sólo {e.nombre}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            message={
                                                createForm.errors
                                                    .empresa_restringida_id
                                            }
                                        />
                                    </div>
                                )}

                            {createForm.data.role === 'chofer' && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 border-t border-border/60" />
                                        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                            Contacto y licencia
                                        </span>
                                        <div className="flex-1 border-t border-border/60" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
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
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="telefono">
                                                Teléfono
                                            </Label>
                                            <Input
                                                id="telefono"
                                                value={createForm.data.telefono}
                                                onChange={(e) =>
                                                    createForm.setData(
                                                        'telefono',
                                                        formatPhone(
                                                            e.target.value,
                                                        ),
                                                    )
                                                }
                                                placeholder="+54 9 11 1234-5678"
                                            />
                                            <InputError
                                                message={
                                                    createForm.errors.telefono
                                                }
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="fecha_vencimiento_licencia">
                                                Venc. licencia
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
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="direccion">
                                            Dirección
                                        </Label>
                                        <Input
                                            id="direccion"
                                            value={createForm.data.direccion}
                                            onChange={(e) =>
                                                createForm.setData(
                                                    'direccion',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Calle, número, localidad..."
                                        />
                                        <InputError
                                            message={
                                                createForm.errors.direccion
                                            }
                                        />
                                    </div>
                                </>
                            )}

                            {(createForm.data.role === 'administrador' ||
                                createForm.data.role === 'administrativo' ||
                                createForm.data.role === 'mecanico') && (
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="fecha_ingreso">
                                        Fecha de ingreso
                                    </Label>
                                    <Input
                                        id="fecha_ingreso"
                                        type="date"
                                        value={createForm.data.fecha_ingreso}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'fecha_ingreso',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={
                                            createForm.errors.fecha_ingreso
                                        }
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-border/60" />
                                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                    Garantía
                                </span>
                                <div className="flex-1 border-t border-border/60" />
                            </div>
                            <DepositosField
                                depositos={createForm.data.depositos}
                                monedas={monedas}
                                onChange={(d) =>
                                    createForm.setData('depositos', d)
                                }
                                error={
                                    createForm.errors.depositos as
                                        | string
                                        | undefined
                                }
                            />

                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-border/60" />
                                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                    Documentación
                                </span>
                                <div className="flex-1 border-t border-border/60" />
                            </div>
                            <DocumentSection
                                title="Licencia"
                                mode={createLicMode}
                                onModeChange={(m) =>
                                    applyDocMode(
                                        createForm,
                                        'licencia',
                                        setCreateLicMode,
                                        m,
                                    )
                                }
                                pdfFile={createForm.data.licencia_pdf}
                                onPdfDrop={(f) =>
                                    createForm.setData('licencia_pdf', f[0])
                                }
                                frenteFile={createForm.data.licencia_frente}
                                onFrenteDrop={(f) =>
                                    createForm.setData('licencia_frente', f[0])
                                }
                                dorsoFile={createForm.data.licencia_dorso}
                                onDorsoDrop={(f) =>
                                    createForm.setData('licencia_dorso', f[0])
                                }
                                onPreview={(url, name, type) =>
                                    setPreviewImage({ url, name, type })
                                }
                                error={
                                    createForm.errors.licencia_pdf ||
                                    createForm.errors.licencia_frente ||
                                    createForm.errors.licencia_dorso
                                }
                            />
                            <DocumentSection
                                title="DNI"
                                mode={createDniMode}
                                onModeChange={(m) =>
                                    applyDocMode(
                                        createForm,
                                        'dni',
                                        setCreateDniMode,
                                        m,
                                    )
                                }
                                pdfFile={createForm.data.dni_pdf}
                                onPdfDrop={(f) =>
                                    createForm.setData('dni_pdf', f[0])
                                }
                                frenteFile={createForm.data.dni_frente}
                                onFrenteDrop={(f) =>
                                    createForm.setData('dni_frente', f[0])
                                }
                                dorsoFile={createForm.data.dni_dorso}
                                onDorsoDrop={(f) =>
                                    createForm.setData('dni_dorso', f[0])
                                }
                                onPreview={(url, name, type) =>
                                    setPreviewImage({ url, name, type })
                                }
                                error={
                                    createForm.errors.dni_pdf ||
                                    createForm.errors.dni_frente ||
                                    createForm.errors.dni_dorso
                                }
                            />
                        </div>
                        <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
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
                                {createForm.processing ? (
                                    'Creando...'
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" /> Crear
                                        usuario
                                    </>
                                )}
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
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft">
                            <UserCog aria-hidden="true" className="size-5 text-info-soft-foreground" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">
                                Editar usuario
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                {userToEdit?.name}
                            </DialogDescription>
                        </div>
                    </div>

                    <form onSubmit={handleEditSubmit}>
                        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-5">
                            {/* Foto + Nombre */}
                            <div className="flex items-center gap-4">
                                <div className="shrink-0">
                                    <AvatarDropzone
                                        file={editForm.data.profile_photo}
                                        currentUrl={
                                            userToEdit?.profile_photo_url
                                        }
                                        onDrop={(files) =>
                                            editForm.setData(
                                                'profile_photo',
                                                files[0],
                                            )
                                        }
                                    />
                                    <InputError
                                        message={editForm.errors.profile_photo}
                                    />
                                </div>
                                <div className="flex flex-1 flex-col gap-1.5">
                                    <Label htmlFor="edit-name">
                                        Nombre completo
                                    </Label>
                                    <Input
                                        id="edit-name"
                                        value={editForm.data.name}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'name',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Ej. Juan Pérez"
                                        required
                                    />
                                    <InputError
                                        message={editForm.errors.name}
                                    />
                                </div>
                            </div>

                            {/* DNI */}
                            <div className="flex flex-col gap-1.5">
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

                            {/* Campos por rol */}
                            {userToEdit?.role === 'inversor' &&
                                empresas.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Empresas</Label>
                                        <div className="flex flex-col divide-y divide-border rounded-xl border border-input">
                                            {empresas.map((e) => {
                                                const checked =
                                                    editForm.data.empresas.includes(
                                                        e.id,
                                                    );

                                                return (
                                                    <label
                                                        key={e.id}
                                                        className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/40"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                const next =
                                                                    checked
                                                                        ? editForm.data.empresas.filter(
                                                                              (
                                                                                  id,
                                                                              ) =>
                                                                                  id !==
                                                                                  e.id,
                                                                          )
                                                                        : [
                                                                              ...editForm
                                                                                  .data
                                                                                  .empresas,
                                                                              e.id,
                                                                          ];
                                                                editForm.setData(
                                                                    'empresas',
                                                                    next,
                                                                );
                                                            }}
                                                            className="h-4 w-4 rounded border-input"
                                                        />
                                                        <span>{e.nombre}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <InputError
                                            message={
                                                editForm.errors.empresas as
                                                    | string
                                                    | undefined
                                            }
                                        />
                                    </div>
                                )}

                            {(userToEdit?.role === 'administrativo' ||
                                userToEdit?.role === 'administrador') &&
                                empresas.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="edit-empresa-restringida">
                                            Acceso a empresa
                                        </Label>
                                        <select
                                            id="edit-empresa-restringida"
                                            value={
                                                editForm.data
                                                    .empresa_restringida_id
                                            }
                                            onChange={(e) =>
                                                editForm.setData(
                                                    'empresa_restringida_id',
                                                    e.target.value,
                                                )
                                            }
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                        >
                                            <option
                                                value=""
                                                className="bg-background text-foreground"
                                            >
                                                Todas las empresas
                                            </option>
                                            {empresas.map((e) => (
                                                <option
                                                    key={e.id}
                                                    value={e.id}
                                                    className="bg-background text-foreground"
                                                >
                                                    Sólo {e.nombre}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            message={
                                                editForm.errors
                                                    .empresa_restringida_id
                                            }
                                        />
                                    </div>
                                )}

                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-border/60" />
                                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                    Contacto y licencia
                                </span>
                                <div className="flex-1 border-t border-border/60" />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-correo">Correo</Label>
                                <Input
                                    id="edit-correo"
                                    type="email"
                                    value={editForm.data.correo}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'correo',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="usuario@correo.com"
                                />
                                <InputError message={editForm.errors.correo} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="edit-telefono">
                                        Teléfono
                                    </Label>
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
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="edit-fecha_vencimiento_licencia">
                                        Venc. licencia
                                    </Label>
                                    <Input
                                        id="edit-fecha_vencimiento_licencia"
                                        type="date"
                                        value={
                                            editForm.data
                                                .fecha_vencimiento_licencia
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

                            {userToEdit?.role === 'chofer' && (
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="edit-direccion">
                                        Dirección
                                    </Label>
                                    <Input
                                        id="edit-direccion"
                                        value={editForm.data.direccion}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'direccion',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Calle, número, localidad..."
                                    />
                                    <InputError
                                        message={editForm.errors.direccion}
                                    />
                                </div>
                            )}

                            {(userToEdit?.role === 'administrador' ||
                                userToEdit?.role === 'administrativo' ||
                                userToEdit?.role === 'mecanico') && (
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="edit-fecha_ingreso">
                                        Fecha de ingreso
                                    </Label>
                                    <Input
                                        id="edit-fecha_ingreso"
                                        type="date"
                                        value={editForm.data.fecha_ingreso}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'fecha_ingreso',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={editForm.errors.fecha_ingreso}
                                    />
                                </div>
                            )}

                            {userToEdit?.role === 'chofer' && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 border-t border-border/60" />
                                        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                            Alta y baja
                                        </span>
                                        <div className="flex-1 border-t border-border/60" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="edit-alta_fecha">
                                                Fecha de alta
                                            </Label>
                                            <Input
                                                id="edit-alta_fecha"
                                                type="date"
                                                value={editForm.data.alta_fecha}
                                                onChange={(e) =>
                                                    editForm.setData(
                                                        'alta_fecha',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={
                                                    editForm.errors.alta_fecha
                                                }
                                            />
                                        </div>
                                        {userToEdit?.inactivo && (
                                            <div className="flex flex-col gap-1.5">
                                                <Label htmlFor="edit-baja_fecha">
                                                    Fecha de baja
                                                </Label>
                                                <Input
                                                    id="edit-baja_fecha"
                                                    type="date"
                                                    value={
                                                        editForm.data.baja_fecha
                                                    }
                                                    onChange={(e) =>
                                                        editForm.setData(
                                                            'baja_fecha',
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    message={
                                                        editForm.errors
                                                            .baja_fecha
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-border/60" />
                                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                    Garantía
                                </span>
                                <div className="flex-1 border-t border-border/60" />
                            </div>

                            {/* La cuenta de depósito es append-only: no se edita
                                acá, se le agregan movimientos en el extracto. */}
                            {userToEdit && (
                                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                                    <div className="flex flex-col">
                                        <span className="text-xs tracking-wider text-muted-foreground uppercase">
                                            Saldo de la cuenta
                                        </span>
                                        <span className="text-sm font-medium text-foreground">
                                            {formatDeposito(userToEdit) ??
                                                'Sin movimientos'}
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setCuentaUserId(userToEdit.id);
                                            closeEditModal();
                                        }}
                                    >
                                        Ver cuenta
                                    </Button>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-border/60" />
                                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                    Documentación
                                </span>
                                <div className="flex-1 border-t border-border/60" />
                            </div>
                            <DocumentSection
                                title="Licencia"
                                mode={editLicMode}
                                onModeChange={(m) =>
                                    applyDocMode(
                                        editForm,
                                        'licencia',
                                        setEditLicMode,
                                        m,
                                    )
                                }
                                pdfFile={editForm.data.licencia_pdf}
                                onPdfDrop={(f) =>
                                    editForm.setData('licencia_pdf', f[0])
                                }
                                frenteFile={editForm.data.licencia_frente}
                                onFrenteDrop={(f) =>
                                    editForm.setData('licencia_frente', f[0])
                                }
                                dorsoFile={editForm.data.licencia_dorso}
                                onDorsoDrop={(f) =>
                                    editForm.setData('licencia_dorso', f[0])
                                }
                                existing={userToEdit?.documentos?.licencia}
                                onPreview={(url, name, type) =>
                                    setPreviewImage({ url, name, type })
                                }
                                error={
                                    editForm.errors.licencia_pdf ||
                                    editForm.errors.licencia_frente ||
                                    editForm.errors.licencia_dorso
                                }
                            />
                            <DocumentSection
                                title="DNI"
                                mode={editDniMode}
                                onModeChange={(m) =>
                                    applyDocMode(
                                        editForm,
                                        'dni',
                                        setEditDniMode,
                                        m,
                                    )
                                }
                                pdfFile={editForm.data.dni_pdf}
                                onPdfDrop={(f) =>
                                    editForm.setData('dni_pdf', f[0])
                                }
                                frenteFile={editForm.data.dni_frente}
                                onFrenteDrop={(f) =>
                                    editForm.setData('dni_frente', f[0])
                                }
                                dorsoFile={editForm.data.dni_dorso}
                                onDorsoDrop={(f) =>
                                    editForm.setData('dni_dorso', f[0])
                                }
                                existing={userToEdit?.documentos?.dni}
                                onPreview={(url, name, type) =>
                                    setPreviewImage({ url, name, type })
                                }
                                error={
                                    editForm.errors.dni_pdf ||
                                    editForm.errors.dni_frente ||
                                    editForm.errors.dni_dorso
                                }
                            />
                        </div>
                        <DialogFooter className="flex-row items-center justify-between border-t border-border px-5 py-4">
                            {userToEdit && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        router.get(
                                            `/users/${userToEdit.id}/asignaciones`,
                                        )
                                    }
                                >
                                    Ver asignaciones
                                </Button>
                            )}
                            <div className="flex gap-2">
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
                                    {editForm.processing ? (
                                        'Guardando...'
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4" />{' '}
                                            Guardar cambios
                                        </>
                                    )}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Confirmar Toggle de Estado */}
            <ConfirmDialog
                open={!!userToToggle}
                onOpenChange={(open) => !open && setUserToToggle(null)}
                tone={userToToggle?.inactivo ? 'default' : 'destructive'}
                title={
                    userToToggle?.inactivo
                        ? `¿Reactivar a ${userToToggle?.name}?`
                        : `¿Dar de baja a ${userToToggle?.name}?`
                }
                description={
                    userToToggle?.inactivo
                        ? 'Vuelve a quedar disponible para asignarle vehículos.'
                        : 'Se cierran sus asignaciones activas de vehículos y se lo desvincula de cualquier placa asociada. La baja no borra su historial.'
                }
                confirmLabel={
                    userToToggle?.inactivo ? 'Reactivar' : 'Dar de baja'
                }
                onConfirm={executeToggleStatus}
            />

            <DocPreviewDialog
                preview={previewImage}
                onClose={() => setPreviewImage(null)}
            />

            {/* Cuenta de depósito del chofer: extracto + alta de movimientos. */}
            <DepositoCuentaDialog
                key={cuentaUserId ?? 'sin-cuenta'}
                user={
                    cuentaUser
                        ? { id: cuentaUser.id, name: cuentaUser.name }
                        : null
                }
                cuenta={cuentaUser?.deposito}
                monedas={monedas}
                tipos={tiposMovimiento}
                open={!!cuentaUser}
                onOpenChange={(open) => !open && setCuentaUserId(null)}
            />
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
