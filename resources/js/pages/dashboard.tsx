import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Car,
    Check,
    FileDown,
    FileUp,
    History,
    LayoutList,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
    UserCheck,
    UserX,
    Wallet,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import InputError from '@/components/input-error';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Empresa, Inversion, User, Vehiculo } from '@/types';

interface Filters {
    empresa_id?: string;
    inversion_id?: string;
}

interface Props {
    vehiculos: Vehiculo[];
    empresas: Pick<Empresa, 'id' | 'nombre'>[];
    inversiones: Pick<Inversion, 'id' | 'nombre'>[];
    users: Pick<User, 'id' | 'name'>[];
    filters: Filters;
}

export default function Dashboard({
    vehiculos,
    empresas,
    inversiones,
    users,
    filters,
}: Props) {
    const { auth } = usePage<any>().props;
    const isInversor = auth?.user?.role === 'inversor';
    const isAdmin = auth?.user?.role === 'administrador';
    const empresaActivaNombre = auth?.active_company?.nombre ?? null;
    // El selector de empresa se reemplazó por el switcher del dropdown de usuario.
    // El filtro por empresa en el dashboard queda obsoleto: TenantScope ya filtra
    // las queries por la empresa activa.
    const hideEmpresa = true;

    useEffect(() => {
        if (isInversor) {
            router.replace('/mi-cuenta');
        }
    }, [isInversor]);

    const FILTERS_STORAGE_KEY = 'vehiculos:filters';
    const storedFilters = (() => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    const [search, setSearch] = useState<string>(storedFilters?.search ?? '');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const searchRef = useRef<HTMLInputElement>(null);

    const [empresaId, setEmpresaId] = useState(filters.empresa_id || '');
    const [inversionId, setInversionId] = useState(filters.inversion_id || '');
    const [asignacionFiltro, setAsignacionFiltro] = useState<
        'all' | 'con' | 'sin'
    >(storedFilters?.asignacionFiltro ?? 'all');

    useEffect(() => {
        try {
            sessionStorage.setItem(
                FILTERS_STORAGE_KEY,
                JSON.stringify({ search, asignacionFiltro }),
            );
        } catch {
            // ignore quota / unavailable storage
        }
    }, [search, asignacionFiltro]);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreateInversionOpen, setIsCreateInversionOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingVehiculo, setEditingVehiculo] = useState<Vehiculo | null>(
        null,
    );
    const [deletingVehiculo, setDeletingVehiculo] = useState<Vehiculo | null>(
        null,
    );
    const [unassigningVehiculo, setUnassigningVehiculo] =
        useState<Vehiculo | null>(null);

    const isMounted = useRef(false);

    // --- Autocomplete suggestions (client-side) ---
    const suggestions = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return [];
        const results: { label: string; sub: string; vehiculoId: number }[] =
            [];
        const seen = new Set<number>();

        for (const v of vehiculos) {
            if (seen.has(v.id)) continue;
            if (v.patente.toLowerCase().includes(q)) {
                results.push({
                    label: v.patente,
                    sub: `${v.marca} ${v.modelo}`,
                    vehiculoId: v.id,
                });
                seen.add(v.id);
            } else if (v.user?.name && v.user.name.toLowerCase().includes(q)) {
                results.push({
                    label: v.user.name,
                    sub: v.patente,
                    vehiculoId: v.id,
                });
                seen.add(v.id);
            }
        }
        return results.slice(0, 8);
    }, [vehiculos, search]);

    // --- Client-side filtered list ---
    const filteredVehiculos = useMemo(() => {
        let result = vehiculos;

        const q = search.toLowerCase().trim();
        if (q) {
            result = result.filter(
                (v) =>
                    v.patente.toLowerCase().includes(q) ||
                    (v.user?.name && v.user.name.toLowerCase().includes(q)),
            );
        }

        if (asignacionFiltro === 'con')
            result = result.filter((v) => !!v.user_id);
        if (asignacionFiltro === 'sin')
            result = result.filter((v) => !v.user_id);

        return result;
    }, [vehiculos, search, asignacionFiltro]);

    function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!showSearchDropdown || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev <= 0 ? suggestions.length - 1 : prev - 1,
            );
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            const s = suggestions[highlightedIndex];
            setSearch(s.label);
            setShowSearchDropdown(false);
            setHighlightedIndex(-1);
        } else if (e.key === 'Escape') {
            setShowSearchDropdown(false);
            setHighlightedIndex(-1);
        }
    }

    function selectSuggestion(s: { label: string }) {
        setSearch(s.label);
        setShowSearchDropdown(false);
        setHighlightedIndex(-1);
    }

    // --- Server-side filters (empresa / inversion only) ---
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }

        const hasChanges =
            empresaId !== (filters.empresa_id || '') ||
            inversionId !== (filters.inversion_id || '');

        if (!hasChanges) return;

        const timeoutId = setTimeout(() => {
            const active: Record<string, string> = {};
            if (empresaId) active.empresa_id = empresaId;
            if (inversionId) active.inversion_id = inversionId;

            router.get('/dashboard', active, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [empresaId, inversionId, filters]);

    function clearFilters() {
        setSearch('');
        setEmpresaId('');
        setInversionId('');
        setAsignacionFiltro('all');
    }

    const hasActiveFilters = !!(
        search ||
        empresaId ||
        inversionId ||
        asignacionFiltro !== 'all'
    );

    // --- Create form ---
    const createForm = useForm({
        patente: '',
        marca: '',
        modelo: '',
        anio: '',
        propietario: '',
        inversion_id: '' as string,
        empresa_id: '' as string,
        user_id: '' as string,
        fecha_vencimiento_vtv: '',
        fecha_vencimiento_gnc: '',
    });

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        createForm.post('/vehiculos', {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setIsCreateOpen(false);
            },
        });
    }

    // --- Create inversión form ---
    const inversionForm = useForm({ nombre: '' });

    function handleCreateInversion(e: React.FormEvent) {
        e.preventDefault();
        inversionForm.post('/inversiones', {
            preserveScroll: true,
            onSuccess: () => {
                inversionForm.reset();
                setIsCreateInversionOpen(false);
            },
        });
    }

    // --- Import form ---
    const importForm = useForm({
        file: null as File | null,
    });

    function handleImport(e: React.FormEvent) {
        e.preventDefault();
        importForm.post('/asignaciones/import', {
            preserveScroll: true,
            onSuccess: () => {
                importForm.reset();
                setIsImportOpen(false);
            },
        });
    }

    // --- Edit form ---
    const editForm = useForm({
        patente: '',
        marca: '',
        modelo: '',
        anio: '',
        propietario: '',
        inversion_id: '' as string,
        empresa_id: '' as string,
        user_id: '' as string,
        fecha_vencimiento_vtv: '',
        fecha_vencimiento_gnc: '',
    });

    function vtvStatus(
        dateStr?: string | null,
    ): 'ok' | 'warning' | 'expired' | null {
        if (!dateStr) {
            return null;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const datePart = dateStr.split('T')[0].split(' ')[0];
        const [year, month] = datePart.split('-').map(Number);
        const vtv = new Date(year, month, 0);
        vtv.setHours(0, 0, 0, 0);

        if (vtv < today) {
            return 'expired';
        }

        const oneMonth = new Date(today);
        oneMonth.setMonth(oneMonth.getMonth() + 1);

        if (vtv <= oneMonth) {
            return 'warning';
        }

        return 'ok';
    }

    function vtvColorClass(dateStr?: string | null): string {
        const status = vtvStatus(dateStr);

        switch (status) {
            case 'ok':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'warning':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
            case 'expired':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            default:
                return '';
        }
    }

    function formatVtv(dateStr?: string | null): string {
        if (!dateStr) return '';
        const datePart = dateStr.split('T')[0].split(' ')[0];
        const [year, month] = datePart.split('-');
        return `${month}/${year}`;
    }

    function openEdit(v: Vehiculo) {
        let formattedVtv = '';
        let formattedGnc = '';

        if (v.fecha_vencimiento_vtv) {
            formattedVtv = v.fecha_vencimiento_vtv
                .split('T')[0]
                .split(' ')[0]
                .slice(0, 7);
        }

        if (v.fecha_vencimiento_gnc) {
            formattedGnc = v.fecha_vencimiento_gnc
                .split('T')[0]
                .split(' ')[0]
                .slice(0, 7);
        }

        editForm.setData({
            patente: v.patente,
            marca: v.marca,
            modelo: v.modelo,
            anio: v.anio,
            propietario: v.propietario || '',
            inversion_id: String(v.inversion_id || ''),
            empresa_id: String(v.empresa_id || ''),
            user_id: String(v.user_id || ''),
            fecha_vencimiento_vtv: formattedVtv,
            fecha_vencimiento_gnc: formattedGnc,
        });
        setEditingVehiculo(v);
    }

    function handleEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!editingVehiculo) return;
        editForm.put(`/vehiculos/${editingVehiculo.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingVehiculo(null);
            },
        });
    }

    // --- Delete ---
    function handleDelete() {
        if (!deletingVehiculo) return;
        router.delete(`/vehiculos/${deletingVehiculo.id}`, {
            preserveScroll: true,
            onSuccess: () => setDeletingVehiculo(null),
        });
    }

    // --- Unassign ---
    function handleUnassign() {
        if (!unassigningVehiculo) return;
        router.patch(
            `/vehiculos/${unassigningVehiculo.id}/desasignar`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setUnassigningVehiculo(null),
            },
        );
    }

    return (
        <>
            <Head title="Vehículos" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                                Vehículos
                            </h1>
                            <span className="inline-flex items-center rounded-full border border-border/50 bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                {filteredVehiculos.length}{' '}
                                {filteredVehiculos.length === 1
                                    ? 'vehículo'
                                    : 'vehículos'}
                            </span>
                        </div>
                    </div>
                    {!isInversor && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const params = new URLSearchParams();
                                    if (empresaId) params.set('empresa_id', empresaId);
                                    if (inversionId) params.set('inversion_id', inversionId);
                                    if (search.trim()) params.set('search', search.trim());
                                    if (asignacionFiltro === 'con' || asignacionFiltro === 'sin') {
                                        params.set('asignacion', asignacionFiltro);
                                    }
                                    const qs = params.toString();
                                    window.open(
                                        `/pdf/vehiculos${qs ? `?${qs}` : ''}`,
                                        '_blank',
                                    );
                                }}
                            >
                                <FileDown className="h-4 w-4" />
                                <span className="ml-2 hidden sm:inline">
                                    Exportar PDF
                                </span>
                            </Button>
                            <Dialog
                                open={isImportOpen}
                                onOpenChange={setIsImportOpen}
                            >
                                {/* Botón "Importar Asignaciones" oculto */}
                                {false && (
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <FileUp className="h-4 w-4" />
                                            <span className="ml-2 hidden sm:inline">
                                                Importar Asignaciones
                                            </span>
                                        </Button>
                                    </DialogTrigger>
                                )}
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>
                                            Importar Asignaciones
                                        </DialogTitle>
                                        <DialogDescription>
                                            Sube un archivo Excel (.xlsx, .csv)
                                            con las columnas: patente, chofer,
                                            fecha_inicio, fecha_fin.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form
                                        onSubmit={handleImport}
                                        className="grid gap-4 py-4"
                                    >
                                        <div className="grid gap-2">
                                            <Label htmlFor="file">
                                                Archivo
                                            </Label>
                                            <Input
                                                id="file"
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                onChange={(e) =>
                                                    importForm.setData(
                                                        'file',
                                                        e.target.files?.[0] ||
                                                            null,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={importForm.errors.file}
                                            />
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <Button
                                                type="submit"
                                                disabled={
                                                    importForm.processing ||
                                                    !importForm.data.file
                                                }
                                            >
                                                {importForm.processing
                                                    ? 'Importando...'
                                                    : 'Importar'}
                                            </Button>
                                        </div>
                                    </form>
                                </DialogContent>
                            </Dialog>

                            {isAdmin && (
                                <Dialog
                                    open={isCreateInversionOpen}
                                    onOpenChange={(o) => {
                                        setIsCreateInversionOpen(o);
                                        if (!o) {
                                            inversionForm.reset();
                                            inversionForm.clearErrors();
                                        }
                                    }}
                                >
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <Wallet className="h-4 w-4" />
                                            <span className="ml-2 hidden sm:inline">
                                                Nueva Inversión
                                            </span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[420px]">
                                        <DialogHeader>
                                            <DialogTitle>Nueva inversión</DialogTitle>
                                            <DialogDescription>
                                                Se creará en la empresa activa
                                                {empresaActivaNombre ? ` (${empresaActivaNombre})` : ''}.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateInversion} className="grid gap-4 py-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="inversion_nombre">Nombre</Label>
                                                <Input
                                                    id="inversion_nombre"
                                                    type="text"
                                                    placeholder="Ej. Inversión 7"
                                                    value={inversionForm.data.nombre}
                                                    onChange={(e) => inversionForm.setData('nombre', e.target.value)}
                                                    autoFocus
                                                />
                                                <InputError message={inversionForm.errors.nombre} />
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => setIsCreateInversionOpen(false)}
                                                >
                                                    Cancelar
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={inversionForm.processing || inversionForm.data.nombre.trim() === ''}
                                                >
                                                    {inversionForm.processing ? 'Creando...' : 'Crear inversión'}
                                                </Button>
                                            </div>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}

                            <Dialog
                                open={isCreateOpen}
                                onOpenChange={setIsCreateOpen}
                            >
                                <DialogTrigger asChild>
                                    <Button size="sm">
                                        <Plus className="h-4 w-4" />
                                        <span className="hidden sm:inline">
                                            Registrar Vehículo
                                        </span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
                                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
                                            <Car className="h-5 w-5 text-sky-500" />
                                        </div>
                                        <div className="flex-1">
                                            <DialogTitle className="text-base font-semibold">Registrar vehículo</DialogTitle>
                                            <DialogDescription className="text-xs">
                                                Completá los datos del nuevo vehículo.
                                            </DialogDescription>
                                        </div>
                                    </div>
                                    <VehiculoForm
                                        form={createForm}
                                        onSubmit={handleCreate}
                                        onCancel={() => setIsCreateOpen(false)}
                                        empresas={empresas}
                                        inversiones={inversiones}
                                        users={users}
                                        submitLabel="Registrar vehículo"
                                    />
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>

                {/* Filtros */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        {/* Buscar */}
                        <div className="flex w-full flex-col gap-2 lg:min-w-[240px] lg:flex-1">
                            <Label htmlFor="search">Buscar</Label>
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="search"
                                    ref={searchRef}
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Patente o conductor..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value.toUpperCase());
                                        setHighlightedIndex(-1);
                                        setShowSearchDropdown(true);
                                    }}
                                    onKeyDown={handleSearchKeyDown}
                                    onFocus={() => setShowSearchDropdown(true)}
                                    onBlur={() =>
                                        setTimeout(
                                            () => setShowSearchDropdown(false),
                                            150,
                                        )
                                    }
                                    className="pl-9"
                                />
                                {showSearchDropdown &&
                                    suggestions.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                                            <div className="max-h-52 overflow-y-auto">
                                                {suggestions.map((s, idx) => (
                                                    <button
                                                        key={`${s.vehiculoId}-${idx}`}
                                                        type="button"
                                                        className={cn(
                                                            'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                                                            highlightedIndex ===
                                                                idx
                                                                ? 'bg-accent'
                                                                : 'hover:bg-accent/60',
                                                        )}
                                                        onMouseEnter={() =>
                                                            setHighlightedIndex(
                                                                idx,
                                                            )
                                                        }
                                                        onMouseDown={() =>
                                                            selectSuggestion(s)
                                                        }
                                                    >
                                                        <span className="font-medium">
                                                            {s.label}
                                                        </span>
                                                        <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                                                            {s.sub}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </div>

                        {/* Empresa */}
                        {!hideEmpresa && (
                            <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[150px]">
                                <Label htmlFor="empresa_filter">Empresa</Label>
                                <Select
                                    value={empresaId || 'all'}
                                    onValueChange={(v) =>
                                        setEmpresaId(v === 'all' ? '' : v)
                                    }
                                >
                                    <SelectTrigger
                                        id="empresa_filter"
                                        className="w-full lg:w-[180px]"
                                    >
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todas
                                        </SelectItem>
                                        {empresas.map((e) => (
                                            <SelectItem
                                                key={e.id}
                                                value={String(e.id)}
                                            >
                                                {e.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Inversión */}
                        <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[150px]">
                            <Label htmlFor="inversion_filter">Inversión</Label>
                            <Select
                                value={inversionId || 'all'}
                                onValueChange={(v) =>
                                    setInversionId(v === 'all' ? '' : v)
                                }
                            >
                                <SelectTrigger
                                    id="inversion_filter"
                                    className="w-full lg:w-[180px]"
                                >
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {inversiones.map((i) => (
                                        <SelectItem
                                            key={i.id}
                                            value={String(i.id)}
                                        >
                                            {i.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Conductor */}
                        <div className="flex w-full flex-col gap-2 lg:w-auto">
                            <Label>Conductor</Label>
                            <div className="flex h-9 gap-1.5">
                                {(
                                    [
                                        {
                                            val: 'all',
                                            label: 'Todos',
                                            icon: LayoutList,
                                        },
                                        {
                                            val: 'con',
                                            label: 'Asignado',
                                            icon: UserCheck,
                                        },
                                        {
                                            val: 'sin',
                                            label: 'Libre',
                                            icon: UserX,
                                        },
                                    ] as const
                                ).map(({ val, label, icon: Icon }) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setAsignacionFiltro(val)}
                                        className={cn(
                                            'flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] lg:flex-none',
                                            asignacionFiltro === val
                                                ? val === 'con'
                                                    ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                                                    : val === 'sin'
                                                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                      : 'border-primary/30 bg-primary/10 text-primary'
                                                : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Limpiar */}
                        <div className="flex w-full items-center justify-end lg:w-auto">
                            <button
                                type="button"
                                onClick={clearFilters}
                                disabled={!hasActiveFilters}
                                title="Limpiar filtros"
                                className={cn(
                                    'flex h-9 w-full items-center justify-center gap-2 rounded-lg border transition-all duration-150 lg:w-9 lg:px-0',
                                    hasActiveFilters
                                        ? 'border-border text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97]'
                                        : 'cursor-not-allowed border-border/40 text-muted-foreground/30',
                                )}
                            >
                                <X className="h-4 w-4" />
                                <span className="text-xs lg:hidden">
                                    Limpiar filtros
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabla + cards */}
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    {/* Desktop */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-sm text-muted-foreground">
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="w-[12%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Patente
                                    </th>
                                    <th className="w-[22%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Vehículo
                                    </th>
                                    {!hideEmpresa && (
                                        <th className="w-[18%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                            Empresa
                                        </th>
                                    )}
                                    <th className="w-[18%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Inversión
                                    </th>
                                    <th className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Conductor
                                    </th>
                                    <th className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        VTV
                                    </th>
                                    <th className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        GNC
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium tracking-wider sm:px-6 sm:py-4">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredVehiculos.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={hideEmpresa ? 7 : 8}
                                            className="px-4 py-12 text-center text-muted-foreground sm:px-6"
                                        >
                                            No hay vehículos que coincidan con
                                            los filtros.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredVehiculos.map((vehiculo) => (
                                        <tr
                                            key={vehiculo.id}
                                            className="bg-card transition-colors hover:bg-muted/40"
                                        >
                                            <td
                                                className="truncate px-4 py-3 font-semibold text-foreground sm:px-6 sm:py-4"
                                                title={vehiculo.patente}
                                            >
                                                {vehiculo.patente}
                                            </td>
                                            <td className="truncate px-4 py-3 sm:px-6 sm:py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground">
                                                        {vehiculo.marca}{' '}
                                                        {vehiculo.modelo}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Año: {vehiculo.anio}
                                                    </span>
                                                </div>
                                            </td>
                                            {!hideEmpresa && (
                                                <td className="truncate px-4 py-3 font-medium sm:px-6 sm:py-4">
                                                    {vehiculo.empresa?.nombre ? (
                                                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                                                            {
                                                                vehiculo.empresa
                                                                    .nombre
                                                            }
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">
                                                            Sin empresa
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="truncate px-4 py-3 font-medium sm:px-6 sm:py-4">
                                                {vehiculo.inversion?.nombre ? (
                                                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                                                        {
                                                            vehiculo.inversion
                                                                .nombre
                                                        }
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground italic">
                                                        Sin inversión
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                className="truncate px-4 py-3 sm:px-6 sm:py-4"
                                                title={
                                                    vehiculo.user?.name ||
                                                    'No asignado'
                                                }
                                            >
                                                {vehiculo.user?.name || (
                                                    <span className="text-muted-foreground italic">
                                                        No asignado
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs sm:px-6 sm:py-4">
                                                {vehiculo.fecha_vencimiento_vtv ? (
                                                    <span
                                                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${vtvColorClass(vehiculo.fecha_vencimiento_vtv)}`}
                                                    >
                                                        {formatVtv(
                                                            vehiculo.fecha_vencimiento_vtv,
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic">
                                                        N/A
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs sm:px-6 sm:py-4">
                                                {vehiculo.fecha_vencimiento_gnc ? (
                                                    <span
                                                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${vtvColorClass(vehiculo.fecha_vencimiento_gnc)}`}
                                                    >
                                                        {formatVtv(
                                                            vehiculo.fecha_vencimiento_gnc,
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic">
                                                        N/A
                                                    </span>
                                                )}
                                            </td>
                                            <td className="truncate px-4 py-3 text-right sm:px-6 sm:py-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">
                                                                Acciones
                                                            </span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>
                                                            Acciones
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                router.get(
                                                                    `/vehiculos/${vehiculo.id}/asignaciones`,
                                                                )
                                                            }
                                                        >
                                                            <History className="h-4 w-4" />
                                                            Historial
                                                            conductores
                                                        </DropdownMenuItem>
                                                        {!isInversor &&
                                                            vehiculo.user_id && (
                                                                <DropdownMenuItem
                                                                    onSelect={() =>
                                                                        setUnassigningVehiculo(
                                                                            vehiculo,
                                                                        )
                                                                    }
                                                                >
                                                                    <UserX className="h-4 w-4" />
                                                                    Desasignar
                                                                    conductor
                                                                </DropdownMenuItem>
                                                            )}
                                                        {!isInversor && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onSelect={() =>
                                                                        openEdit(
                                                                            vehiculo,
                                                                        )
                                                                    }
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onSelect={() =>
                                                                        setDeletingVehiculo(
                                                                            vehiculo,
                                                                        )
                                                                    }
                                                                    className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    Eliminar
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <ul className="divide-y divide-border md:hidden">
                        {filteredVehiculos.length === 0 ? (
                            <li className="px-4 py-12 text-center text-sm text-muted-foreground">
                                No hay vehículos que coincidan con los filtros.
                            </li>
                        ) : (
                            filteredVehiculos.map((vehiculo) => (
                                <li
                                    key={vehiculo.id}
                                    className="flex flex-col gap-2 p-4"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="font-mono text-base font-semibold text-foreground">
                                            {vehiculo.patente}
                                        </span>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="-mt-1 -mr-2 shrink-0"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">
                                                        Acciones
                                                    </span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>
                                                    Acciones
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        router.get(
                                                            `/vehiculos/${vehiculo.id}/asignaciones`,
                                                        )
                                                    }
                                                >
                                                    <History className="h-4 w-4" />
                                                    Historial conductores
                                                </DropdownMenuItem>
                                                {!isInversor &&
                                                    vehiculo.user_id && (
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                setUnassigningVehiculo(
                                                                    vehiculo,
                                                                )
                                                            }
                                                        >
                                                            <UserX className="h-4 w-4" />
                                                            Desasignar conductor
                                                        </DropdownMenuItem>
                                                    )}
                                                {!isInversor && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                openEdit(
                                                                    vehiculo,
                                                                )
                                                            }
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                setDeletingVehiculo(
                                                                    vehiculo,
                                                                )
                                                            }
                                                            className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Eliminar
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-foreground">
                                            {vehiculo.marca} {vehiculo.modelo}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Año: {vehiculo.anio}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {!hideEmpresa &&
                                            (vehiculo.empresa?.nombre ? (
                                                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                                                    {vehiculo.empresa.nombre}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">
                                                    Sin empresa
                                                </span>
                                            ))}
                                        {vehiculo.inversion?.nombre ? (
                                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                                                {vehiculo.inversion.nombre}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">
                                                Sin inversión
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Conductor:{' '}
                                        {vehiculo.user?.name ? (
                                            <span className="font-medium text-foreground">
                                                {vehiculo.user.name}
                                            </span>
                                        ) : (
                                            <span className="italic">
                                                No asignado
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        VTV:{' '}
                                        {vehiculo.fecha_vencimiento_vtv ? (
                                            <span
                                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${vtvColorClass(vehiculo.fecha_vencimiento_vtv)}`}
                                            >
                                                {formatVtv(
                                                    vehiculo.fecha_vencimiento_vtv,
                                                )}
                                            </span>
                                        ) : (
                                            <span className="italic">N/A</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        GNC:{' '}
                                        {vehiculo.fecha_vencimiento_gnc ? (
                                            <span
                                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${vtvColorClass(vehiculo.fecha_vencimiento_gnc)}`}
                                            >
                                                {formatVtv(
                                                    vehiculo.fecha_vencimiento_gnc,
                                                )}
                                            </span>
                                        ) : (
                                            <span className="italic">N/A</span>
                                        )}
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog
                open={editingVehiculo !== null}
                onOpenChange={(open) => !open && setEditingVehiculo(null)}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
                            <Car className="h-5 w-5 text-sky-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Editar vehículo</DialogTitle>
                            <DialogDescription className="text-xs">
                                {editingVehiculo?.patente} — {editingVehiculo?.marca} {editingVehiculo?.modelo}
                            </DialogDescription>
                        </div>
                    </div>
                    <VehiculoForm
                        form={editForm}
                        onSubmit={handleEdit}
                        onCancel={() => setEditingVehiculo(null)}
                        empresas={empresas}
                        inversiones={inversiones}
                        users={users}
                        submitLabel="Guardar cambios"
                    />
                </DialogContent>
            </Dialog>

            {/* Unassign Confirmation Dialog */}
            <Dialog
                open={unassigningVehiculo !== null}
                onOpenChange={(open) => !open && setUnassigningVehiculo(null)}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Desasignar Conductor</DialogTitle>
                        <DialogDescription>
                            ¿Está seguro que desea desasignar al conductor{' '}
                            <span className="font-semibold text-foreground">
                                {unassigningVehiculo?.user?.name}
                            </span>{' '}
                            del vehículo{' '}
                            <span className="font-semibold text-foreground">
                                {unassigningVehiculo?.patente}
                            </span>
                            ?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUnassigningVehiculo(null)}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleUnassign}>
                            Desasignar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation Dialog */}
            <Dialog
                open={deletingVehiculo !== null}
                onOpenChange={(open) => !open && setDeletingVehiculo(null)}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Eliminar Vehículo</DialogTitle>
                        <DialogDescription>
                            ¿Está seguro que desea eliminar el vehículo{' '}
                            <span className="font-semibold text-foreground">
                                {deletingVehiculo?.patente}
                            </span>
                            ? Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingVehiculo(null)}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

const MESES_VTV = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
];

function VtvMonthYearPicker({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const [yearPart, monthPart] = value ? value.split('-') : ['', ''];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 12 }, (_, i) => currentYear - 1 + i);

    const setMonth = (m: string) => {
        const y = yearPart || String(currentYear);
        onChange(`${y}-${m}`);
    };
    const setYear = (y: string) => {
        const m = monthPart || '01';
        onChange(`${y}-${m}`);
    };

    return (
        <div className="flex gap-2">
            <Select value={monthPart} onValueChange={setMonth}>
                <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                    {MESES_VTV.map((nombre, i) => (
                        <SelectItem
                            key={i}
                            value={String(i + 1).padStart(2, '0')}
                        >
                            {nombre}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={yearPart} onValueChange={setYear}>
                <SelectTrigger className="w-[110px]">
                    <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                    {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                            {y}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {value && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange('')}
                    aria-label="Limpiar VTV"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}

// --- Reusable form component for create & edit ---
interface VehiculoFormProps {
    form: ReturnType<
        typeof useForm<{
            patente: string;
            marca: string;
            modelo: string;
            anio: string;
            propietario: string;
            inversion_id: string;
            empresa_id: string;
            user_id: string;
            fecha_vencimiento_vtv: string;
            fecha_vencimiento_gnc: string;
        }>
    >;
    onSubmit: (e: React.FormEvent) => void;
    onCancel?: () => void;
    empresas: Pick<Empresa, 'id' | 'nombre'>[];
    inversiones: Pick<Inversion, 'id' | 'nombre'>[];
    users: Pick<User, 'id' | 'name'>[];
    submitLabel: string;
}

function VehiculoForm({
    form,
    onSubmit,
    onCancel,
    empresas,
    inversiones,
    users,
    submitLabel,
}: VehiculoFormProps) {
    const canSubmit =
        !form.processing &&
        form.data.patente.trim() !== '' &&
        form.data.marca.trim() !== '' &&
        form.data.modelo.trim() !== '' &&
        form.data.anio.trim() !== '' &&
        form.data.inversion_id !== '';

    const inversionOptions: ComboboxOption[] = inversiones.map((i) => ({
        value: String(i.id),
        label: i.nombre,
    }));

    const empresaOptions: ComboboxOption[] = empresas.map((e) => ({
        value: String(e.id),
        label: e.nombre,
    }));

    const userOptions: ComboboxOption[] = users.map((u) => ({
        value: String(u.id),
        label: u.name,
    }));

    return (
        <form onSubmit={onSubmit}>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-5">
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="patente">Patente</Label>
                    <Input
                        id="patente"
                        type="text"
                        placeholder="Ej. ABC123"
                        value={form.data.patente}
                        onChange={(e) => form.setData('patente', e.target.value.toUpperCase())}
                    />
                    <InputError message={form.errors.patente} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="anio">Año</Label>
                    <Input
                        id="anio"
                        type="text"
                        placeholder="Ej. 2024"
                        value={form.data.anio}
                        onChange={(e) => form.setData('anio', e.target.value)}
                    />
                    <InputError message={form.errors.anio} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="marca">Marca</Label>
                    <Input
                        id="marca"
                        type="text"
                        placeholder="Ej. Toyota"
                        value={form.data.marca}
                        onChange={(e) => form.setData('marca', e.target.value)}
                    />
                    <InputError message={form.errors.marca} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="modelo">Modelo</Label>
                    <Input
                        id="modelo"
                        type="text"
                        placeholder="Ej. Corolla"
                        value={form.data.modelo}
                        onChange={(e) => form.setData('modelo', e.target.value)}
                    />
                    <InputError message={form.errors.modelo} />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="propietario">Titular</Label>
                <Input
                    id="propietario"
                    type="text"
                    placeholder="Nombre del titular"
                    value={form.data.propietario}
                    onChange={(e) => form.setData('propietario', e.target.value)}
                />
                <InputError message={form.errors.propietario} />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="inversion_id">Inversión</Label>
                <Combobox
                    id="inversion_id"
                    placeholder="Buscar inversión..."
                    options={inversionOptions}
                    value={form.data.inversion_id}
                    onSelect={(o) => form.setData('inversion_id', o.value)}
                />
                <InputError message={form.errors.inversion_id} />
            </div>

            {empresaOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="empresa_id">Empresa</Label>
                    <Combobox
                        id="empresa_id"
                        placeholder="Buscar empresa..."
                        options={empresaOptions}
                        value={form.data.empresa_id}
                        onSelect={(o) => form.setData('empresa_id', o.value)}
                    />
                    <InputError message={form.errors.empresa_id} />
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="user_id">Conductor asignado</Label>
                <Combobox
                    id="user_id"
                    placeholder="Buscar conductor..."
                    options={userOptions}
                    value={form.data.user_id}
                    onSelect={(o) => form.setData('user_id', o.value)}
                />
                <InputError message={form.errors.user_id} />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label>Vencimiento VTV</Label>
                    <VtvMonthYearPicker
                        value={form.data.fecha_vencimiento_vtv}
                        onChange={(v) => form.setData('fecha_vencimiento_vtv', v)}
                    />
                    <InputError message={form.errors.fecha_vencimiento_vtv} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label>Vencimiento GNC</Label>
                    <VtvMonthYearPicker
                        value={form.data.fecha_vencimiento_gnc}
                        onChange={(v) => form.setData('fecha_vencimiento_gnc', v)}
                    />
                    <InputError message={form.errors.fecha_vencimiento_gnc} />
                </div>
            </div>

        </div>
        <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
            {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancelar
                </Button>
            )}
            <Button type="submit" disabled={!canSubmit}>
                {form.processing ? 'Procesando...' : <><Check className="h-4 w-4" /> {submitLabel}</>}
            </Button>
        </DialogFooter>
        </form>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Vehículos',
            href: '/dashboard',
        },
    ],
};
