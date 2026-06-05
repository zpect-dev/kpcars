import { Head, useForm, router, usePage } from '@inertiajs/react';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Check,
    FileDown,
    History,
    Loader2,
    Minus,
    Pencil,
    Plus,
    Search,
    Sparkles,
    Trash2,
    TrendingUp,
    Warehouse,
    Wrench,
    X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { index, salidaMultiple, store, updatePrecio } from '@/routes/articulos';
import { index as transactionsIndex } from '@/routes/transactions';
import type { Articulo, Vehiculo } from '@/types';

interface Props {
    items: Articulo[];
    vehiculos: (Pick<Vehiculo, 'id' | 'patente' | 'marca' | 'modelo'> & {
        user?: { id: number; name: string } | null;
    })[];
}

interface OrderLine {
    articulo_id: number;
    cantidad: string;
}

type InventarioTab = 'repuestos' | 'galpon';

// Descripción automática para los egresos de artículos del galpón.
const GALPON_DESC = 'Artículos para galpón';

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

    const itemsById = useMemo(() => {
        const map = new Map<number, Articulo>();
        items.forEach((i) => map.set(i.id, i));

        return map;
    }, [items]);

    // ─── Pestaña activa: Repuestos (repuestos=1) vs Galpón (repuestos=0) ──────
    const [activeTab, setActiveTab] = useState<InventarioTab>('repuestos');

    const tabItems = useMemo(
        () =>
            items.filter((i) =>
                activeTab === 'repuestos' ? i.repuestos : !i.repuestos,
            ),
        [items, activeTab],
    );

    const counts = useMemo(
        () => ({
            repuestos: items.filter((i) => i.repuestos).length,
            galpon: items.filter((i) => !i.repuestos).length,
        }),
        [items],
    );

    // ─── Edición inline de precio ────────────────────────────────────────────
    const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
    const [editingPriceValue, setEditingPriceValue] = useState('');
    const [savingPriceId, setSavingPriceId] = useState<number | null>(null);

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

        if (isNaN(precio) || precio < 0) {
            return;
        }

        setSavingPriceId(item.id);
        router.patch(
            updatePrecio.url(item.id),
            { precio },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => cancelEditPrice(),
                onFinish: () => setSavingPriceId(null),
            },
        );
    }

    // ─── Buscador de artículos ───────────────────────────────────────────────
    const [itemSearch, setItemSearch] = useState('');

    const filteredItems = useMemo(() => {
        if (!itemSearch) {
            return tabItems;
        }

        const q = itemSearch.toLowerCase();

        return tabItems.filter((item) =>
            item.descripcion.toLowerCase().includes(q),
        );
    }, [tabItems, itemSearch]);

    // ─── Modal Egreso (OUT múltiple) ─────────────────────────────────────────
    const [showSalidaModal, setShowSalidaModal] = useState(false);
    const [salidaMode, setSalidaMode] = useState<InventarioTab>('repuestos');
    const isGalponSalida = salidaMode === 'galpon';
    const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
    // Key para forzar el reseteo del combobox de artículos tras cada selección.
    const [comboKey, setComboKey] = useState(0);
    const salidaForm = useForm({
        patente: '' as string,
        solicitante: '' as string,
        descripcion: '' as string,
    });

    const patenteOptions: ComboboxOption[] = useMemo(
        () =>
            vehiculos.map((v) => ({
                value: v.patente,
                label: v.patente,
                sub: [v.user?.name, `${v.marca} ${v.modelo}`]
                    .filter(Boolean)
                    .join(' · '),
            })),
        [vehiculos],
    );

    // Artículos disponibles para agregar: con stock, aún no en el pedido y de la
    // clase del egreso activo (repuestos o galpón).
    const articuloOptions: ComboboxOption[] = useMemo(() => {
        const inOrder = new Set(orderLines.map((l) => l.articulo_id));

        return items
            .filter(
                (i) =>
                    i.stock > 0 &&
                    !inOrder.has(i.id) &&
                    (salidaMode === 'repuestos' ? i.repuestos : !i.repuestos),
            )
            .map((i) => ({
                value: String(i.id),
                label: i.descripcion,
                sub: `Stock: ${i.stock}`,
            }));
    }, [items, orderLines, salidaMode]);

    function openSalidaModal(mode: InventarioTab) {
        setSalidaMode(mode);
        setOrderLines([]);
        setComboKey((k) => k + 1);
        salidaForm.reset();
        salidaForm.clearErrors();
        setShowSalidaModal(true);
    }

    function closeSalidaModal() {
        setShowSalidaModal(false);
        setOrderLines([]);
        salidaForm.reset();
        salidaForm.clearErrors();
    }

    function addArticulo(articuloId: number) {
        setOrderLines((prev) =>
            prev.some((l) => l.articulo_id === articuloId)
                ? prev
                : [...prev, { articulo_id: articuloId, cantidad: '1' }],
        );
        setComboKey((k) => k + 1); // limpia el combobox para el siguiente
    }

    function updateCantidad(articuloId: number, value: string) {
        setOrderLines((prev) =>
            prev.map((l) =>
                l.articulo_id === articuloId ? { ...l, cantidad: value } : l,
            ),
        );
    }

    function removeLine(articuloId: number) {
        setOrderLines((prev) =>
            prev.filter((l) => l.articulo_id !== articuloId),
        );
    }

    // Errores por línea (cantidad inválida o supera stock).
    const lineErrors = useMemo(() => {
        const errs: Record<number, string> = {};
        orderLines.forEach((l) => {
            const item = itemsById.get(l.articulo_id);
            const c = Number(l.cantidad);

            if (!item) {
                errs[l.articulo_id] = 'Artículo inválido';
            } else if (!c || c < 1) {
                errs[l.articulo_id] = 'Cantidad inválida';
            } else if (c > item.stock) {
                errs[l.articulo_id] = `Máx: ${item.stock}`;
            }
        });

        return errs;
    }, [orderLines, itemsById]);

    const salidaValida =
        orderLines.length > 0 &&
        Object.keys(lineErrors).length === 0 &&
        // El galpón no pide patente: se asigna EXTERNO automáticamente.
        (isGalponSalida || !!salidaForm.data.patente);

    function handleSalidaSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!salidaValida) {
            return;
        }

        const lineas = orderLines.map((l) => ({
            articulo_id: l.articulo_id,
            cantidad: Number(l.cantidad),
        }));

        router.post(
            salidaMultiple.url(),
            {
                patente: isGalponSalida ? 'EXTERNO' : salidaForm.data.patente,
                solicitante: salidaForm.data.solicitante,
                descripcion: isGalponSalida
                    ? GALPON_DESC
                    : salidaForm.data.descripcion,
                lineas,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => closeSalidaModal(),
            },
        );
    }

    // ─── Modal Ingreso / Nuevo Artículo ──────────────────────────────────────
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [matchedItem, setMatchedItem] = useState<Articulo | null>(null);
    const [isNewMode, setIsNewMode] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [adjustingMinStock, setAdjustingMinStock] = useState(false);
    const descripcionRef = useRef<HTMLInputElement>(null);

    const createForm = useForm({
        descripcion: '',
        codigo: '',
        repuestos: false as boolean,
        stock: '0',
        min_stock: '0',
        precio: '0',
    });

    const suggestions = useMemo(() => {
        const q = createForm.data.descripcion.toLowerCase().trim();

        if (!q) {
            return items;
        }

        return items.filter((i) => i.descripcion.toLowerCase().includes(q));
    }, [items, createForm.data.descripcion]);

    const isRestock = matchedItem !== null && !isNewMode;

    function openCreateModal() {
        createForm.reset();
        // Por defecto, el artículo nuevo hereda la clase de la pestaña activa.
        createForm.setData('repuestos', activeTab === 'repuestos');
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
        setAdjustingMinStock(false);
    }

    function toggleNewMode() {
        setIsNewMode(!isNewMode);
        setMatchedItem(null);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        setAdjustingMinStock(false);
        createForm.setData({
            descripcion: '',
            codigo: '',
            repuestos: activeTab === 'repuestos',
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
        if (!showSuggestions || suggestions.length === 0) {
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
                                onClick={() =>
                                    window.open('/pdf/stock', '_blank')
                                }
                            >
                                <FileDown className="h-4 w-4" />
                                <span className="hidden sm:inline">
                                    Exportar PDF
                                </span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    router.get(transactionsIndex.url())
                                }
                            >
                                <History className="h-4 w-4" />
                                <span className="hidden sm:inline">
                                    Historial
                                </span>
                            </Button>
                            {canWrite && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            openSalidaModal(activeTab)
                                        }
                                    >
                                        <ArrowUpCircle className="h-4 w-4" />
                                        <span className="hidden sm:inline">
                                            Egreso
                                        </span>
                                    </Button>
                                    <Button size="sm" onClick={openCreateModal}>
                                        <ArrowDownCircle className="h-4 w-4" />
                                        <span className="hidden sm:inline">
                                            Ingreso
                                        </span>
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Pestañas: Repuestos vs Galpón */}
                <div className="flex w-full gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:w-auto sm:self-start">
                    <button
                        type="button"
                        onClick={() => setActiveTab('repuestos')}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-none',
                            activeTab === 'repuestos'
                                ? 'bg-card text-foreground shadow'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Wrench className="h-4 w-4" />
                        Repuestos
                        <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                            {counts.repuestos}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('galpon')}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-none',
                            activeTab === 'galpon'
                                ? 'bg-card text-foreground shadow'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Warehouse className="h-4 w-4" />
                        Galpón
                        <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                            {counts.galpon}
                        </span>
                    </button>
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
                                        className="w-[38%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Descripción
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[14%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Código
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[14%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Stock Actual
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[14%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Stock Mínimo
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[20%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Precio
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-6 py-12 text-center text-muted-foreground"
                                        >
                                            No hay artículos registrados o no
                                            coinciden con la búsqueda.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item) => {
                                        const lowStock =
                                            item.stock <= item.min_stock;

                                        return (
                                            <tr
                                                key={item.id}
                                                className={cn(
                                                    'transition-colors',
                                                    lowStock
                                                        ? 'bg-red-100 hover:bg-red-200/80 dark:bg-red-950/50 dark:hover:bg-red-950/70'
                                                        : 'bg-card hover:bg-muted/40',
                                                )}
                                            >
                                                <td
                                                    className={cn(
                                                        'px-4 py-3 font-medium sm:px-6 sm:py-4',
                                                        lowStock
                                                            ? 'text-red-800 dark:text-red-300'
                                                            : 'text-foreground',
                                                    )}
                                                >
                                                    <span className="truncate">
                                                        {item.descripcion}
                                                    </span>
                                                </td>
                                                <td className="truncate px-4 py-3 text-xs text-muted-foreground sm:px-6 sm:py-4">
                                                    {item.codigo || '—'}
                                                </td>
                                                <td className="truncate px-4 py-3 sm:px-6 sm:py-4">
                                                    <span
                                                        className={
                                                            lowStock
                                                                ? 'font-semibold text-red-700 dark:text-red-400'
                                                                : ''
                                                        }
                                                    >
                                                        {item.stock}
                                                    </span>
                                                </td>
                                                <td className="truncate px-4 py-3 sm:px-6 sm:py-4">
                                                    {item.min_stock}
                                                </td>
                                                <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                    {editingPriceId ===
                                                    item.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={
                                                                    editingPriceValue
                                                                }
                                                                onChange={(e) =>
                                                                    setEditingPriceValue(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                onKeyDown={(
                                                                    e,
                                                                ) => {
                                                                    if (
                                                                        e.key ===
                                                                        'Enter'
                                                                    ) {
                                                                        submitPrice(
                                                                            item,
                                                                        );
                                                                    }

                                                                    if (
                                                                        e.key ===
                                                                        'Escape'
                                                                    ) {
                                                                        cancelEditPrice();
                                                                    }
                                                                }}
                                                                className="h-7 w-24 text-xs"
                                                                autoFocus
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    submitPrice(
                                                                        item,
                                                                    )
                                                                }
                                                                disabled={
                                                                    savingPriceId ===
                                                                    item.id
                                                                }
                                                                className="text-foreground hover:text-foreground/80 disabled:cursor-default"
                                                            >
                                                                {savingPriceId ===
                                                                item.id ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <Check className="h-3.5 w-3.5" />
                                                                )}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    cancelEditPrice
                                                                }
                                                                className="text-muted-foreground hover:text-foreground"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className={cn(
                                                                'inline-flex items-center gap-1 text-sm',
                                                                isAdmin &&
                                                                    'cursor-pointer hover:underline',
                                                            )}
                                                            onClick={() =>
                                                                isAdmin &&
                                                                startEditPrice(
                                                                    item,
                                                                )
                                                            }
                                                            disabled={!isAdmin}
                                                        >
                                                            {formatARS(
                                                                Number(
                                                                    item.precio,
                                                                ),
                                                            )}
                                                            {isAdmin && (
                                                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                                            )}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
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

                                return (
                                    <li
                                        key={item.id}
                                        className={cn(
                                            'flex flex-col gap-1 p-4',
                                            lowStock &&
                                                'bg-red-50 dark:bg-red-950/30',
                                        )}
                                    >
                                        <p
                                            className={cn(
                                                'line-clamp-2 text-sm font-semibold',
                                                lowStock
                                                    ? 'text-red-800 dark:text-red-300'
                                                    : 'text-foreground',
                                            )}
                                        >
                                            {item.descripcion}
                                        </p>
                                        {item.codigo && (
                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                                                    {item.codigo}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-baseline gap-4 text-xs">
                                            <span>
                                                Stock:{' '}
                                                <span
                                                    className={cn(
                                                        'text-base font-semibold',
                                                        lowStock
                                                            ? 'text-red-700 dark:text-red-400'
                                                            : 'text-foreground',
                                                    )}
                                                >
                                                    {item.stock}
                                                </span>
                                            </span>
                                            <span className="text-muted-foreground">
                                                Mín:{' '}
                                                <span className="font-medium">
                                                    {item.min_stock}
                                                </span>
                                            </span>
                                            <span className="text-muted-foreground">
                                                Precio:{' '}
                                                <span className="font-medium">
                                                    {formatARS(
                                                        Number(item.precio),
                                                    )}
                                                </span>
                                            </span>
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            </div>

            {/* ─── Modal Egreso (OUT múltiple) ────────────────────────────────── */}
            <Dialog
                open={showSalidaModal}
                onOpenChange={(open) => {
                    if (!open) {
                        closeSalidaModal();
                    }
                }}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                    {/* Header */}
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                            <ArrowUpCircle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">
                                {isGalponSalida
                                    ? 'Egreso de galpón'
                                    : 'Registrar egreso'}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                {isGalponSalida
                                    ? 'Consumo interno del galpón. Se registra como EXTERNO, sin cobro.'
                                    : 'Sumá los repuestos del pedido. Todo se despacha al mismo vehículo.'}
                            </DialogDescription>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSalidaSubmit}
                        className="flex flex-col gap-5 p-5"
                    >
                        {/* Artículos */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">
                                    {isGalponSalida
                                        ? 'Artículos del galpón'
                                        : 'Repuestos del pedido'}
                                </span>
                                {orderLines.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        {orderLines.length}{' '}
                                        {orderLines.length === 1
                                            ? 'artículo'
                                            : 'artículos'}{' '}
                                        ·{' '}
                                        {orderLines.reduce(
                                            (s, l) =>
                                                s + (Number(l.cantidad) || 0),
                                            0,
                                        )}{' '}
                                        unidades
                                    </span>
                                )}
                            </div>
                            <Combobox
                                key={comboKey}
                                placeholder={
                                    isGalponSalida
                                        ? 'Buscar artículo...'
                                        : 'Buscar repuesto...'
                                }
                                options={articuloOptions}
                                value=""
                                onSelect={(o) => addArticulo(Number(o.value))}
                                emptyText="Sin artículos disponibles"
                            />
                            {orderLines.length > 0 && (
                                <div className="max-h-52 divide-y divide-border overflow-hidden overflow-y-auto rounded-xl border border-border">
                                    {orderLines.map((line) => {
                                        const item = itemsById.get(
                                            line.articulo_id,
                                        );

                                        if (!item) {
                                            return null;
                                        }

                                        const qty = Number(line.cantidad) || 0;
                                        const remaining = item.stock - qty;

                                        return (
                                            <div
                                                key={line.articulo_id}
                                                className="flex items-center gap-3 px-3.5 py-3"
                                            >
                                                <div className="flex min-w-0 flex-1 flex-col">
                                                    <span className="truncate text-sm font-semibold text-foreground">
                                                        {item.descripcion}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'text-[11px]',
                                                            remaining < 0
                                                                ? 'text-destructive'
                                                                : remaining <= 3
                                                                  ? 'text-amber-500 dark:text-amber-400'
                                                                  : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        Quedarán {remaining} en
                                                        depósito
                                                    </span>
                                                </div>
                                                {/* Stepper unificado */}
                                                <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateCantidad(
                                                                line.articulo_id,
                                                                String(
                                                                    Math.max(
                                                                        1,
                                                                        qty - 1,
                                                                    ),
                                                                ),
                                                            )
                                                        }
                                                        className="flex h-8 w-8 items-center justify-center border-r border-border bg-muted text-foreground transition-colors hover:bg-muted/70"
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <span
                                                        className={cn(
                                                            'flex h-8 w-8 items-center justify-center bg-card text-sm font-bold tabular-nums',
                                                            lineErrors[
                                                                line.articulo_id
                                                            ]
                                                                ? 'text-destructive'
                                                                : 'text-foreground',
                                                        )}
                                                    >
                                                        {line.cantidad}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateCantidad(
                                                                line.articulo_id,
                                                                String(
                                                                    Math.min(
                                                                        item.stock,
                                                                        qty + 1,
                                                                    ),
                                                                ),
                                                            )
                                                        }
                                                        disabled={
                                                            qty >= item.stock
                                                        }
                                                        className="flex h-8 w-8 items-center justify-center border-l border-border bg-muted text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeLine(
                                                            line.articulo_id,
                                                        )
                                                    }
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <InputError
                                message={
                                    (
                                        salidaForm.errors as Record<
                                            string,
                                            string
                                        >
                                    ).lineas
                                }
                            />
                        </div>

                        {/* Vehículo (oculto en galpón: se asigna EXTERNO automáticamente) */}
                        {isGalponSalida ? (
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                                <Warehouse className="h-5 w-5 shrink-0 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-foreground">
                                        Consumo de galpón
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Se asigna a{' '}
                                        <span className="font-mono font-semibold">
                                            EXTERNO
                                        </span>{' '}
                                        · «{GALPON_DESC}»
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                    ¿A qué vehículo?
                                </span>
                                {salidaForm.data.patente ? (
                                    (() => {
                                        const v = vehiculos.find(
                                            (veh) =>
                                                veh.patente ===
                                                salidaForm.data.patente,
                                        );

                                        return (
                                            <div className="flex items-center justify-between rounded-xl border border-amber-500/50 bg-amber-500/5 px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <p className="font-mono text-sm font-bold tracking-widest text-foreground uppercase">
                                                            {
                                                                salidaForm.data
                                                                    .patente
                                                            }
                                                        </p>
                                                        {v && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {v.marca}{' '}
                                                                {v.modelo}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {v?.user?.name && (
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground">
                                                                {v.user.name
                                                                    .split(' ')
                                                                    .map(
                                                                        (
                                                                            w: string,
                                                                        ) =>
                                                                            w[0],
                                                                    )
                                                                    .join('')
                                                                    .slice(0, 2)
                                                                    .toUpperCase()}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">
                                                                {v.user.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        salidaForm.setData(
                                                            'patente',
                                                            '',
                                                        )
                                                    }
                                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <Combobox
                                        placeholder="Buscar patente, chofer, marca o modelo..."
                                        options={patenteOptions}
                                        value={salidaForm.data.patente}
                                        onSelect={(o) =>
                                            salidaForm.setData(
                                                'patente',
                                                o.value,
                                            )
                                        }
                                        uppercase
                                    />
                                )}
                                <InputError
                                    message={salidaForm.errors.patente}
                                />
                            </div>
                        )}

                        {/* Solicitante */}
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-foreground">
                                ¿Quién lo pidió?
                            </span>
                            <Input
                                type="text"
                                value={salidaForm.data.solicitante}
                                onChange={(e) =>
                                    salidaForm.setData(
                                        'solicitante',
                                        e.target.value,
                                    )
                                }
                                placeholder="Nombre del solicitante"
                            />
                            <InputError
                                message={salidaForm.errors.solicitante}
                            />
                        </div>

                        {salidaForm.data.patente === 'EXTERNO' && (
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                    Descripción
                                </span>
                                <Input
                                    type="text"
                                    value={salidaForm.data.descripcion}
                                    onChange={(e) =>
                                        salidaForm.setData(
                                            'descripcion',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Motivo o detalle del egreso externo..."
                                />
                                <InputError
                                    message={salidaForm.errors.descripcion}
                                />
                            </div>
                        )}

                        <DialogFooter className="flex-row items-center border-t border-border pt-4">
                            <div className="mr-auto flex items-center gap-2">
                                {salidaValida ? (
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    </span>
                                ) : (
                                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                                )}
                                <span className="text-xs text-muted-foreground">
                                    {salidaValida
                                        ? 'Listo para confirmar'
                                        : 'Completá los datos para confirmar'}
                                </span>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeSalidaModal}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    salidaForm.processing || !salidaValida
                                }
                            >
                                {salidaForm.processing ? (
                                    'Procesando...'
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" /> Confirmar
                                        egreso
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Modal Ingreso / Nuevo Artículo ──────────────────────────────── */}
            <Dialog
                open={showCreateModal}
                onOpenChange={(open) => {
                    if (!open) {
                        closeCreateModal();
                    }
                }}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                    {/* Header */}
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                            <ArrowDownCircle className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">
                                Ingreso de stock
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Sumá unidades al depósito o registrá un repuesto
                                nuevo.
                            </DialogDescription>
                        </div>
                    </div>

                    {/* Toggle de modo */}
                    <div className="border-b border-border bg-muted px-3 py-2.5">
                        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
                            <button
                                type="button"
                                onClick={() => isNewMode && toggleNewMode()}
                                className={cn(
                                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all',
                                    !isNewMode
                                        ? 'bg-card text-foreground shadow'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Sumar a existente
                            </button>
                            <button
                                type="button"
                                onClick={() => !isNewMode && toggleNewMode()}
                                className={cn(
                                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all',
                                    isNewMode
                                        ? 'bg-card text-foreground shadow'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                Repuesto nuevo
                            </button>
                        </div>
                    </div>

                    <form
                        onSubmit={handleCreateSubmit}
                        className="flex flex-col gap-5 p-5"
                    >
                        {/* Artículo */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-sm font-medium">
                                {isNewMode
                                    ? 'Nombre del repuesto'
                                    : '¿Qué repuesto entró?'}
                            </Label>
                            {isRestock && matchedItem ? (
                                <div className="flex items-center gap-3 rounded-xl border-2 border-orange-500/50 bg-orange-500/10 px-3.5 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-foreground">
                                            {matchedItem.descripcion}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {matchedItem.stock} en depósito ·
                                            mínimo {matchedItem.min_stock}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMatchedItem(null);
                                            setAdjustingMinStock(false);
                                            createForm.setData({
                                                ...createForm.data,
                                                descripcion: '',
                                                stock: '0',
                                            });
                                            setTimeout(
                                                () =>
                                                    descripcionRef.current?.focus(),
                                                50,
                                            );
                                        }}
                                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-orange-500/20 hover:text-foreground"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : isNewMode ? (
                                <Input
                                    id="create-descripcion"
                                    ref={descripcionRef}
                                    autoComplete="off"
                                    placeholder="Ej. Pastillas freno delant. Cruze..."
                                    value={createForm.data.descripcion}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'descripcion',
                                            e.target.value,
                                        )
                                    }
                                />
                            ) : (
                                <div className="relative">
                                    <Input
                                        id="create-descripcion"
                                        ref={descripcionRef}
                                        autoComplete="off"
                                        placeholder="Buscar repuesto..."
                                        value={createForm.data.descripcion}
                                        onChange={handleDescripcionChange}
                                        onKeyDown={handleDescripcionKeyDown}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() =>
                                            setTimeout(
                                                () => setShowSuggestions(false),
                                                150,
                                            )
                                        }
                                    />
                                    {showSuggestions &&
                                        createForm.data.descripcion.trim() !==
                                            '' && (
                                            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                                                <div className="max-h-52 divide-y divide-border overflow-y-auto">
                                                    {suggestions.length ===
                                                    0 ? (
                                                        <p className="px-3 py-2.5 text-sm text-muted-foreground">
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
                                                                        'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
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
                                                                    <span className="font-medium text-foreground">
                                                                        {
                                                                            item.descripcion
                                                                        }
                                                                    </span>
                                                                    <span className="ml-4 shrink-0 text-xs text-muted-foreground tabular-nums">
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
                            <InputError
                                message={createForm.errors.descripcion}
                            />
                        </div>

                        {/* Cantidad */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">
                                    {isNewMode
                                        ? 'Stock inicial'
                                        : 'Cantidad que ingresa'}
                                </Label>
                                {!isNewMode && (
                                    <div className="flex items-center gap-1">
                                        <span className="mr-0.5 text-xs text-muted-foreground">
                                            Sumar
                                        </span>
                                        {[1, 5, 10, 25].map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() =>
                                                    createForm.setData(
                                                        'stock',
                                                        String(
                                                            Math.max(
                                                                0,
                                                                Number(
                                                                    createForm
                                                                        .data
                                                                        .stock,
                                                                ) + n,
                                                            ),
                                                        ),
                                                    )
                                                }
                                                className="h-6 rounded-full border border-border bg-card px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                                            >
                                                +{n}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            createForm.setData(
                                                'stock',
                                                String(
                                                    Math.max(
                                                        0,
                                                        Number(
                                                            createForm.data
                                                                .stock,
                                                        ) - 1,
                                                    ),
                                                ),
                                            )
                                        }
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted transition-colors hover:bg-muted/60"
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="w-12 text-center text-2xl font-semibold text-foreground tabular-nums">
                                        {createForm.data.stock}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            createForm.setData(
                                                'stock',
                                                String(
                                                    Number(
                                                        createForm.data.stock,
                                                    ) + 1,
                                                ),
                                            )
                                        }
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted transition-colors hover:bg-muted/60"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                {isRestock &&
                                    matchedItem &&
                                    Number(createForm.data.stock) > 0 && (
                                        <>
                                            <div className="h-8 w-px bg-border" />
                                            <div className="flex-1">
                                                <p className="text-xs text-muted-foreground">
                                                    Quedará en depósito
                                                </p>
                                                <p className="text-lg leading-tight font-semibold text-foreground tabular-nums">
                                                    {matchedItem.stock +
                                                        Number(
                                                            createForm.data
                                                                .stock,
                                                        )}{' '}
                                                    <span className="text-sm font-normal text-muted-foreground">
                                                        unidades
                                                    </span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                                                <TrendingUp className="h-3 w-3" />
                                                +{createForm.data.stock}
                                            </div>
                                        </>
                                    )}
                            </div>
                            <InputError message={createForm.errors.stock} />
                        </div>

                        {/* Ajustar stock mínimo */}
                        {isRestock && matchedItem && (
                            <div>
                                {!adjustingMinStock ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAdjustingMinStock(true)
                                        }
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        Ajustar stock mínimo (actual:{' '}
                                        {matchedItem.min_stock} )
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Label className="shrink-0 text-xs text-muted-foreground">
                                            Stock mínimo
                                        </Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            className="h-7 text-xs"
                                            value={createForm.data.min_stock}
                                            onChange={(e) =>
                                                createForm.setData(
                                                    'min_stock',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAdjustingMinStock(false)
                                            }
                                            className="text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Campos extra para modo nuevo */}
                        {isNewMode && (
                            <>
                                {/* Clasificación: Repuesto vs Galpón */}
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-sm font-medium">
                                        Tipo de artículo
                                    </Label>
                                    <div className="flex gap-1 rounded-xl bg-muted p-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                createForm.setData(
                                                    'repuestos',
                                                    true,
                                                )
                                            }
                                            className={cn(
                                                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all',
                                                createForm.data.repuestos
                                                    ? 'bg-card text-foreground shadow'
                                                    : 'text-muted-foreground hover:text-foreground',
                                            )}
                                        >
                                            <Wrench className="h-3.5 w-3.5" />
                                            Repuesto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                createForm.setData(
                                                    'repuestos',
                                                    false,
                                                )
                                            }
                                            className={cn(
                                                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all',
                                                !createForm.data.repuestos
                                                    ? 'bg-card text-foreground shadow'
                                                    : 'text-muted-foreground hover:text-foreground',
                                            )}
                                        >
                                            <Warehouse className="h-3.5 w-3.5" />
                                            Galpón
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
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
                                            placeholder="Opcional"
                                        />
                                        <InputError
                                            message={createForm.errors.codigo}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="min_stock">
                                            Stock mínimo
                                        </Label>
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
                                            message={
                                                createForm.errors.min_stock
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
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
                            </>
                        )}

                        <DialogFooter className="flex-row items-center border-t border-border pt-4">
                            {isRestock && Number(createForm.data.stock) > 0 && (
                                <div className="mr-auto flex items-center gap-2 text-sm font-medium text-emerald-500">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    </span>
                                    +{createForm.data.stock} unidades
                                </div>
                            )}
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
                                {createForm.processing ? (
                                    'Procesando...'
                                ) : isNewMode ? (
                                    'Crear repuesto'
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" /> Confirmar
                                        ingreso
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
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
