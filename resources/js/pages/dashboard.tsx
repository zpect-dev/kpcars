import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Car,
    Check,
    ChevronDown,
    FileDown,
    FileUp,
    FileText,
    Filter,
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
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Combobox  } from '@/components/ui/combobox';
import type {ComboboxOption} from '@/components/ui/combobox';
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
import { MoneyInput } from '@/components/money-input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Empresa, Inversion, User, Vehiculo } from '@/types';
import {
    DocumentSection,
    DocSingleDropzone,
    DocPreviewDialog,
    type DocMode,
    type DocPreview,
} from '@/components/documentos';

type EstadoPatente = 'buen_estado' | 'mal_estado' | 'provisional' | 'no_posee' | null;

const ESTADO_PATENTE_OPCIONES: { value: Exclude<EstadoPatente, null>; label: string }[] = [
    { value: 'buen_estado', label: 'Buen estado' },
    { value: 'mal_estado', label: 'Mal estado' },
    { value: 'provisional', label: 'Provisional' },
    { value: 'no_posee', label: 'No posee' },
];

function estadoPatenteBadge(estado: EstadoPatente): { label: string; badge: string; dot: string } {
    switch (estado) {
        case 'buen_estado':
            return { label: 'Buen estado', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' };
        case 'mal_estado':
            return { label: 'Mal estado', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' };
        case 'provisional':
            return { label: 'Provisional', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' };
        case 'no_posee':
            return { label: 'No posee', badge: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300', dot: 'bg-zinc-500' };
        default:
            return { label: 'Sin estado', badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/40' };
    }
}

/**
 * Documentos del vehículo. Cédula y título están completos con un PDF o con
 * frente + dorso; el seguro con su archivo. "Falta" si no hay ninguna modalidad.
 */
function faltaCedula(v: Vehiculo): boolean {
    const c = v.documentos?.cedula;
    return !c?.pdf && !(c?.frente && c?.dorso);
}

function faltaTitulo(v: Vehiculo): boolean {
    const t = v.documentos?.titulo;
    return !t?.pdf && !(t?.frente && t?.dorso);
}

function faltaSeguroDoc(v: Vehiculo): boolean {
    return !v.documentos?.seguro?.archivo;
}

/** Al vehículo le falta al menos un documento (cédula, título o seguro). */
function faltaAlgunDocVehiculo(v: Vehiculo): boolean {
    return faltaCedula(v) || faltaTitulo(v) || faltaSeguroDoc(v);
}

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
        if (typeof window === 'undefined') {
return null;
}

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

    const [filterEstadoPatente, setFilterEstadoPatente] = useState('');
    const [filterTitular, setFilterTitular] = useState('');
    const [filterVtv, setFilterVtv] = useState('');
    const [filterGnc, setFilterGnc] = useState('');
    const [filterSeguro, setFilterSeguro] = useState('');
    const [filterDocs, setFilterDocs] = useState('');
    const [openFilterSection, setOpenFilterSection] = useState<Record<string, boolean>>({});

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
    const [estadoPatenteVehiculo, setEstadoPatenteVehiculo] = useState<Vehiculo | null>(null);

    // Modal de documentos del vehículo (cédula, título y seguro).
    const [docsVehiculo, setDocsVehiculo] = useState<Vehiculo | null>(null);
    const [cedulaMode, setCedulaMode] = useState<DocMode>('imagenes');
    const [tituloMode, setTituloMode] = useState<DocMode>('imagenes');
    const [docPreview, setDocPreview] = useState<DocPreview | null>(null);
    const docsForm = useForm({
        cedula_pdf: null as File | null,
        cedula_frente: null as File | null,
        cedula_dorso: null as File | null,
        titulo_pdf: null as File | null,
        titulo_frente: null as File | null,
        titulo_dorso: null as File | null,
        seguro: null as File | null,
        seguro_vencimiento: '' as string,
    });

    function openDocumentos(v: Vehiculo) {
        docsForm.reset();
        docsForm.clearErrors();
        docsForm.setData('seguro_vencimiento', v.seguro_vencimiento ? v.seguro_vencimiento.split('T')[0].split(' ')[0] : '');
        setCedulaMode(v.documentos?.cedula.pdf ? 'pdf' : 'imagenes');
        setTituloMode(v.documentos?.titulo.pdf ? 'pdf' : 'imagenes');
        setDocsVehiculo(v);
    }

    // Cambia la modalidad de un documento de doble cara y limpia los archivos
    // de la otra modalidad, para no enviar PDF e imágenes juntos.
    function applyDocMode(tipo: 'cedula' | 'titulo', setMode: (m: DocMode) => void, mode: DocMode) {
        setMode(mode);
        if (mode === 'pdf') {
            docsForm.setData(`${tipo}_frente`, null);
            docsForm.setData(`${tipo}_dorso`, null);
        } else {
            docsForm.setData(`${tipo}_pdf`, null);
        }
    }

    function handleDocsSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!docsVehiculo) return;
        docsForm.post(`/vehiculos/${docsVehiculo.id}/documentos`, {
            preserveScroll: true,
            onSuccess: () => setDocsVehiculo(null),
        });
    }

    function setEstadoPatente(estado: Exclude<EstadoPatente, null>) {
        if (!estadoPatenteVehiculo) {
return;
}

        router.patch(
            `/vehiculos/${estadoPatenteVehiculo.id}/estado-patente`,
            { estado_patente: estado },
            {
                preserveScroll: true,
                onSuccess: () => setEstadoPatenteVehiculo(null),
            },
        );
    }
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

        if (!q) {
return [];
}

        const results: { label: string; sub: string; vehiculoId: number }[] =
            [];
        const seen = new Set<number>();

        for (const v of vehiculos) {
            if (seen.has(v.id)) {
continue;
}

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

        if (asignacionFiltro === 'con') result = result.filter((v) => !!v.user_id);
        if (asignacionFiltro === 'sin') result = result.filter((v) => !v.user_id);

        if (filterEstadoPatente === '__none__') result = result.filter((v) => !v.estado_patente);
        else if (filterEstadoPatente) result = result.filter((v) => v.estado_patente === filterEstadoPatente);

        if (filterTitular.trim()) result = result.filter((v) => v.propietario?.toLowerCase().includes(filterTitular.toLowerCase()));

        if (filterVtv === 'none') result = result.filter((v) => !v.fecha_vencimiento_vtv);
        else if (filterVtv) result = result.filter((v) => !!v.fecha_vencimiento_vtv && vtvStatus(v.fecha_vencimiento_vtv) === filterVtv);

        if (filterGnc === 'none') result = result.filter((v) => !v.fecha_vencimiento_gnc);
        else if (filterGnc) result = result.filter((v) => !!v.fecha_vencimiento_gnc && vtvStatus(v.fecha_vencimiento_gnc) === filterGnc);

        if (filterSeguro === 'none') result = result.filter((v) => !v.seguro_vencimiento);
        else if (filterSeguro) result = result.filter((v) => !!v.seguro_vencimiento && seguroStatus(v.seguro_vencimiento) === filterSeguro);

        if (filterDocs === 'faltan') result = result.filter(faltaAlgunDocVehiculo);
        else if (filterDocs === 'cedula') result = result.filter(faltaCedula);
        else if (filterDocs === 'titulo') result = result.filter(faltaTitulo);
        else if (filterDocs === 'seguro') result = result.filter(faltaSeguroDoc);

        return result;
    }, [vehiculos, search, asignacionFiltro, filterEstadoPatente, filterTitular, filterVtv, filterGnc, filterSeguro, filterDocs]);

    function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!showSearchDropdown || suggestions.length === 0) {
return;
}

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

        if (!hasChanges) {
return;
}

        const timeoutId = setTimeout(() => {
            const active: Record<string, string> = {};

            if (empresaId) {
active.empresa_id = empresaId;
}

            if (inversionId) {
active.inversion_id = inversionId;
}

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
        setFilterEstadoPatente('');
        setFilterTitular('');
        setFilterVtv('');
        setFilterGnc('');
        setFilterSeguro('');
        setFilterDocs('');
        setOpenFilterSection({});
    }

    const hasActiveFilters = !!(
        search || empresaId || inversionId || asignacionFiltro !== 'all' ||
        filterEstadoPatente || filterTitular || filterVtv || filterGnc || filterSeguro || filterDocs
    );

    const advancedFilterCount = [filterEstadoPatente, filterTitular, filterVtv, filterGnc, filterSeguro, filterDocs].filter(Boolean).length;

    const vCounts = useMemo(() => ({
        estadoPatente: {
            __none__:    vehiculos.filter((v) => !v.estado_patente).length,
            buen_estado: vehiculos.filter((v) => v.estado_patente === 'buen_estado').length,
            mal_estado:  vehiculos.filter((v) => v.estado_patente === 'mal_estado').length,
            provisional: vehiculos.filter((v) => v.estado_patente === 'provisional').length,
            no_posee:    vehiculos.filter((v) => v.estado_patente === 'no_posee').length,
        },
        vtv: {
            ok:      vehiculos.filter((v) => v.fecha_vencimiento_vtv && vtvStatus(v.fecha_vencimiento_vtv) === 'ok').length,
            warning: vehiculos.filter((v) => v.fecha_vencimiento_vtv && vtvStatus(v.fecha_vencimiento_vtv) === 'warning').length,
            expired: vehiculos.filter((v) => v.fecha_vencimiento_vtv && vtvStatus(v.fecha_vencimiento_vtv) === 'expired').length,
            none:    vehiculos.filter((v) => !v.fecha_vencimiento_vtv).length,
        },
        gnc: {
            ok:      vehiculos.filter((v) => v.fecha_vencimiento_gnc && vtvStatus(v.fecha_vencimiento_gnc) === 'ok').length,
            warning: vehiculos.filter((v) => v.fecha_vencimiento_gnc && vtvStatus(v.fecha_vencimiento_gnc) === 'warning').length,
            expired: vehiculos.filter((v) => v.fecha_vencimiento_gnc && vtvStatus(v.fecha_vencimiento_gnc) === 'expired').length,
            none:    vehiculos.filter((v) => !v.fecha_vencimiento_gnc).length,
        },
        seguro: {
            ok:      vehiculos.filter((v) => v.seguro_vencimiento && seguroStatus(v.seguro_vencimiento) === 'ok').length,
            warning: vehiculos.filter((v) => v.seguro_vencimiento && seguroStatus(v.seguro_vencimiento) === 'warning').length,
            expired: vehiculos.filter((v) => v.seguro_vencimiento && seguroStatus(v.seguro_vencimiento) === 'expired').length,
            none:    vehiculos.filter((v) => !v.seguro_vencimiento).length,
        },
        docs: {
            faltan: vehiculos.filter(faltaAlgunDocVehiculo).length,
            cedula: vehiculos.filter(faltaCedula).length,
            titulo: vehiculos.filter(faltaTitulo).length,
            seguro: vehiculos.filter(faltaSeguroDoc).length,
        },
    }), [vehiculos]);

    // --- Create form ---
    const createForm = useForm({
        patente: '',
        marca: '',
        modelo: '',
        anio: '',
        propietario: '',
        precio: '360000',
        inversion_id: '' as string,
        empresa_id: '' as string,
        user_id: '' as string,
        fecha_vencimiento_vtv: '',
        fecha_vencimiento_gnc: '',
        estado_patente: '' as string,
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
        precio: '360000',
        inversion_id: '' as string,
        empresa_id: '' as string,
        user_id: '' as string,
        fecha_vencimiento_vtv: '',
        fecha_vencimiento_gnc: '',
        estado_patente: '' as string,
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
        if (!dateStr) {
return '';
}

        const datePart = dateStr.split('T')[0].split(' ')[0];
        const [year, month] = datePart.split('-');

        return `${month}/${year}`;
    }

    // El seguro vence en una fecha exacta (no mes/año como VTV/GNC).
    function seguroStatus(dateStr?: string | null): 'ok' | 'warning' | 'expired' | null {
        if (!dateStr) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const datePart = dateStr.split('T')[0].split(' ')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        const venc = new Date(year, month - 1, day);
        venc.setHours(0, 0, 0, 0);

        if (venc < today) return 'expired';
        const oneMonth = new Date(today);
        oneMonth.setMonth(oneMonth.getMonth() + 1);
        if (venc <= oneMonth) return 'warning';
        return 'ok';
    }

    function seguroColorClass(dateStr?: string | null): string {
        switch (seguroStatus(dateStr)) {
            case 'ok':      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'warning': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
            case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            default:        return '';
        }
    }

    function formatSeguro(dateStr?: string | null): string {
        if (!dateStr) return '';
        const datePart = dateStr.split('T')[0].split(' ')[0];
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
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
            precio: v.precio != null ? String(v.precio) : '360000',
            inversion_id: String(v.inversion_id || ''),
            empresa_id: String(v.empresa_id || ''),
            user_id: String(v.user_id || ''),
            fecha_vencimiento_vtv: formattedVtv,
            fecha_vencimiento_gnc: formattedGnc,
            estado_patente: v.estado_patente ?? '',
        });
        setEditingVehiculo(v);
    }

    function handleEdit(e: React.FormEvent) {
        e.preventDefault();

        if (!editingVehiculo) {
return;
}

        editForm.put(`/vehiculos/${editingVehiculo.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingVehiculo(null);
            },
        });
    }

    // --- Delete ---
    function handleDelete() {
        if (!deletingVehiculo) {
return;
}

        router.delete(`/vehiculos/${deletingVehiculo.id}`, {
            preserveScroll: true,
            onSuccess: () => setDeletingVehiculo(null),
        });
    }

    // --- Unassign ---
    function handleUnassign() {
        if (!unassigningVehiculo) {
return;
}

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

                                    if (empresaId) {
params.set('empresa_id', empresaId);
}

                                    if (inversionId) {
params.set('inversion_id', inversionId);
}

                                    if (search.trim()) {
params.set('search', search.trim());
}

                                    if (asignacionFiltro === 'con' || asignacionFiltro === 'sin') {
                                        params.set('asignacion', asignacionFiltro);
                                    }

                                    if (filterEstadoPatente) {
                                        params.set('estado_patente', filterEstadoPatente);
                                    }

                                    if (filterTitular.trim()) {
                                        params.set('titular', filterTitular.trim());
                                    }

                                    if (filterVtv) {
                                        params.set('vtv', filterVtv);
                                    }

                                    if (filterGnc) {
                                        params.set('gnc', filterGnc);
                                    }

                                    if (filterSeguro) {
                                        params.set('seguro', filterSeguro);
                                    }

                                    if (filterDocs) {
                                        params.set('docs', filterDocs);
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
                                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[425px]">
                                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                                            <FileUp className="h-5 w-5 text-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <DialogTitle className="text-base font-semibold">Importar asignaciones</DialogTitle>
                                            <DialogDescription className="text-xs">Sube un archivo Excel (.xlsx, .csv) con las columnas: patente, chofer, fecha_inicio, fecha_fin.</DialogDescription>
                                        </div>
                                    </div>
                                    <form onSubmit={handleImport} className="flex flex-col gap-4 px-5 py-5">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="file">Archivo</Label>
                                            <Input
                                                id="file"
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                onChange={(e) => importForm.setData('file', e.target.files?.[0] || null)}
                                            />
                                            <InputError message={importForm.errors.file} />
                                        </div>
                                        <div className="flex justify-end">
                                            <Button type="submit" disabled={importForm.processing || !importForm.data.file}>
                                                {importForm.processing ? 'Importando...' : 'Importar'}
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
                                    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
                                        <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                                                <Wallet className="h-5 w-5 text-emerald-500" />
                                            </div>
                                            <div className="flex-1">
                                                <DialogTitle className="text-base font-semibold">Nueva inversión</DialogTitle>
                                                <DialogDescription className="text-xs">
                                                    Se creará en la empresa activa{empresaActivaNombre ? ` (${empresaActivaNombre})` : ''}.
                                                </DialogDescription>
                                            </div>
                                        </div>
                                        <form onSubmit={handleCreateInversion} className="flex flex-col gap-4 px-5 py-5">
                                            <div className="flex flex-col gap-1.5">
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
                                                <Button type="button" variant="outline" onClick={() => setIsCreateInversionOpen(false)}>Cancelar</Button>
                                                <Button type="submit" disabled={inversionForm.processing || inversionForm.data.nombre.trim() === ''}>
                                                    {inversionForm.processing ? 'Creando...' : 'Crear inversión'}
                                                </Button>
                                            </div>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}

                            <Dialog
                                open={isCreateOpen}
                                onOpenChange={(o) => { setIsCreateOpen(o); if (!o) createForm.reset(); }}
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
                    <div className="flex flex-wrap items-end gap-3">
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
                                    onBlur={() => setTimeout(() => setShowSearchDropdown(false), 150)}
                                    className="pl-9"
                                />
                                {showSearchDropdown && suggestions.length > 0 && (
                                    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                                        <div className="max-h-52 overflow-y-auto">
                                            {suggestions.map((s, idx) => (
                                                <button
                                                    key={`${s.vehiculoId}-${idx}`}
                                                    type="button"
                                                    className={cn(
                                                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                                                        highlightedIndex === idx ? 'bg-accent' : 'hover:bg-accent/60',
                                                    )}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    onMouseDown={() => selectSuggestion(s)}
                                                >
                                                    <span className="font-medium">{s.label}</span>
                                                    <span className="ml-4 shrink-0 text-xs text-muted-foreground">{s.sub}</span>
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
                                <Select value={empresaId || 'all'} onValueChange={(v) => setEmpresaId(v === 'all' ? '' : v)}>
                                    <SelectTrigger id="empresa_filter" className="w-full lg:w-[180px]">
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {empresas.map((e) => (
                                            <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Inversión */}
                        <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[150px]">
                            <Label htmlFor="inversion_filter">Inversión</Label>
                            <Select value={inversionId || 'all'} onValueChange={(v) => setInversionId(v === 'all' ? '' : v)}>
                                <SelectTrigger id="inversion_filter" className="w-full lg:w-[180px]">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {inversiones.map((i) => (
                                        <SelectItem key={i.id} value={String(i.id)}>{i.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Conductor + Filtrar + Limpiar */}
                        <div className="flex w-full flex-col gap-2 lg:w-auto">
                            <Label>Conductor</Label>
                            <div className="flex h-9 gap-1.5">
                                {([
                                    { val: 'all', label: 'Todos', icon: LayoutList },
                                    { val: 'con', label: 'Asignado', icon: UserCheck },
                                    { val: 'sin', label: 'Libre', icon: UserX },
                                ] as const).map(({ val, label, icon: Icon }) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setAsignacionFiltro(val)}
                                        className={cn(
                                            'flex h-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                                            asignacionFiltro === val
                                                ? val === 'con' ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                                                : val === 'sin' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                : 'border-primary/30 bg-primary/10 text-primary'
                                                : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        {label}
                                    </button>
                                ))}

                                <div className="h-full w-px bg-border/60" />

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                'flex h-full items-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                                                advancedFilterCount > 0
                                                    ? 'border-border bg-muted text-foreground shadow-sm'
                                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            <Filter className="h-3.5 w-3.5 shrink-0" />
                                            <span className="hidden sm:inline">Filtrar</span>
                                            {advancedFilterCount > 0 && (
                                                <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                                            )}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-72 p-0 shadow-lg">

                                        {/* Titular */}
                                        <div className="p-1.5 border-b border-border">
                                            <div className="flex items-center gap-2 rounded-lg px-2.5 py-2">
                                                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por titular..."
                                                    value={filterTitular}
                                                    onChange={(e) => setFilterTitular(e.target.value)}
                                                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                                                />
                                                {filterTitular && (
                                                    <button type="button" onClick={() => setFilterTitular('')} className="text-muted-foreground hover:text-foreground">
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Estado de patente */}
                                        <div className="border-b border-border">
                                            <button
                                                type="button"
                                                onClick={() => setOpenFilterSection((s) => ({ ...s, estado: !s.estado }))}
                                                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground">Estado de patente</span>
                                                    {filterEstadoPatente && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                                                </div>
                                                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openFilterSection.estado && 'rotate-180')} />
                                            </button>
                                            {openFilterSection.estado && (
                                                <div className="px-1.5 pb-1.5">
                                                    {[
                                                        { value: '__none__',    label: 'Sin estado',   desc: 'Sin estado registrado',   count: vCounts.estadoPatente.__none__ },
                                                        { value: 'buen_estado', label: 'Buen estado',  desc: 'Patente en buen estado',  count: vCounts.estadoPatente.buen_estado },
                                                        { value: 'mal_estado',  label: 'Mal estado',   desc: 'Patente deteriorada',     count: vCounts.estadoPatente.mal_estado },
                                                        { value: 'provisional', label: 'Provisional',  desc: 'Patente provisional',     count: vCounts.estadoPatente.provisional },
                                                        { value: 'no_posee',    label: 'No posee',     desc: 'Sin patente física',      count: vCounts.estadoPatente.no_posee },
                                                    ].map((opt) => {
                                                        const isActive = filterEstadoPatente === opt.value;
                                                        return (
                                                            <button key={opt.value} type="button" onClick={() => setFilterEstadoPatente(isActive ? '' : opt.value)}
                                                                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', isActive ? 'bg-muted' : 'hover:bg-muted/60')}
                                                            >
                                                                <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', isActive ? 'border-foreground bg-foreground' : 'border-border bg-transparent')}>
                                                                    {isActive && <Check className="h-3 w-3 text-background" />}
                                                                </div>
                                                                <div className="flex min-w-0 flex-1 flex-col">
                                                                    <span className={cn('text-sm leading-tight', isActive ? 'font-semibold text-foreground' : 'text-foreground')}>{opt.label}</span>
                                                                    <span className="mt-0.5 text-xs leading-tight text-muted-foreground">{opt.desc}</span>
                                                                </div>
                                                                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', isActive ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground')}>{opt.count}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* VTV */}
                                        <div className="border-b border-border">
                                            <button
                                                type="button"
                                                onClick={() => setOpenFilterSection((s) => ({ ...s, vtv: !s.vtv }))}
                                                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground">VTV</span>
                                                    {filterVtv && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                                                </div>
                                                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openFilterSection.vtv && 'rotate-180')} />
                                            </button>
                                            {openFilterSection.vtv && (
                                                <div className="px-1.5 pb-1.5">
                                                    {[
                                                        { value: 'ok',      label: 'Vigente',      desc: 'Vence en más de 1 mes',         count: vCounts.vtv.ok },
                                                        { value: 'warning', label: 'Por vencer',   desc: 'Vence en los próximos 30 días', count: vCounts.vtv.warning },
                                                        { value: 'expired', label: 'Vencida',      desc: 'VTV ya expirada',               count: vCounts.vtv.expired },
                                                        { value: 'none',    label: 'Sin registro', desc: 'Sin fecha de VTV cargada',      count: vCounts.vtv.none },
                                                    ].map((opt) => {
                                                        const isActive = filterVtv === opt.value;
                                                        return (
                                                            <button key={opt.value} type="button" onClick={() => setFilterVtv(isActive ? '' : opt.value)}
                                                                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', isActive ? 'bg-muted' : 'hover:bg-muted/60')}
                                                            >
                                                                <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', isActive ? 'border-foreground bg-foreground' : 'border-border bg-transparent')}>
                                                                    {isActive && <Check className="h-3 w-3 text-background" />}
                                                                </div>
                                                                <div className="flex min-w-0 flex-1 flex-col">
                                                                    <span className={cn('text-sm leading-tight', isActive ? 'font-semibold text-foreground' : 'text-foreground')}>{opt.label}</span>
                                                                    <span className="mt-0.5 text-xs leading-tight text-muted-foreground">{opt.desc}</span>
                                                                </div>
                                                                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', isActive ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground')}>{opt.count}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* GNC */}
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => setOpenFilterSection((s) => ({ ...s, gnc: !s.gnc }))}
                                                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground">GNC</span>
                                                    {filterGnc && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                                                </div>
                                                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openFilterSection.gnc && 'rotate-180')} />
                                            </button>
                                            {openFilterSection.gnc && (
                                                <div className="px-1.5 pb-1.5">
                                                    {[
                                                        { value: 'ok',      label: 'Vigente',      desc: 'Vence en más de 1 mes',         count: vCounts.gnc.ok },
                                                        { value: 'warning', label: 'Por vencer',   desc: 'Vence en los próximos 30 días', count: vCounts.gnc.warning },
                                                        { value: 'expired', label: 'Vencida',      desc: 'GNC ya expirado',               count: vCounts.gnc.expired },
                                                        { value: 'none',    label: 'Sin registro', desc: 'Sin fecha de GNC cargada',      count: vCounts.gnc.none },
                                                    ].map((opt) => {
                                                        const isActive = filterGnc === opt.value;
                                                        return (
                                                            <button key={opt.value} type="button" onClick={() => setFilterGnc(isActive ? '' : opt.value)}
                                                                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', isActive ? 'bg-muted' : 'hover:bg-muted/60')}
                                                            >
                                                                <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', isActive ? 'border-foreground bg-foreground' : 'border-border bg-transparent')}>
                                                                    {isActive && <Check className="h-3 w-3 text-background" />}
                                                                </div>
                                                                <div className="flex min-w-0 flex-1 flex-col">
                                                                    <span className={cn('text-sm leading-tight', isActive ? 'font-semibold text-foreground' : 'text-foreground')}>{opt.label}</span>
                                                                    <span className="mt-0.5 text-xs leading-tight text-muted-foreground">{opt.desc}</span>
                                                                </div>
                                                                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', isActive ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground')}>{opt.count}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Seguro */}
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => setOpenFilterSection((s) => ({ ...s, seguro: !s.seguro }))}
                                                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground">Seguro</span>
                                                    {filterSeguro && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                                                </div>
                                                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openFilterSection.seguro && 'rotate-180')} />
                                            </button>
                                            {openFilterSection.seguro && (
                                                <div className="px-1.5 pb-1.5">
                                                    {[
                                                        { value: 'ok',      label: 'Vigente',      desc: 'Vence en más de 1 mes',         count: vCounts.seguro.ok },
                                                        { value: 'warning', label: 'Por vencer',   desc: 'Vence en los próximos 30 días', count: vCounts.seguro.warning },
                                                        { value: 'expired', label: 'Vencido',      desc: 'Seguro ya expirado',            count: vCounts.seguro.expired },
                                                        { value: 'none',    label: 'Sin registro', desc: 'Sin fecha de seguro cargada',   count: vCounts.seguro.none },
                                                    ].map((opt) => {
                                                        const isActive = filterSeguro === opt.value;
                                                        return (
                                                            <button key={opt.value} type="button" onClick={() => setFilterSeguro(isActive ? '' : opt.value)}
                                                                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', isActive ? 'bg-muted' : 'hover:bg-muted/60')}
                                                            >
                                                                <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', isActive ? 'border-foreground bg-foreground' : 'border-border bg-transparent')}>
                                                                    {isActive && <Check className="h-3 w-3 text-background" />}
                                                                </div>
                                                                <div className="flex min-w-0 flex-1 flex-col">
                                                                    <span className={cn('text-sm leading-tight', isActive ? 'font-semibold text-foreground' : 'text-foreground')}>{opt.label}</span>
                                                                    <span className="mt-0.5 text-xs leading-tight text-muted-foreground">{opt.desc}</span>
                                                                </div>
                                                                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', isActive ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground')}>{opt.count}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Documentos (archivos: cédula, título, seguro) */}
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => setOpenFilterSection((s) => ({ ...s, docs: !s.docs }))}
                                                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground">Documentos</span>
                                                    {filterDocs && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                                                </div>
                                                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openFilterSection.docs && 'rotate-180')} />
                                            </button>
                                            {openFilterSection.docs && (
                                                <div className="px-1.5 pb-1.5">
                                                    {[
                                                        { value: 'faltan', label: 'Faltan documentos', desc: 'Le falta la cédula, el título o el seguro', count: vCounts.docs.faltan },
                                                        { value: 'cedula', label: 'Sin cédula',        desc: 'Sin PDF ni frente/dorso de la cédula',     count: vCounts.docs.cedula },
                                                        { value: 'titulo', label: 'Sin título',        desc: 'Sin PDF ni frente/dorso del título',       count: vCounts.docs.titulo },
                                                        { value: 'seguro', label: 'Sin seguro',        desc: 'Sin archivo de seguro cargado',            count: vCounts.docs.seguro },
                                                    ].map((opt) => {
                                                        const isActive = filterDocs === opt.value;
                                                        return (
                                                            <button key={opt.value} type="button" onClick={() => setFilterDocs(isActive ? '' : opt.value)}
                                                                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', isActive ? 'bg-muted' : 'hover:bg-muted/60')}
                                                            >
                                                                <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', isActive ? 'border-foreground bg-foreground' : 'border-border bg-transparent')}>
                                                                    {isActive && <Check className="h-3 w-3 text-background" />}
                                                                </div>
                                                                <div className="flex min-w-0 flex-1 flex-col">
                                                                    <span className={cn('text-sm leading-tight', isActive ? 'font-semibold text-foreground' : 'text-foreground')}>{opt.label}</span>
                                                                    <span className="mt-0.5 text-xs leading-tight text-muted-foreground">{opt.desc}</span>
                                                                </div>
                                                                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', isActive ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground')}>{opt.count}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                    </PopoverContent>
                                </Popover>

                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    disabled={!hasActiveFilters}
                                    title="Limpiar filtros"
                                    className={cn(
                                        'flex h-full w-9 items-center justify-center rounded-lg border transition-all duration-150',
                                        hasActiveFilters
                                            ? 'border-border text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97]'
                                            : 'cursor-not-allowed border-border/40 text-muted-foreground/30',
                                    )}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
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
                                    <th className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Seguro
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
                                            colSpan={hideEmpresa ? 8 : 9}
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
                                            onClick={() => !isInversor && openEdit(vehiculo)}
                                            className={cn('bg-card transition-colors hover:bg-muted/40', !isInversor && 'cursor-pointer')}
                                        >
                                            <td
                                                className="truncate px-4 py-3 font-semibold text-foreground sm:px-6 sm:py-4"
                                                title={vehiculo.patente}
                                            >
                                                <div className="flex flex-col items-start gap-1">
                                                    <span>{vehiculo.patente}</span>
                                                    {vehiculo.estado_patente && (() => {
                                                        const b = estadoPatenteBadge(vehiculo.estado_patente);

                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setEstadoPatenteVehiculo(vehiculo); }}
                                                                title="Editar estado de la patente"
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80',
                                                                    b.badge,
                                                                )}
                                                            >
                                                                <span className={cn('h-1 w-1 rounded-full', b.dot)} />
                                                                Patente: {b.label}
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
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
                                            <td className="px-4 py-3 text-xs sm:px-6 sm:py-4">
                                                {vehiculo.seguro_vencimiento ? (
                                                    <span
                                                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${seguroColorClass(vehiculo.seguro_vencimiento)}`}
                                                    >
                                                        {formatSeguro(
                                                            vehiculo.seguro_vencimiento,
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic">
                                                        N/A
                                                    </span>
                                                )}
                                            </td>
                                            <td className="truncate px-4 py-3 text-right sm:px-6 sm:py-4" onClick={(e) => e.stopPropagation()}>
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
                                    onClick={() => !isInversor && openEdit(vehiculo)}
                                    className={cn('flex flex-col gap-2 p-4', !isInversor && 'cursor-pointer hover:bg-muted/40 transition-colors')}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="font-mono text-base font-semibold text-foreground">
                                                {vehiculo.patente}
                                            </span>
                                            {vehiculo.estado_patente && (() => {
                                                const b = estadoPatenteBadge(vehiculo.estado_patente);

                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setEstadoPatenteVehiculo(vehiculo); }}
                                                        title="Editar estado de la patente"
                                                        className={cn(
                                                            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80',
                                                            b.badge,
                                                        )}
                                                    >
                                                        <span className={cn('h-1 w-1 rounded-full', b.dot)} />
                                                        Patente: {b.label}
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="-mt-1 -mr-2 shrink-0"
                                                    onClick={(e) => e.stopPropagation()}
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
                                    <div className="text-xs text-muted-foreground">
                                        Seguro:{' '}
                                        {vehiculo.seguro_vencimiento ? (
                                            <span
                                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${seguroColorClass(vehiculo.seguro_vencimiento)}`}
                                            >
                                                {formatSeguro(
                                                    vehiculo.seguro_vencimiento,
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
                onOpenChange={(open) => { if (!open) { setEditingVehiculo(null); editForm.reset(); } }}
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
                        onDocumentos={editingVehiculo ? () => openDocumentos(editingVehiculo) : undefined}
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
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                            <UserX className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Desasignar conductor</DialogTitle>
                            <DialogDescription className="text-xs">
                                Se desvinculará a <span className="font-semibold text-foreground">{unassigningVehiculo?.user?.name}</span> del vehículo <span className="font-semibold text-foreground">{unassigningVehiculo?.patente}</span>.
                            </DialogDescription>
                        </div>
                    </div>
                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button variant="outline" onClick={() => setUnassigningVehiculo(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleUnassign}>Desasignar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation Dialog */}
            <Dialog
                open={deletingVehiculo !== null}
                onOpenChange={(open) => !open && setDeletingVehiculo(null)}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                            <Trash2 className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Eliminar vehículo</DialogTitle>
                            <DialogDescription className="text-xs">
                                Se eliminará <span className="font-semibold text-foreground">{deletingVehiculo?.patente}</span> permanentemente. Esta acción no se puede deshacer.
                            </DialogDescription>
                        </div>
                    </div>
                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button variant="outline" onClick={() => setDeletingVehiculo(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Estado de la patente Dialog */}
            <Dialog
                open={estadoPatenteVehiculo !== null}
                onOpenChange={(open) => !open && setEstadoPatenteVehiculo(null)}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[360px]">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
                            <Car className="h-5 w-5 text-sky-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Estado de la patente</DialogTitle>
                            <DialogDescription className="text-xs">
                                {estadoPatenteVehiculo?.patente} — {estadoPatenteVehiculo?.marca} {estadoPatenteVehiculo?.modelo}
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 p-4">
                        {ESTADO_PATENTE_OPCIONES.map((opt) => {
                            const b = estadoPatenteBadge(opt.value);
                            const selected = estadoPatenteVehiculo?.estado_patente === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setEstadoPatente(opt.value)}
                                    className={cn(
                                        'flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all',
                                        selected
                                            ? 'border-primary bg-primary/10 text-foreground'
                                            : 'border-border bg-card text-muted-foreground hover:bg-muted',
                                    )}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <span className={cn('h-2 w-2 rounded-full', b.dot)} />
                                        {opt.label}
                                    </span>
                                    {selected && <Check className="h-4 w-4 text-primary" />}
                                </button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Documentos del vehículo */}
            <Dialog
                open={docsVehiculo !== null}
                onOpenChange={(open) => { if (!open) { setDocsVehiculo(null); docsForm.reset(); } }}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
                            <FileText className="h-5 w-5 text-sky-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Documentos del vehículo</DialogTitle>
                            <DialogDescription className="text-xs">
                                {docsVehiculo?.patente} — {docsVehiculo?.marca} {docsVehiculo?.modelo}
                            </DialogDescription>
                        </div>
                    </div>

                    <form onSubmit={handleDocsSubmit}>
                        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-5">
                            <DocumentSection
                                title="Cédula"
                                mode={cedulaMode}
                                onModeChange={(m) => applyDocMode('cedula', setCedulaMode, m)}
                                pdfFile={docsForm.data.cedula_pdf}
                                onPdfDrop={(f) => docsForm.setData('cedula_pdf', f[0])}
                                frenteFile={docsForm.data.cedula_frente}
                                onFrenteDrop={(f) => docsForm.setData('cedula_frente', f[0])}
                                dorsoFile={docsForm.data.cedula_dorso}
                                onDorsoDrop={(f) => docsForm.setData('cedula_dorso', f[0])}
                                existing={docsVehiculo?.documentos?.cedula}
                                onPreview={(url, name, type) => setDocPreview({ url, name, type })}
                                error={docsForm.errors.cedula_pdf || docsForm.errors.cedula_frente || docsForm.errors.cedula_dorso}
                            />
                            <DocumentSection
                                title="Título"
                                mode={tituloMode}
                                onModeChange={(m) => applyDocMode('titulo', setTituloMode, m)}
                                pdfFile={docsForm.data.titulo_pdf}
                                onPdfDrop={(f) => docsForm.setData('titulo_pdf', f[0])}
                                frenteFile={docsForm.data.titulo_frente}
                                onFrenteDrop={(f) => docsForm.setData('titulo_frente', f[0])}
                                dorsoFile={docsForm.data.titulo_dorso}
                                onDorsoDrop={(f) => docsForm.setData('titulo_dorso', f[0])}
                                existing={docsVehiculo?.documentos?.titulo}
                                onPreview={(url, name, type) => setDocPreview({ url, name, type })}
                                error={docsForm.errors.titulo_pdf || docsForm.errors.titulo_frente || docsForm.errors.titulo_dorso}
                            />

                            <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
                                <span className="text-sm font-medium text-foreground">Seguro</span>
                                <DocSingleDropzone
                                    title="Seguro"
                                    file={docsForm.data.seguro}
                                    existingUrl={docsVehiculo?.documentos?.seguro.archivo}
                                    existingIsPdf={docsVehiculo?.documentos?.seguro.es_pdf}
                                    onDrop={(f) => docsForm.setData('seguro', f[0])}
                                    onPreview={(url, name, type) => setDocPreview({ url, name, type })}
                                />
                                <InputError message={docsForm.errors.seguro} />
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="seguro_vencimiento">Vencimiento del seguro</Label>
                                    <Input
                                        id="seguro_vencimiento"
                                        type="date"
                                        value={docsForm.data.seguro_vencimiento}
                                        onChange={(e) => docsForm.setData('seguro_vencimiento', e.target.value)}
                                    />
                                    <InputError message={docsForm.errors.seguro_vencimiento} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                            <Button type="button" variant="outline" onClick={() => setDocsVehiculo(null)}>Cancelar</Button>
                            <Button type="submit" disabled={docsForm.processing}>
                                {docsForm.processing ? 'Guardando...' : <><Check className="h-4 w-4" /> Guardar documentos</>}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <DocPreviewDialog preview={docPreview} onClose={() => setDocPreview(null)} />
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
            precio: string;
            inversion_id: string;
            empresa_id: string;
            user_id: string;
            fecha_vencimiento_vtv: string;
            fecha_vencimiento_gnc: string;
            estado_patente: string;
        }>
    >;
    onSubmit: (e: React.FormEvent) => void;
    onCancel?: () => void;
    onDocumentos?: () => void;
    empresas: Pick<Empresa, 'id' | 'nombre'>[];
    inversiones: Pick<Inversion, 'id' | 'nombre'>[];
    users: Pick<User, 'id' | 'name'>[];
    submitLabel: string;
}

function VehiculoForm({
    form,
    onSubmit,
    onCancel,
    onDocumentos,
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
                <Label>Estado de patente</Label>
                <Select
                    value={form.data.estado_patente || '__none__'}
                    onValueChange={(v) => form.setData('estado_patente', v === '__none__' ? '' : v)}
                >
                    <SelectTrigger>
                        <SelectValue>
                            {form.data.estado_patente ? (
                                <span className="flex items-center gap-2">
                                    <span className={cn('h-2 w-2 shrink-0 rounded-full', estadoPatenteBadge(form.data.estado_patente as EstadoPatente).dot)} />
                                    {estadoPatenteBadge(form.data.estado_patente as EstadoPatente).label}
                                </span>
                            ) : (
                                <span className="text-muted-foreground">Sin estado</span>
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">Sin estado</SelectItem>
                        {ESTADO_PATENTE_OPCIONES.map((opt) => {
                            const b = estadoPatenteBadge(opt.value);
                            return (
                                <SelectItem key={opt.value} value={opt.value}>
                                    <span className="flex items-center gap-2">
                                        <span className={cn('h-2 w-2 shrink-0 rounded-full', b.dot)} />
                                        {opt.label}
                                    </span>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
                <InputError message={form.errors.estado_patente} />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                    <Label htmlFor="precio">Precio</Label>
                    <MoneyInput
                        id="precio"
                        placeholder="Ej. 360.000,00"
                        value={form.data.precio === '' ? null : Number(form.data.precio)}
                        onValueChange={(n) => form.setData('precio', n == null ? '' : String(n))}
                    />
                    <InputError message={form.errors.precio} />
                </div>
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
        <DialogFooter className="flex-row items-center border-t border-border px-5 py-4 sm:justify-between">
            {onDocumentos && (
                <Button type="button" variant="ghost" size="sm" onClick={onDocumentos}>
                    <FileText className="h-4 w-4" /> Documentos
                </Button>
            )}
            <div className="flex items-center gap-2">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                )}
                <Button type="submit" disabled={!canSubmit}>
                    {form.processing ? 'Procesando...' : <><Check className="h-4 w-4" /> {submitLabel}</>}
                </Button>
            </div>
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
