import { Head, useForm, router } from '@inertiajs/react';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    FileDown,
    History,
    Plus,
    Search,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import InputError from '@/components/input-error';
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
import { index, movimiento, store } from '@/routes/articulos';
import { index as transactionsIndex } from '@/routes/transactions';
import type { Articulo, Vehiculo } from '@/types';

interface Props {
    items: Articulo[];
    vehiculos: Pick<Vehiculo, 'id' | 'patente' | 'marca' | 'modelo'>[];
}

export default function ItemsIndex({ items, vehiculos }: Props) {
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
    const [showPatenteDropdown, setShowPatenteDropdown] = useState(false);
    const [patenteSearch, setPatenteSearch] = useState('');
    const [patenteHighlightedIndex, setPatenteHighlightedIndex] = useState(-1);
    const [movLocalErrors, setMovLocalErrors] = useState<{ cantidad?: string }>(
        {},
    );
    const patenteRef = useRef<HTMLInputElement>(null);

    const movForm = useForm({
        tipo: 'OUT' as string,
        cantidad: '' as string,
        solicitante: '' as string,
        patente: '' as string,
        descripcion: '' as string,
    });

    const patenteSuggestions = useMemo(() => {
        const q = patenteSearch.toLowerCase().trim();
        if (!q) return vehiculos;
        return vehiculos.filter(
            (v) =>
                v.patente.toLowerCase().includes(q) ||
                v.marca.toLowerCase().includes(q) ||
                v.modelo.toLowerCase().includes(q),
        );
    }, [vehiculos, patenteSearch]);

    function openMovModal(item: Articulo) {
        setSelectedItem(item);
        movForm.reset();
        movForm.setData('tipo', 'OUT');
        setShowPatenteDropdown(false);
        setPatenteSearch('');
        setPatenteHighlightedIndex(-1);
        setMovLocalErrors({});
        setShowMovModal(true);
    }

    function closeMovModal() {
        setShowMovModal(false);
        setSelectedItem(null);
        movForm.reset();
        setShowPatenteDropdown(false);
        setPatenteSearch('');
        setPatenteHighlightedIndex(-1);
        setMovLocalErrors({});
    }

    function handlePatenteKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!showPatenteDropdown || patenteSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setPatenteHighlightedIndex(
                (prev) => (prev + 1) % patenteSuggestions.length,
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setPatenteHighlightedIndex((prev) =>
                prev <= 0 ? patenteSuggestions.length - 1 : prev - 1,
            );
        } else if (e.key === 'Enter' && patenteHighlightedIndex >= 0) {
            e.preventDefault();
            const v = patenteSuggestions[patenteHighlightedIndex];
            movForm.setData('patente', v.patente);
            setPatenteSearch(v.patente);
            setShowPatenteDropdown(false);
            setPatenteHighlightedIndex(-1);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const v =
                patenteHighlightedIndex >= 0
                    ? patenteSuggestions[patenteHighlightedIndex]
                    : patenteSuggestions[0];
            movForm.setData('patente', v.patente);
            setPatenteSearch(v.patente);
            setShowPatenteDropdown(false);
            setPatenteHighlightedIndex(-1);
        } else if (e.key === 'Escape') {
            setShowPatenteDropdown(false);
            setPatenteHighlightedIndex(-1);
        }
    }

    function handleSelectPatente(v: (typeof vehiculos)[number]) {
        movForm.setData('patente', v.patente);
        setPatenteSearch(v.patente);
        setShowPatenteDropdown(false);
        setPatenteHighlightedIndex(-1);
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
        stock: '0',
        min_stock: '0',
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
            stock: '0',
            min_stock: '0',
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
            stock: '0',
            min_stock: String(item.min_stock),
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
                            onClick={() => router.get(transactionsIndex.url())}
                        >
                            <History className="h-4 w-4" />
                            <span className="hidden sm:inline">Historial</span>
                        </Button>
                        <Button size="sm" onClick={openCreateModal}>
                            <ArrowDownCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Ingreso</span>
                        </Button>
                    </div>
                </div>

                {/* Tabla */}
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-muted-foreground">
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Descripción
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Stock Actual
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Stock Mínimo
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
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
                                                        'px-4 py-3 font-medium whitespace-nowrap sm:px-6 sm:py-4',
                                                        lowStock
                                                            ? 'text-red-800 dark:text-red-300'
                                                            : 'text-foreground',
                                                    )}
                                                >
                                                    {item.descripcion}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap sm:px-6 sm:py-4">
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
                                                <td className="px-4 py-3 whitespace-nowrap sm:px-6 sm:py-4">
                                                    {item.min_stock}
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap sm:px-6 sm:py-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            openMovModal(item)
                                                        }
                                                    >
                                                        <ArrowUpCircle className="h-4 w-4" />
                                                        <span className="hidden sm:inline">Salida</span>
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
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
                            <div className="relative">
                                <Input
                                    id="patente"
                                    ref={patenteRef}
                                    autoComplete="off"
                                    placeholder="Buscar patente, marca o modelo..."
                                    value={patenteSearch}
                                    onChange={(e) => {
                                        setPatenteSearch(e.target.value);
                                        movForm.setData('patente', '');
                                        setPatenteHighlightedIndex(-1);
                                        setShowPatenteDropdown(true);
                                    }}
                                    onKeyDown={handlePatenteKeyDown}
                                    onFocus={() => setShowPatenteDropdown(true)}
                                    onBlur={() =>
                                        setTimeout(
                                            () => setShowPatenteDropdown(false),
                                            150,
                                        )
                                    }
                                />
                                {showPatenteDropdown && (
                                    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                                        <div className="max-h-52 overflow-y-auto">
                                            {patenteSuggestions.length === 0 ? (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                    Sin coincidencias
                                                </p>
                                            ) : (
                                                patenteSuggestions.map(
                                                    (v, idx) => (
                                                        <button
                                                            key={v.id}
                                                            type="button"
                                                            className={cn(
                                                                'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                                                                patenteHighlightedIndex ===
                                                                    idx
                                                                    ? 'bg-accent'
                                                                    : 'hover:bg-accent/60',
                                                            )}
                                                            onMouseEnter={() =>
                                                                setPatenteHighlightedIndex(
                                                                    idx,
                                                                )
                                                            }
                                                            onMouseDown={() =>
                                                                handleSelectPatente(
                                                                    v,
                                                                )
                                                            }
                                                        >
                                                            <span className="font-medium">
                                                                {v.patente}
                                                            </span>
                                                            <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                                                                {v.marca}{' '}
                                                                {v.modelo}
                                                            </span>
                                                        </button>
                                                    ),
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
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

                        <div className="grid grid-cols-2 gap-4">
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
