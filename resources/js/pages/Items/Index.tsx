import { Head, useForm, router, usePage } from '@inertiajs/react';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Check,
    FileDown,
    History,
    Loader2,
    Pencil,
    Search,
    TrendingUp,
    Trash2,
    X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
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
import { index, salidaMultiple, store, updatePrecio } from '@/routes/articulos';
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
        if (isNaN(precio) || precio < 0) return;
        setSavingPriceId(item.id);
        router.patch(updatePrecio.url(item.id), { precio }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => cancelEditPrice(),
            onFinish: () => setSavingPriceId(null),
        });
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

    // ─── Selección múltiple para salida ──────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const selectedItems = useMemo(
        () => items.filter((i) => selectedIds.includes(i.id)),
        [items, selectedIds],
    );

    function toggleSelect(id: number) {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    }

    const allFilteredSelected =
        filteredItems.length > 0 &&
        filteredItems.every((i) => selectedIds.includes(i.id));

    function toggleSelectAll() {
        if (allFilteredSelected) {
            const filteredIds = filteredItems.map((i) => i.id);
            setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
        } else {
            setSelectedIds((prev) => [
                ...new Set([...prev, ...filteredItems.map((i) => i.id)]),
            ]);
        }
    }

    // ─── Modal Salida múltiple (OUT) ─────────────────────────────────────────
    const [showSalidaModal, setShowSalidaModal] = useState(false);
    // Cantidades por artículo (id -> string).
    const [cantidades, setCantidades] = useState<Record<number, string>>({});
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
                sub: `${v.marca} ${v.modelo}`,
            })),
        [vehiculos],
    );

    function openSalidaModal() {
        if (selectedItems.length === 0) return;
        const init: Record<number, string> = {};
        selectedItems.forEach((i) => {
            init[i.id] = '1';
        });
        setCantidades(init);
        salidaForm.reset();
        salidaForm.clearErrors();
        setShowSalidaModal(true);
    }

    function closeSalidaModal() {
        setShowSalidaModal(false);
        salidaForm.reset();
        salidaForm.clearErrors();
    }

    function removeFromSalida(id: number) {
        setSelectedIds((prev) => prev.filter((x) => x !== id));
        setCantidades((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }

    // ¿Alguna línea supera el stock disponible?
    const lineErrors = useMemo(() => {
        const errs: Record<number, string> = {};
        selectedItems.forEach((i) => {
            const c = Number(cantidades[i.id] ?? '0');
            if (!c || c < 1) {
                errs[i.id] = 'Cantidad inválida';
            } else if (c > i.stock) {
                errs[i.id] = `Máx: ${i.stock}`;
            }
        });
        return errs;
    }, [selectedItems, cantidades]);

    const salidaValida =
        selectedItems.length > 0 &&
        Object.keys(lineErrors).length === 0 &&
        !!salidaForm.data.patente;

    function handleSalidaSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!salidaValida) return;

        const lineas = selectedItems.map((i) => ({
            articulo_id: i.id,
            cantidad: Number(cantidades[i.id]),
        }));

        router.post(
            salidaMultiple.url(),
            {
                patente: salidaForm.data.patente,
                solicitante: salidaForm.data.solicitante,
                descripcion: salidaForm.data.descripcion,
                lineas,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    closeSalidaModal();
                    setSelectedIds([]);
                    setCantidades({});
                },
            },
        );
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

    const suggestions = useMemo(() => {
        const q = createForm.data.descripcion.toLowerCase().trim();
        if (!q) return items;
        return items.filter((i) => i.descripcion.toLowerCase().includes(q));
    }, [items, createForm.data.descripcion]);

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

    function handleDescripcionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
    }

    function handleCreateSubmit(e: React.FormEvent) {
        e.preventDefault();
        createForm.post(store.url(), {
            onSuccess: () => closeCreateModal(),
            preserveScroll: true,
            preserveState: true,
        });
    }

    const colSpan = canWrite ? 6 : 5;

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
                                    {canWrite && (
                                        <th scope="col" className="w-[5%] px-4 py-3 sm:px-6 sm:py-4">
                                            <input
                                                type="checkbox"
                                                aria-label="Seleccionar todos"
                                                checked={allFilteredSelected}
                                                onChange={toggleSelectAll}
                                                className="h-4 w-4 rounded border-border"
                                            />
                                        </th>
                                    )}
                                    <th scope="col" className="w-[35%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Descripción
                                    </th>
                                    <th scope="col" className="w-[14%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Código
                                    </th>
                                    <th scope="col" className="w-[14%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Stock Actual
                                    </th>
                                    <th scope="col" className="w-[14%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Stock Mínimo
                                    </th>
                                    <th scope="col" className="w-[18%] px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">
                                        Precio
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={colSpan} className="px-6 py-12 text-center text-muted-foreground">
                                            No hay artículos registrados o no coinciden con la búsqueda.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item) => {
                                        const lowStock = item.stock <= item.min_stock;
                                        const selected = selectedIds.includes(item.id);
                                        return (
                                            <tr
                                                key={item.id}
                                                className={cn(
                                                    'transition-colors',
                                                    selected
                                                        ? 'bg-primary/5'
                                                        : lowStock
                                                            ? 'bg-red-100 hover:bg-red-200/80 dark:bg-red-950/50 dark:hover:bg-red-950/70'
                                                            : 'bg-card hover:bg-muted/40',
                                                )}
                                            >
                                                {canWrite && (
                                                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Seleccionar ${item.descripcion}`}
                                                            checked={selected}
                                                            disabled={item.stock < 1}
                                                            onChange={() => toggleSelect(item.id)}
                                                            className="h-4 w-4 rounded border-border disabled:opacity-40"
                                                        />
                                                    </td>
                                                )}
                                                <td
                                                    className={cn(
                                                        'px-4 py-3 font-medium sm:px-6 sm:py-4',
                                                        lowStock ? 'text-red-800 dark:text-red-300' : 'text-foreground',
                                                    )}
                                                >
                                                    <span className="truncate">{item.descripcion}</span>
                                                    {item.repuestos && (
                                                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                            Repuesto
                                                        </span>
                                                    )}
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
                                                <td className="px-4 py-3 sm:px-6 sm:py-4">
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
                                                            <button type="button" onClick={() => submitPrice(item)} disabled={savingPriceId === item.id} className="text-foreground hover:text-foreground/80 disabled:cursor-default">
                                                                {savingPriceId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
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
                                No hay artículos registrados o no coinciden con la búsqueda.
                            </li>
                        ) : (
                            filteredItems.map((item) => {
                                const lowStock = item.stock <= item.min_stock;
                                const selected = selectedIds.includes(item.id);
                                return (
                                    <li
                                        key={item.id}
                                        className={cn(
                                            'flex items-start gap-3 p-4',
                                            selected
                                                ? 'bg-primary/5'
                                                : lowStock && 'bg-red-50 dark:bg-red-950/30',
                                        )}
                                    >
                                        {canWrite && (
                                            <input
                                                type="checkbox"
                                                aria-label={`Seleccionar ${item.descripcion}`}
                                                checked={selected}
                                                disabled={item.stock < 1}
                                                onChange={() => toggleSelect(item.id)}
                                                className="mt-1 h-4 w-4 shrink-0 rounded border-border disabled:opacity-40"
                                            />
                                        )}
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
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            </div>

            {/* ─── Botón flotante: Registrar salida (N) ───────────────────────── */}
            {canWrite && selectedIds.length > 0 && (
                <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
                    <Button
                        size="lg"
                        className="shadow-lg"
                        onClick={openSalidaModal}
                    >
                        <ArrowUpCircle className="h-5 w-5" />
                        Registrar salida ({selectedIds.length})
                    </Button>
                </div>
            )}

            {/* ─── Modal Salida múltiple ──────────────────────────────────────── */}
            <Dialog
                open={showSalidaModal}
                onOpenChange={(open) => {
                    if (!open) closeSalidaModal();
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Registrar Salida</DialogTitle>
                        <DialogDescription>
                            {selectedItems.length} artículo(s) en este pedido. Todo se despacha al mismo vehículo.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSalidaSubmit} className="grid gap-4">
                        {/* Líneas del pedido */}
                        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Artículo</th>
                                        <th className="w-24 px-3 py-2 text-left font-medium">Cantidad</th>
                                        <th className="w-8 px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {selectedItems.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-3 py-2">
                                                <p className="font-medium text-foreground">{item.descripcion}</p>
                                                <p className="text-[11px] text-muted-foreground">Disponible: {item.stock}</p>
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max={item.stock}
                                                    value={cantidades[item.id] ?? ''}
                                                    onChange={(e) =>
                                                        setCantidades((prev) => ({
                                                            ...prev,
                                                            [item.id]: e.target.value,
                                                        }))
                                                    }
                                                    className={cn(
                                                        'h-8 w-20 text-sm',
                                                        lineErrors[item.id] && 'border-destructive',
                                                    )}
                                                />
                                                {lineErrors[item.id] && (
                                                    <p className="mt-0.5 text-[10px] text-destructive">{lineErrors[item.id]}</p>
                                                )}
                                            </td>
                                            <td className="px-2 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => removeFromSalida(item.id)}
                                                    className="text-muted-foreground hover:text-destructive"
                                                    aria-label="Quitar del pedido"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="patente">Patente del Vehículo</Label>
                            <Combobox
                                id="patente"
                                placeholder="Buscar patente, marca o modelo..."
                                options={patenteOptions}
                                value={salidaForm.data.patente}
                                onSelect={(o) => salidaForm.setData('patente', o.value)}
                                uppercase
                            />
                            <InputError message={salidaForm.errors.patente} />
                            <InputError message={(salidaForm.errors as Record<string, string>).lineas} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="solicitante">Solicitante</Label>
                            <Input
                                id="solicitante"
                                type="text"
                                value={salidaForm.data.solicitante}
                                onChange={(e) => salidaForm.setData('solicitante', e.target.value)}
                                placeholder="Nombre del solicitante"
                            />
                            <InputError message={salidaForm.errors.solicitante} />
                        </div>

                        {salidaForm.data.patente === 'EXTERNO' && (
                            <div className="grid gap-2">
                                <Label htmlFor="descripcion">Descripción (Externo)</Label>
                                <Input
                                    id="descripcion"
                                    type="text"
                                    value={salidaForm.data.descripcion}
                                    onChange={(e) => salidaForm.setData('descripcion', e.target.value)}
                                    placeholder="Motivo o detalle del egreso externo..."
                                />
                                <InputError message={salidaForm.errors.descripcion} />
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeSalidaModal}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={salidaForm.processing || !salidaValida}>
                                {salidaForm.processing ? 'Procesando...' : 'Confirmar salida'}
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
                            {isNewMode ? 'Nuevo Artículo' : 'Ingreso de Artículo'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleCreateSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="create-descripcion">Artículo</Label>
                            {isNewMode ? (
                                <Input
                                    id="create-descripcion"
                                    ref={descripcionRef}
                                    autoComplete="off"
                                    placeholder="Nombre del nuevo artículo..."
                                    value={createForm.data.descripcion}
                                    onChange={(e) => createForm.setData('descripcion', e.target.value)}
                                />
                            ) : (
                                <div className="relative">
                                    <Input
                                        id="create-descripcion"
                                        ref={descripcionRef}
                                        autoComplete="off"
                                        placeholder="Buscar artículo..."
                                        value={createForm.data.descripcion}
                                        onChange={handleDescripcionChange}
                                        onKeyDown={handleDescripcionKeyDown}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => {
                                            setTimeout(() => setShowSuggestions(false), 150);
                                        }}
                                    />
                                    {showSuggestions && createForm.data.descripcion.trim() !== '' && (
                                        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                                            <div className="max-h-52 overflow-y-auto">
                                                {suggestions.length === 0 ? (
                                                    <p className="px-3 py-2 text-sm text-muted-foreground">
                                                        Sin coincidencias
                                                    </p>
                                                ) : (
                                                    suggestions.map((item, idx) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            className={cn(
                                                                'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                                                                highlightedIndex === idx ? 'bg-accent' : 'hover:bg-accent/60',
                                                            )}
                                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                                            onMouseDown={() => handleSelectSuggestion(item)}
                                                        >
                                                            <span className="font-medium">{item.descripcion}</span>
                                                            <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                                                                Stock: {item.stock}
                                                            </span>
                                                        </button>
                                                    ))
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
                            <InputError message={createForm.errors.descripcion} />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="codigo">Código</Label>
                                <Input
                                    id="codigo"
                                    type="text"
                                    value={createForm.data.codigo}
                                    onChange={(e) => createForm.setData('codigo', e.target.value)}
                                    placeholder="Código del artículo"
                                />
                                <InputError message={createForm.errors.codigo} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="repuestos" className="flex items-center gap-2">
                                    <input
                                        id="repuestos"
                                        type="checkbox"
                                        checked={createForm.data.repuestos}
                                        onChange={(e) => createForm.setData('repuestos', e.target.checked)}
                                        className="h-4 w-4 rounded border-border"
                                    />
                                    Es repuesto
                                </Label>
                                <p className="text-xs text-muted-foreground">Marcar si el artículo es un repuesto.</p>
                                <InputError message={createForm.errors.repuestos} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="stock">
                                    {isRestock ? 'Cantidad a ingresar' : 'Stock Inicial'}
                                </Label>
                                <Input
                                    id="stock"
                                    type="number"
                                    min="0"
                                    value={createForm.data.stock}
                                    onChange={(e) => createForm.setData('stock', e.target.value)}
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
                                    onChange={(e) => createForm.setData('min_stock', e.target.value)}
                                />
                                <InputError message={createForm.errors.min_stock} />
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
                                    onChange={(e) => createForm.setData('precio', e.target.value)}
                                    placeholder="0.00"
                                />
                                <InputError message={createForm.errors.precio} />
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
                                <Button type="button" variant="outline" onClick={closeCreateModal}>
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        createForm.processing ||
                                        !createForm.data.descripcion.trim() ||
                                        (!isNewMode && !matchedItem) ||
                                        (isRestock && Number(createForm.data.stock) < 1)
                                    }
                                >
                                    {createForm.processing ? 'Procesando...' : 'Confirmar'}
                                </Button>
                            </div>
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
