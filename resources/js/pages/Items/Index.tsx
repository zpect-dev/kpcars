import { Head, useForm, router, usePage } from '@inertiajs/react';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Check,
    ChevronDown,
    FileDown,
    History,
    Image as ImageIcon,
    TrendingUp,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { Fragment, useMemo, useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
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
import {
    index,
    movimiento,
    store,
    updatePrecio,
    uploadImage,
    deleteImage,
} from '@/routes/articulos';
import { index as transactionsIndex } from '@/routes/transactions';
import type { Articulo, Vehiculo } from '@/types';

interface Props {
    items: Articulo[];
    vehiculos: Pick<Vehiculo, 'id' | 'patente' | 'marca' | 'modelo'>[];
}

function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

export default function ItemsIndex({ items, vehiculos }: Props) {
    const { auth } = usePage<any>().props;
    const isMechanic = auth.user.role === 'mecanico';
    const isAdmin = auth.user.role === 'administrador';
    const isInversor = auth.user.role === 'inversor';
    const canWrite = !isMechanic && !isInversor;

    // ─── Edición inline de precio ────────────────────────────────────────────
    const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
    const [editingPriceValue, setEditingPriceValue] = useState('');

    function startEditPrice(item: Articulo) {
        setEditingPriceId(item.id);
        setEditingPriceValue(String(item.precio));
    }

    function cancelEditPrice() {
        setEditingPriceId(null);
        setEditingPriceValue('');
    }

    function submitPrice(item: Articulo) {
        const precio = Number(editingPriceValue);
        if (isNaN(precio) || precio < 0) return;

        router.patch(updatePrecio.url(item.id), { precio }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => cancelEditPrice(),
        });
    }

    // ─── Expandable rows ────────────────────────────────────────────────────
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // ─── Imagen del artículo ────────────────────────────────────────────────
    const [viewingImage, setViewingImage] = useState<Articulo | null>(null);
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const imageInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    function handleImageUpload(item: Articulo, file: File) {
        setUploadingId(item.id);
        const formData = new FormData();
        formData.append('imagen', file);

        router.post(uploadImage.url(item.id), formData, {
            preserveScroll: true,
            preserveState: true,
            forceFormData: true,
            onFinish: () => setUploadingId(null),
        });
    }

    function handleImageDelete(item: Articulo) {
        router.delete(deleteImage.url(item.id), {
            preserveScroll: true,
            preserveState: true,
        });
    }

    function triggerImageInput(itemId: number) {
        imageInputRefs.current[itemId]?.click();
    }

    // ─── Buscador de artículos ───────────────────────────────────────────────
    const [itemSearch, setItemSearch] = useState('');

    const filteredItems = useMemo(() => {
        if (!itemSearch) return items;
        const q = itemSearch.toLowerCase();
        return items.filter((item) =>
            item.descripcion.toLowerCase().includes(q),
        );
    }, [items, itemSearch]);

    // ─── Modal Egreso (OUT) ──────────────────────────────────────────────────
    const [showMovModal, setShowMovModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Articulo | null>(null);
    const [movLocalErrors, setMovLocalErrors] = useState<{ cantidad?: string }>(
        {},
    );

    const movForm = useForm({
        tipo: 'OUT' as string,
        cantidad: '' as string,
        solicitante: '' as string,
        patente: '' as string,
        descripcion: '' as string,
    });

    const patenteOptions: ComboboxOption[] = useMemo(
        () =>
            vehiculos.map((v) => ({
                value: v.patente,
                label: v.patente,
                sub: `${v.marca} ${v.modelo}`,
            })),
        [vehiculos],
    );

    function openMovModal(item: Articulo) {
        setSelectedItem(item);
        movForm.reset();
        movForm.setData('tipo', 'OUT');
        setMovLocalErrors({});
        setShowMovModal(true);
    }

    function closeMovModal() {
        setShowMovModal(false);
        setSelectedItem(null);
        movForm.reset();
        setMovLocalErrors({});
    }

    function handleMovSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedItem) return;

        const cantidad = Number(movForm.data.cantidad);
        if (cantidad > selectedItem.stock) {
            setMovLocalErrors({
                cantidad: `Stock insuficiente. Disponible: ${selectedItem.stock}`,
            });
            return;
        }

        setMovLocalErrors({});
        movForm.post(movimiento.url(selectedItem.id), {
            onSuccess: () => closeMovModal(),
            preserveScroll: true,
            preserveState: true,
        });
    }

    // ─── Modal Ingreso / Nuevo Artículo ──────────────────────────────────────
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [matchedItem, setMatchedItem] = useState<Articulo | null>(null);
    const [isNewMode, setIsNewMode] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const descripcionRef = useRef<HTMLInputElement>(null);

    const createForm = useForm({
        descripcion: '',
        codigo: '',
        repuestos: false as boolean,
        stock: '0',
        min_stock: '0',
        precio: '0',
    });

    // Filtro del dropdown de sugerencias basado en lo escrito
    const suggestions = useMemo(() => {
        const q = createForm.data.descripcion.toLowerCase().trim();
        if (!q) return items;
        return items.filter((i) => i.descripcion.toLowerCase().includes(q));
    }, [items, createForm.data.descripcion]);

    // ¿El texto escrito coincide exactamente con alguno existente?
    const exactMatch = items.find(
        (i) =>
            i.descripcion.toLowerCase() ===
            createForm.data.descripcion.toLowerCase().trim(),
    );

    const isRestock = matchedItem !== null && !isNewMode;

    function openCreateModal() {
        createForm.reset();
        setMatchedItem(null);
        setIsNewMode(false);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        setShowCreateModal(true);
        setTimeout(() => descripcionRef.current?.focus(), 50);
    }

    function closeCreateModal() {
        setShowCreateModal(false);
        createForm.reset();
        setMatchedItem(null);
        setIsNewMode(false);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
    }

    function toggleNewMode() {
        setIsNewMode(!isNewMode);
        setMatchedItem(null);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        createForm.setData({
            descripcion: '',
            codigo: '',
            repuestos: false,
            stock: '0',
            min_stock: '0',
            precio: '0',
        });
        setTimeout(() => descripcionRef.current?.focus(), 50);
    }

    function handleDescripcionChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value;
        createForm.setData('descripcion', value);
        if (matchedItem) {
            setMatchedItem(null);
            createForm.setData('min_stock', '0');
        }
        setHighlightedIndex(-1);
        setShowSuggestions(true);
    }

    function handleDescripcionKeyDown(
        e: React.KeyboardEvent<HTMLInputElement>,
    ) {
        if (!showSuggestions || suggestions.length === 0) return;

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
            handleSelectSuggestion(suggestions[highlightedIndex]);
        } else if (e.key === 'Tab' && !matchedItem) {
            e.preventDefault();
            const target =
                highlightedIndex >= 0
                    ? suggestions[highlightedIndex]
                    : suggestions[0];
            handleSelectSuggestion(target);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setHighlightedIndex(-1);
        }
    }

    function handleSelectSuggestion(item: Articulo) {
        setMatchedItem(item);
        createForm.setData({
            descripcion: item.descripcion,
            codigo: item.codigo ?? '',
            repuestos: Boolean(item.repuestos),
            stock: '0',
            min_stock: String(item.min_stock),
            precio: String(item.precio ?? 0),
        });
        setShowSuggestions(false);
        // Pasar el foco al input de cantidad
    }

    function handleCreateSubmit(e: React.FormEvent) {
        e.preventDefault();
        createForm.post(store.url(), {
            onSuccess: () => closeCreateModal(),
            preserveScroll: true,
            preserveState: true,
        });
    }

    return (
        <>
            <Head title="Inventario" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="relative w-full sm:max-w-sm sm:flex-1">
                        <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Buscar artículo..."
                            className="bg-card pl-9 shadow-xs"
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                        />
                    </div>
                    {!isMechanic && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open('/pdf/stock', '_blank')}
                            >
                                <FileDown className="h-4 w-4" />
                                <span className="hidden sm:inline">Exportar PDF</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open('/pdf/top-salidas', '_blank')}
                            >
                                <TrendingUp className="h-4 w-4" />
                                <span className="hidden sm:inline">Top salidas</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.get(transactionsIndex.url())}
                            >
                                <History className="h-4 w-4" />
                                <span className="hidden sm:inline">Historial</span>
                            </Button>
                            {canWrite && (
                                <Button size="sm" onClick={openCreateModal}>
                                    <ArrowDownCircle className="h-4 w-4" />
                                    <span className="hidden sm:inline">Ingreso</span>
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Tabla + cards */}
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    {/* Desktop */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full table-fixed text-left text-sm text-muted-foreground">
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th
                                        scope="col"
                                        className="w-[32%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Descripción
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[12%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Código
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[12%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Stock Actual
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[12%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Stock Mínimo
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[16%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Precio
                                    </th>
                                    {canWrite && (
                                        <th
                                            scope="col"
                                            className="w-[16%] px-4 py-3 text-right font-medium tracking-wider sm:px-6 sm:py-4"
                                        >
                                            Acciones
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={canWrite ? 6 : 5}
                                            className="px-6 py-12 text-center text-muted-foreground"
                                        >
                                            No hay artículos registrados o no
                                            coinciden con la búsqueda.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item) => {
                                        const lowStock = item.stock <= item.min_stock;
                                        const isExpanded = expandedId === item.id;
                                        const pct = item.min_stock > 0
                                            ? Math.min(100, Math.round((item.stock / (item.min_stock * 3)) * 100))
                                            : item.stock > 0 ? 100 : 0;
                                        const barColor = item.stock === 0
                                            ? 'bg-red-500'
                                            : lowStock
                                                ? 'bg-orange-400'
                                                : pct < 60
                                                    ? 'bg-yellow-400'
                                                    : 'bg-green-500';
                                        const statusLabel = item.stock === 0
                                            ? 'Sin stock'
                                            : lowStock
                                                ? 'Stock crítico'
                                                : 'Normal';
                                        const statusColor = item.stock === 0
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                            : lowStock
                                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                                                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
                                        return (
                                            <Fragment key={item.id}>
                                                <tr
                                                    className={cn(
                                                        'cursor-pointer transition-colors',
                                                        lowStock
                                                            ? 'bg-red-100 hover:bg-red-200/80 dark:bg-red-950/50 dark:hover:bg-red-950/70'
                                                            : 'bg-card hover:bg-muted/40',
                                                    )}
                                                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                                >
                                                    <td
                                                        className={cn(
                                                            'px-4 py-3 font-medium sm:px-6 sm:py-4',
                                                            lowStock
                                                                ? 'text-red-800 dark:text-red-300'
                                                                : 'text-foreground',
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <ChevronDown className={cn(
                                                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                                                isExpanded && 'rotate-180',
                                                            )} />
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (item.imagen_url) setViewingImage(item);
                                                                }}
                                                                className={cn(
                                                                    'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted',
                                                                    item.imagen_url ? 'cursor-pointer hover:ring-2 hover:ring-primary/40' : 'cursor-default',
                                                                )}
                                                                aria-label={item.imagen_url ? 'Ver imagen' : 'Sin imagen'}
                                                            >
                                                                {item.imagen_url ? (
                                                                    <img
                                                                        src={item.imagen_url}
                                                                        alt={item.descripcion}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </button>
                                                            <span className="truncate">{item.descripcion}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 truncate text-xs text-muted-foreground sm:px-6 sm:py-4">
                                                        {item.codigo || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 truncate sm:px-6 sm:py-4">
                                                        <span className={lowStock ? 'font-semibold text-red-700 dark:text-red-400' : ''}>
                                                            {item.stock}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 truncate sm:px-6 sm:py-4">
                                                        {item.min_stock}
                                                    </td>
                                                    <td className="px-4 py-3 sm:px-6 sm:py-4" onClick={(e) => e.stopPropagation()}>
                                                        {editingPriceId === item.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={editingPriceValue}
                                                                    onChange={(e) => setEditingPriceValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') submitPrice(item);
                                                                        if (e.key === 'Escape') cancelEditPrice();
                                                                    }}
                                                                    className="h-7 w-24 text-xs"
                                                                    autoFocus
                                                                />
                                                                <button type="button" onClick={() => submitPrice(item)} className="text-foreground hover:text-foreground/80">
                                                                    <Check className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button type="button" onClick={cancelEditPrice} className="text-muted-foreground hover:text-foreground">
                                                                    <X className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 text-sm',
                                                                    isAdmin && 'cursor-pointer hover:underline',
                                                                )}
                                                                onClick={() => isAdmin && startEditPrice(item)}
                                                                disabled={!isAdmin}
                                                            >
                                                                {formatARS(Number(item.precio))}
                                                                {isAdmin && <Pencil className="h-3 w-3 text-muted-foreground" />}
                                                            </button>
                                                        )}
                                                    </td>
                                                    {canWrite && (
                                                        <td className="px-4 py-3 text-right truncate sm:px-6 sm:py-4" onClick={(e) => e.stopPropagation()}>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openMovModal(item)}
                                                            >
                                                                <ArrowUpCircle className="h-4 w-4" />
                                                                <span className="hidden sm:inline">Salida</span>
                                                            </Button>
                                                        </td>
                                                    )}
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-muted/20">
                                                        <td colSpan={canWrite ? 6 : 5} className="px-6 py-4">
                                                            <div className="flex flex-col gap-3">
                                                                {/* Barra de stock */}
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                                        <span>Nivel de stock</span>
                                                                        <span>{item.stock} / mín. {item.min_stock}</span>
                                                                    </div>
                                                                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                                                        <div
                                                                            className={cn('h-full rounded-full transition-all', barColor)}
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {/* Info grid */}
                                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-muted-foreground">Estado:</span>
                                                                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusColor)}>
                                                                            {statusLabel}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-muted-foreground">Precio unitario:</span>
                                                                        <span className="font-medium">{formatARS(Number(item.precio))}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-muted-foreground">Valor total en stock:</span>
                                                                        <span className="font-medium">{formatARS(Number(item.precio) * item.stock)}</span>
                                                                    </div>
                                                                    {canWrite && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="ml-auto"
                                                                            onClick={(e) => { e.stopPropagation(); openMovModal(item); }}
                                                                        >
                                                                            <ArrowUpCircle className="h-4 w-4" />
                                                                            Registrar salida
                                                                        </Button>
                                                                    )}
                                                                </div>

                                                                {canWrite && (
                                                                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                                                                        <span className="text-xs text-muted-foreground">
                                                                            Imagen del artículo:
                                                                        </span>
                                                                        <input
                                                                            ref={(el) => {
                                                                                imageInputRefs.current[item.id] = el;
                                                                            }}
                                                                            type="file"
                                                                            accept="image/jpeg,image/png,image/webp"
                                                                            className="hidden"
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) handleImageUpload(item, file);
                                                                                e.target.value = '';
                                                                            }}
                                                                        />
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                triggerImageInput(item.id);
                                                                            }}
                                                                            disabled={uploadingId === item.id}
                                                                        >
                                                                            <Upload className="h-4 w-4" />
                                                                            {item.imagen_url ? 'Cambiar imagen' : 'Subir imagen'}
                                                                        </Button>
                                                                        {item.imagen_url && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                className="text-destructive hover:text-destructive"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleImageDelete(item);
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                                Eliminar
                                                                            </Button>
                                                                        )}
                                                                        {uploadingId === item.id && (
                                                                            <span className="text-xs text-muted-foreground">
                                                                                Subiendo...
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <ul className="divide-y divide-border md:hidden">
                        {filteredItems.length === 0 ? (
                            <li className="px-4 py-12 text-center text-sm text-muted-foreground">
                                No hay artículos registrados o no coinciden con
                                la búsqueda.
                            </li>
                        ) : (
                            filteredItems.map((item) => {
                                const lowStock = item.stock <= item.min_stock;
                                const isExpanded = expandedId === item.id;
                                const pct = item.min_stock > 0
                                    ? Math.min(100, Math.round((item.stock / (item.min_stock * 3)) * 100))
                                    : item.stock > 0 ? 100 : 0;
                                const barColor = item.stock === 0
                                    ? 'bg-red-500'
                                    : lowStock ? 'bg-orange-400'
                                    : pct < 60 ? 'bg-yellow-400'
                                    : 'bg-green-500';
                                const statusLabel = item.stock === 0
                                    ? 'Sin stock'
                                    : lowStock ? 'Stock crítico'
                                    : 'Normal';
                                const statusColor = item.stock === 0
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                    : lowStock
                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
                                return (
                                    <li
                                        key={item.id}
                                        className={cn(
                                            'flex flex-col gap-0',
                                            lowStock && 'bg-red-50 dark:bg-red-950/30',
                                        )}
                                    >
                                        <button
                                            type="button"
                                            className="flex w-full items-start justify-between gap-3 p-4 text-left"
                                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                        >
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.imagen_url) setViewingImage(item);
                                                }}
                                                className={cn(
                                                    'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted',
                                                    item.imagen_url && 'cursor-pointer',
                                                )}
                                            >
                                                {item.imagen_url ? (
                                                    <img
                                                        src={item.imagen_url}
                                                        alt={item.descripcion}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                <p className={cn(
                                                    'line-clamp-2 text-sm font-semibold',
                                                    lowStock ? 'text-red-800 dark:text-red-300' : 'text-foreground',
                                                )}>
                                                    {item.descripcion}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                    {item.codigo && (
                                                        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                                                            {item.codigo}
                                                        </span>
                                                    )}
                                                    {item.repuestos && (
                                                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                            Repuesto
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-baseline gap-4 text-xs">
                                                    <span>
                                                        Stock:{' '}
                                                        <span className={cn(
                                                            'text-base font-semibold',
                                                            lowStock ? 'text-red-700 dark:text-red-400' : 'text-foreground',
                                                        )}>
                                                            {item.stock}
                                                        </span>
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        Mín: <span className="font-medium">{item.min_stock}</span>
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        Precio: <span className="font-medium">{formatARS(Number(item.precio))}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronDown className={cn(
                                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 mt-0.5',
                                                isExpanded && 'rotate-180',
                                            )} />
                                        </button>
                                        {isExpanded && (
                                            <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                            <span>Nivel de stock</span>
                                                            <span>{item.stock} / mín. {item.min_stock}</span>
                                                        </div>
                                                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                                            <div
                                                                className={cn('h-full rounded-full transition-all', barColor)}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusColor)}>
                                                            {statusLabel}
                                                        </span>
                                                        <span className="text-muted-foreground text-xs">
                                                            Valor total: <span className="font-medium text-foreground">{formatARS(Number(item.precio) * item.stock)}</span>
                                                        </span>
                                                        {canWrite && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="ml-auto"
                                                                onClick={(e) => { e.stopPropagation(); openMovModal(item); }}
                                                            >
                                                                <ArrowUpCircle className="h-4 w-4" />
                                                                Salida
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {canWrite && (
                                                        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                                                            <span className="text-xs text-muted-foreground">
                                                                Imagen:
                                                            </span>
                                                            <input
                                                                ref={(el) => {
                                                                    imageInputRefs.current[item.id] = el;
                                                                }}
                                                                type="file"
                                                                accept="image/jpeg,image/png,image/webp"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) handleImageUpload(item, file);
                                                                    e.target.value = '';
                                                                }}
                                                            />
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    triggerImageInput(item.id);
                                                                }}
                                                                disabled={uploadingId === item.id}
                                                            >
                                                                <Upload className="h-4 w-4" />
                                                                {item.imagen_url ? 'Cambiar' : 'Subir'}
                                                            </Button>
                                                            {item.imagen_url && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-destructive hover:text-destructive"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleImageDelete(item);
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {uploadingId === item.id && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    Subiendo...
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            </div>

            {/* ─── Modal Egreso ─────────────────────────────────────────────────── */}
            <Dialog
                open={showMovModal}
                onOpenChange={(open) => {
                    if (!open) closeMovModal();
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Salida</DialogTitle>
                        <DialogDescription asChild>
                            <div className="flex items-center gap-2">
                                <span>{selectedItem?.descripcion}</span>
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    Stock: {selectedItem?.stock}
                                </span>
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleMovSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cantidad">Cantidad</Label>
                            <Input
                                id="cantidad"
                                type="number"
                                min="1"
                                value={movForm.data.cantidad}
                                onChange={(e) => {
                                    movForm.setData('cantidad', e.target.value);
                                    if (movLocalErrors.cantidad)
                                        setMovLocalErrors({});
                                }}
                                placeholder="Cantidad"
                            />
                            <InputError message={movForm.errors.cantidad} />
                            <InputError message={movLocalErrors.cantidad} />
                            <InputError message={(movForm.errors as Record<string, string>).stock} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="solicitante">Solicitante</Label>
                            <Input
                                id="solicitante"
                                type="text"
                                value={movForm.data.solicitante}
                                onChange={(e) =>
                                    movForm.setData(
                                        'solicitante',
                                        e.target.value,
                                    )
                                }
                                placeholder="Nombre del solicitante"
                            />
                            <InputError message={movForm.errors.solicitante} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="patente">
                                Patente del Vehículo
                            </Label>
                            <Combobox
                                id="patente"
                                placeholder="Buscar patente, marca o modelo..."
                                options={patenteOptions}
                                value={movForm.data.patente}
                                onSelect={(o) =>
                                    movForm.setData('patente', o.value)
                                }
                                uppercase
                            />
                            <InputError message={movForm.errors.patente} />
                        </div>

                        {movForm.data.patente === 'EXTERNO' && (
                            <div className="grid gap-2">
                                <Label htmlFor="descripcion">Descripción (Externo)</Label>
                                <Input
                                    id="descripcion"
                                    type="text"
                                    value={movForm.data.descripcion}
                                    onChange={(e) =>
                                        movForm.setData(
                                            'descripcion',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Motivo o detalle del egreso externo..."
                                />
                                <InputError message={movForm.errors.descripcion} />
                            </div>
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeMovModal}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    movForm.processing ||
                                    !movForm.data.cantidad ||
                                    Number(movForm.data.cantidad) < 1 ||
                                    !movForm.data.patente
                                }
                            >
                                {movForm.processing
                                    ? 'Procesando...'
                                    : 'Confirmar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Modal Ingreso / Nuevo Artículo ──────────────────────────────── */}
            <Dialog
                open={showCreateModal}
                onOpenChange={(open) => {
                    if (!open) closeCreateModal();
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {isNewMode
                                ? 'Nuevo Artículo'
                                : 'Ingreso de Artículo'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleCreateSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="descripcion">Artículo</Label>
                            {isNewMode ? (
                                <>
                                    <Input
                                        id="descripcion"
                                        ref={descripcionRef}
                                        autoComplete="off"
                                        placeholder="Nombre del nuevo artículo..."
                                        value={createForm.data.descripcion}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'descripcion',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </>
                            ) : (
                                <div className="relative">
                                    <Input
                                        id="descripcion"
                                        ref={descripcionRef}
                                        autoComplete="off"
                                        placeholder="Buscar artículo..."
                                        value={createForm.data.descripcion}
                                        onChange={handleDescripcionChange}
                                        onKeyDown={handleDescripcionKeyDown}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => {
                                            setTimeout(
                                                () => setShowSuggestions(false),
                                                150,
                                            );
                                        }}
                                    />
                                    {showSuggestions &&
                                        createForm.data.descripcion.trim() !==
                                            '' && (
                                            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                                                <div className="max-h-52 overflow-y-auto">
                                                    {suggestions.length ===
                                                    0 ? (
                                                        <p className="px-3 py-2 text-sm text-muted-foreground">
                                                            Sin coincidencias
                                                        </p>
                                                    ) : (
                                                        suggestions.map(
                                                            (item, idx) => (
                                                                <button
                                                                    key={
                                                                        item.id
                                                                    }
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
                                                                        handleSelectSuggestion(
                                                                            item,
                                                                        )
                                                                    }
                                                                >
                                                                    <span className="font-medium">
                                                                        {
                                                                            item.descripcion
                                                                        }
                                                                    </span>
                                                                    <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                                                                        Stock:{' '}
                                                                        {
                                                                            item.stock
                                                                        }
                                                                    </span>
                                                                </button>
                                                            ),
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            )}
                            {isRestock && matchedItem && (
                                <span className="inline-flex w-fit items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    Stock: {matchedItem.stock}
                                </span>
                            )}
                            <InputError
                                message={createForm.errors.descripcion}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="codigo">Código</Label>
                                <Input
                                    id="codigo"
                                    type="text"
                                    value={createForm.data.codigo}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'codigo',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Código del artículo"
                                />
                                <InputError
                                    message={createForm.errors.codigo}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label
                                    htmlFor="repuestos"
                                    className="flex items-center gap-2"
                                >
                                    <input
                                        id="repuestos"
                                        type="checkbox"
                                        checked={createForm.data.repuestos}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'repuestos',
                                                e.target.checked,
                                            )
                                        }
                                        className="h-4 w-4 rounded border-border"
                                    />
                                    Es repuesto
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Marcar si el artículo es un repuesto.
                                </p>
                                <InputError
                                    message={createForm.errors.repuestos}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="stock">
                                    {isRestock
                                        ? 'Cantidad a ingresar'
                                        : 'Stock Inicial'}
                                </Label>
                                <Input
                                    id="stock"
                                    type="number"
                                    min="0"
                                    value={createForm.data.stock}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'stock',
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError message={createForm.errors.stock} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="min_stock">Stock Mínimo</Label>
                                <Input
                                    id="min_stock"
                                    type="number"
                                    min="0"
                                    value={createForm.data.min_stock}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'min_stock',
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={createForm.errors.min_stock}
                                />
                            </div>
                        </div>

                        {isNewMode && (
                            <div className="grid gap-2">
                                <Label htmlFor="precio">Precio (ARS)</Label>
                                <Input
                                    id="precio"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={createForm.data.precio}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'precio',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="0.00"
                                />
                                <InputError
                                    message={createForm.errors.precio}
                                />
                            </div>
                        )}

                        <DialogFooter className="sm:justify-between">
                            <Button
                                type="button"
                                variant={isNewMode ? 'default' : 'secondary'}
                                size="sm"
                                onClick={toggleNewMode}
                            >
                                {isNewMode ? 'Ingreso' : 'Nuevo'}
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeCreateModal}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        createForm.processing ||
                                        !createForm.data.descripcion.trim() ||
                                        (!isNewMode && !matchedItem) ||
                                        (isRestock &&
                                            Number(createForm.data.stock) < 1)
                                    }
                                >
                                    {createForm.processing
                                        ? 'Procesando...'
                                        : 'Confirmar'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Modal Visor de Imagen ────────────────────────────────────── */}
            <Dialog
                open={viewingImage !== null}
                onOpenChange={(open) => {
                    if (!open) setViewingImage(null);
                }}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="truncate">
                            {viewingImage?.descripcion}
                        </DialogTitle>
                    </DialogHeader>
                    {viewingImage?.imagen_url && (
                        <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg bg-muted">
                            <img
                                src={viewingImage.imagen_url}
                                alt={viewingImage.descripcion}
                                className="max-h-[70vh] w-auto object-contain"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

ItemsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Inventario',
            href: index.url(),
        },
    ],
};
