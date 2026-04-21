import { Head, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    X,
    ArrowDownCircle,
    ArrowUpCircle,
    FileDown,
    RotateCcw,
    AlertTriangle,
    Loader2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { index } from '@/routes/transactions';
import { index as articulosIndex } from '@/routes/articulos';
import type { Articulo, Vehiculo, User } from '@/types';

interface Transaccion {
    id: number;
    articulo_id: number;
    vehiculo_id: number | null;
    user_id: number;
    solicitante: string | null;
    tipo: 'IN' | 'OUT';
    cantidad: number;
    descripcion: string | null;
    created_at: string;
    articulo: Articulo;
    vehiculo?: Pick<Vehiculo, 'id' | 'patente' | 'marca' | 'modelo'>;
    user?: User;
}

interface PaginationInfo {
    data: Transaccion[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    auth: {
        user: User;
    };
    transactions: PaginationInfo;
    filters: {
        article?: string;
        plate?: string;
        applicant?: string;
        from?: string;
        to?: string;
    };
    items: Pick<Articulo, 'id' | 'descripcion'>[];
    vehiculos: Pick<Vehiculo, 'id' | 'patente' | 'marca' | 'modelo'>[];
}

export default function TransactionsIndex({
    auth,
    transactions,
    filters,
    items,
    vehiculos,
}: Props) {
    const isAdmin = auth.user.role === 'administrador';

    // ─── Estado anulación ────────────────────────────────────────────────────
    const [annulDialog, setAnnulDialog] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaccion | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    function openAnnulModal(tx: Transaccion) {
        setSelectedTx(tx);
        setAnnulDialog(true);
    }

    function handleAnnul() {
        if (!selectedTx) return;

        setIsProcessing(true);
        router.post(`/transactions/${selectedTx.id}/annul`, {}, {
            onSuccess: () => {
                setAnnulDialog(false);
                setSelectedTx(null);
            },
            onFinish: () => setIsProcessing(false),
            preserveScroll: true,
        });
    }
    // ─── Filtro: Artículo (select con dropdown) ──────────────────────────────
    const [articleSearch, setArticleSearch] = useState('');
    const [selectedArticleId, setSelectedArticleId] = useState(
        filters.article || '',
    );
    const [showArticleDropdown, setShowArticleDropdown] = useState(false);
    const [articleHighlightedIndex, setArticleHighlightedIndex] = useState(-1);
    const articleRef = useRef<HTMLInputElement>(null);

    const articleSuggestions = useMemo(() => {
        const q = articleSearch.toLowerCase().trim();
        if (!q) return items;
        return items.filter((i) => i.descripcion.toLowerCase().includes(q));
    }, [items, articleSearch]);

    // Inicializar el texto del input con el artículo seleccionado desde filtros
    useEffect(() => {
        if (filters.article) {
            const found = items.find((i) => String(i.id) === filters.article);
            if (found) {
                setArticleSearch(found.descripcion);
                setSelectedArticleId(String(found.id));
            }
        }
    }, []);

    function handleSelectArticle(item: Pick<Articulo, 'id' | 'descripcion'>) {
        setArticleSearch(item.descripcion);
        setSelectedArticleId(String(item.id));
        setShowArticleDropdown(false);
        setArticleHighlightedIndex(-1);
    }

    function handleArticleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!showArticleDropdown || articleSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setArticleHighlightedIndex(
                (prev) => (prev + 1) % articleSuggestions.length,
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setArticleHighlightedIndex((prev) =>
                prev <= 0 ? articleSuggestions.length - 1 : prev - 1,
            );
        } else if (e.key === 'Enter' && articleHighlightedIndex >= 0) {
            e.preventDefault();
            handleSelectArticle(articleSuggestions[articleHighlightedIndex]);
        } else if (e.key === 'Tab' && articleSuggestions.length > 0) {
            e.preventDefault();
            const target =
                articleHighlightedIndex >= 0
                    ? articleSuggestions[articleHighlightedIndex]
                    : articleSuggestions[0];
            handleSelectArticle(target);
        } else if (e.key === 'Escape') {
            setShowArticleDropdown(false);
            setArticleHighlightedIndex(-1);
        }
    }

    // ─── Filtro: Patente (select con dropdown) ───────────────────────────────
    const [plateSearch, setPlateSearch] = useState(filters.plate || '');
    const [selectedPlate, setSelectedPlate] = useState(filters.plate || '');
    const [showPlateDropdown, setShowPlateDropdown] = useState(false);
    const [plateHighlightedIndex, setPlateHighlightedIndex] = useState(-1);
    const plateRef = useRef<HTMLInputElement>(null);

    const plateSuggestions = useMemo(() => {
        const q = plateSearch.toLowerCase().trim();
        if (!q) return vehiculos;
        return vehiculos.filter(
            (v) =>
                v.patente.toLowerCase().includes(q) ||
                v.marca.toLowerCase().includes(q) ||
                v.modelo.toLowerCase().includes(q),
        );
    }, [vehiculos, plateSearch]);

    function handleSelectPlate(
        v: Pick<Vehiculo, 'id' | 'patente' | 'marca' | 'modelo'>,
    ) {
        setPlateSearch(v.patente);
        setSelectedPlate(v.patente);
        setShowPlateDropdown(false);
        setPlateHighlightedIndex(-1);
    }

    function handlePlateKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!showPlateDropdown || plateSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setPlateHighlightedIndex(
                (prev) => (prev + 1) % plateSuggestions.length,
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setPlateHighlightedIndex((prev) =>
                prev <= 0 ? plateSuggestions.length - 1 : prev - 1,
            );
        } else if (e.key === 'Enter' && plateHighlightedIndex >= 0) {
            e.preventDefault();
            handleSelectPlate(plateSuggestions[plateHighlightedIndex]);
        } else if (e.key === 'Tab' && plateSuggestions.length > 0) {
            e.preventDefault();
            const target =
                plateHighlightedIndex >= 0
                    ? plateSuggestions[plateHighlightedIndex]
                    : plateSuggestions[0];
            handleSelectPlate(target);
        } else if (e.key === 'Escape') {
            setShowPlateDropdown(false);
            setPlateHighlightedIndex(-1);
        }
    }

    // ─── Filtro: Solicitante ─────────────────────────────────────────────────
    const [applicantQuery, setApplicantQuery] = useState(
        filters.applicant || '',
    );

    // ─── Filtro: Fechas ──────────────────────────────────────────────────────
    const [fromDate, setFromDate] = useState(filters.from || '');
    const [toDate, setToDate] = useState(filters.to || '');

    // ─── Efecto de búsqueda con debounce ─────────────────────────────────────
    const isMounted = useRef(false);

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }

        const hasChanges =
            selectedArticleId !== (filters.article || '') ||
            selectedPlate !== (filters.plate || '') ||
            applicantQuery !== (filters.applicant || '') ||
            fromDate !== (filters.from || '') ||
            toDate !== (filters.to || '');

        if (!hasChanges) return;

        const timeoutId = setTimeout(() => {
            const activeFilters: Record<string, string> = {};
            if (selectedArticleId) activeFilters.article = selectedArticleId;
            if (selectedPlate) activeFilters.plate = selectedPlate;
            if (applicantQuery) activeFilters.applicant = applicantQuery;
            if (fromDate) activeFilters.from = fromDate;
            if (toDate) activeFilters.to = toDate;

            router.get(index.url(), activeFilters, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [selectedArticleId, selectedPlate, applicantQuery, fromDate, toDate, filters]);

    function clearFilters() {
        setArticleSearch('');
        setSelectedArticleId('');
        setPlateSearch('');
        setSelectedPlate('');
        setApplicantQuery('');
        setFromDate('');
        setToDate('');
    }

    const hasActiveFilters =
        Boolean(selectedArticleId) ||
        Boolean(selectedPlate) ||
        Boolean(applicantQuery) ||
        Boolean(fromDate) ||
        Boolean(toDate);

    return (
        <>
            <Head title="Historial Transacciones" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.get(articulosIndex.url())}
                            className="px-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                            Historial de Transacciones
                        </h1>
                    </div>
                    <div className="sm:ml-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const params = new URLSearchParams();
                                if (selectedArticleId)
                                    params.set('article', selectedArticleId);
                                if (selectedPlate)
                                    params.set('plate', selectedPlate);
                                if (applicantQuery)
                                    params.set('applicant', applicantQuery);
                                if (fromDate) params.set('from', fromDate);
                                if (toDate) params.set('to', toDate);
                                const qs = params.toString();
                                window.open(
                                    '/pdf/transactions' + (qs ? '?' + qs : ''),
                                    '_blank',
                                );
                            }}
                        >
                            <FileDown className="h-4 w-4" />
                            <span className="hidden sm:inline">
                                Exportar PDF
                            </span>
                        </Button>
                    </div>
                </div>

                {/* Panel de Filtros */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
                        {/* Filtro Artículo */}
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="article">Artículo</Label>
                            <div className="relative">
                                <Input
                                    id="article"
                                    ref={articleRef}
                                    autoComplete="off"
                                    placeholder="Buscar artículo..."
                                    value={articleSearch}
                                    onChange={(e) => {
                                        setArticleSearch(e.target.value);
                                        setSelectedArticleId('');
                                        setArticleHighlightedIndex(-1);
                                        setShowArticleDropdown(true);
                                    }}
                                    onKeyDown={handleArticleKeyDown}
                                    onFocus={() => setShowArticleDropdown(true)}
                                    onBlur={() =>
                                        setTimeout(
                                            () => setShowArticleDropdown(false),
                                            150,
                                        )
                                    }
                                />
                                {showArticleDropdown && (
                                    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                                        <div className="max-h-52 overflow-y-auto">
                                            {articleSuggestions.length === 0 ? (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                    Sin coincidencias
                                                </p>
                                            ) : (
                                                articleSuggestions.map(
                                                    (item, idx) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            className={cn(
                                                                'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                                                                articleHighlightedIndex ===
                                                                    idx
                                                                    ? 'bg-accent'
                                                                    : 'hover:bg-accent/60',
                                                            )}
                                                            onMouseEnter={() =>
                                                                setArticleHighlightedIndex(
                                                                    idx,
                                                                )
                                                            }
                                                            onMouseDown={() =>
                                                                handleSelectArticle(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <span className="font-medium">
                                                                {
                                                                    item.descripcion
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
                        </div>

                        {/* Filtro Patente */}
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="plate">Patente</Label>
                            <div className="relative">
                                <Input
                                    id="plate"
                                    ref={plateRef}
                                    autoComplete="off"
                                    placeholder="Buscar patente..."
                                    value={plateSearch}
                                    onChange={(e) => {
                                        setPlateSearch(e.target.value);
                                        setSelectedPlate('');
                                        setPlateHighlightedIndex(-1);
                                        setShowPlateDropdown(true);
                                    }}
                                    onKeyDown={handlePlateKeyDown}
                                    onFocus={() => setShowPlateDropdown(true)}
                                    onBlur={() =>
                                        setTimeout(
                                            () => setShowPlateDropdown(false),
                                            150,
                                        )
                                    }
                                />
                                {showPlateDropdown && (
                                    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                                        <div className="max-h-52 overflow-y-auto">
                                            {plateSuggestions.length === 0 ? (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                    Sin coincidencias
                                                </p>
                                            ) : (
                                                plateSuggestions.map(
                                                    (v, idx) => (
                                                        <button
                                                            key={v.id}
                                                            type="button"
                                                            className={cn(
                                                                'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                                                                plateHighlightedIndex ===
                                                                    idx
                                                                    ? 'bg-accent'
                                                                    : 'hover:bg-accent/60',
                                                            )}
                                                            onMouseEnter={() =>
                                                                setPlateHighlightedIndex(
                                                                    idx,
                                                                )
                                                            }
                                                            onMouseDown={() =>
                                                                handleSelectPlate(
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
                        </div>

                        {/* Filtro Solicitante */}
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="applicant">Solicitante</Label>
                            <Input
                                id="applicant"
                                placeholder="Nombre..."
                                value={applicantQuery}
                                onChange={(e) =>
                                    setApplicantQuery(e.target.value)
                                }
                            />
                        </div>

                        {/* Filtro Fecha Desde */}
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="from">Desde</Label>
                            <Input
                                id="from"
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>

                        {/* Filtro Fecha Hasta */}
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="to">Hasta</Label>
                            <Input
                                id="to"
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>

                        <div className="col-span-full flex items-end sm:col-span-2 lg:col-span-1">
                            <button
                                type="button"
                                onClick={clearFilters}
                                disabled={!hasActiveFilters}
                                title="Limpiar filtros"
                                className={cn(
                                    'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-150 lg:w-9 lg:px-0',
                                    hasActiveFilters
                                        ? 'border-border text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97]'
                                        : 'cursor-not-allowed border-border/40 text-muted-foreground/30',
                                )}
                            >
                                <X className="h-4 w-4" />
                                <span className="lg:hidden">Limpiar filtros</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table + cards */}
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    {/* Desktop */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full table-fixed text-left text-sm text-muted-foreground">
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th
                                        scope="col"
                                        className="w-[10%] px-3 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Fecha
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[15%] px-3 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Artículo
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[8%] px-3 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Cant.
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[20%] px-3 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Patente
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[20%] px-3 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Descripción
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[12%] px-3 py-3 font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Solicitante
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-[10%] px-3 py-3 text-right font-medium tracking-wider sm:px-6 sm:py-4"
                                    >
                                        Usuario
                                    </th>
                                    {isAdmin && (
                                        <th
                                            scope="col"
                                            className="w-[5%] px-3 py-3 text-center font-medium tracking-wider sm:px-6 sm:py-4"
                                        >
                                            
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {transactions.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-3 py-12 text-center text-muted-foreground sm:px-6"
                                        >
                                            No hay transacciones registradas o
                                            no coinciden con la búsqueda.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.data.map((tx) => (
                                        <tr
                                            key={tx.id}
                                            className="bg-card transition-colors hover:bg-muted/40"
                                        >
                                            <td
                                                className="px-3 py-3 text-xs whitespace-nowrap sm:px-6 sm:py-4"
                                                title={new Date(
                                                    tx.created_at,
                                                ).toLocaleString('es-AR')}
                                            >
                                                {new Date(
                                                    tx.created_at,
                                                ).toLocaleString('es-AR')}
                                            </td>
                                            <td
                                                className="truncate px-3 py-3 font-medium text-foreground sm:px-6 sm:py-4"
                                                title={
                                                    tx.articulo?.descripcion ||
                                                    'N/A'
                                                }
                                            >
                                                {tx.articulo?.descripcion ||
                                                    'N/A'}
                                            </td>
                                            <td className="truncate px-3 py-3 sm:px-6 sm:py-4">
                                                <div className="flex items-center gap-2">
                                                    {tx.tipo === 'IN' ? (
                                                        <ArrowDownCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                                                    ) : (
                                                        <ArrowUpCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                                                    )}
                                                    <span className="font-semibold text-foreground">
                                                        {tx.cantidad}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 sm:px-6 sm:py-4">
                                                {tx.vehiculo ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">
                                                            {
                                                                tx.vehiculo
                                                                    .patente
                                                            }
                                                        </span>
                                                        <span className="text-xs">
                                                            {tx.vehiculo.marca}{' '}
                                                            {tx.vehiculo.modelo}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        -
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                className="truncate px-3 py-3 sm:px-6 sm:py-4"
                                                title={tx.descripcion || '-'}
                                            >
                                                {tx.descripcion || '-'}
                                            </td>
                                            <td
                                                className="truncate px-3 py-3 sm:px-6 sm:py-4"
                                                title={tx.solicitante || '-'}
                                            >
                                                {tx.solicitante || '-'}
                                            </td>
                                            <td
                                                className="truncate px-3 py-3 text-right sm:px-6 sm:py-4"
                                                title={tx.user?.name || 'N/A'}
                                            >
                                                {tx.user?.name || 'N/A'}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-3 py-3 text-center sm:px-6 sm:py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openAnnulModal(tx)
                                                        }
                                                        className="text-muted-foreground transition-colors hover:text-amber-500"
                                                        title="Anular transacción"
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <ul className="divide-y divide-border md:hidden">
                        {transactions.data.length === 0 ? (
                            <li className="px-4 py-12 text-center text-sm text-muted-foreground">
                                No hay transacciones registradas o no coinciden
                                con la búsqueda.
                            </li>
                        ) : (
                            transactions.data.map((tx) => (
                                <li
                                    key={tx.id}
                                    className="flex flex-col gap-1.5 p-4"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="line-clamp-2 flex-1 text-sm font-semibold text-foreground">
                                            {tx.articulo?.descripcion || 'N/A'}
                                        </p>
                                        <div className="flex shrink-0 items-center gap-1.5 text-sm">
                                            {tx.tipo === 'IN' ? (
                                                <ArrowDownCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                                            ) : (
                                                <ArrowUpCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                                            )}
                                            <span className="font-semibold text-foreground">
                                                {tx.cantidad}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span>
                                            {new Date(
                                                tx.created_at,
                                            ).toLocaleString('es-AR')}
                                        </span>
                                        {tx.vehiculo && (
                                            <span className="font-mono font-medium text-foreground">
                                                {tx.vehiculo.patente}
                                            </span>
                                        )}
                                    </div>
                                    {tx.descripcion && (
                                        <p className="line-clamp-2 text-xs text-muted-foreground">
                                            {tx.descripcion}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        {tx.solicitante ? (
                                            <>
                                                <span className="text-foreground">
                                                    {tx.solicitante}
                                                </span>{' '}
                                                ·{' '}
                                            </>
                                        ) : null}
                                        por{' '}
                                        <span className="text-foreground">
                                            {tx.user?.name || 'N/A'}
                                        </span>
                                    </p>
                                    {isAdmin && (
                                        <div className="mt-1 flex justify-end pt-2 border-t border-border/50">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1.5 text-xs text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400"
                                                onClick={() =>
                                                    openAnnulModal(tx)
                                                }
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                                Anular
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                {/* Confirmar Anulación Modal */}
                <Dialog open={annulDialog} onOpenChange={setAnnulDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertTriangle className="h-5 w-5" />
                                Confirmar Anulación
                            </DialogTitle>
                            <DialogDescription className="pt-2">
                                ¿Estás seguro de que deseas anular esta transacción?
                                Esta acción **revertirá el stock** del artículo (
                                <span className="font-semibold text-foreground">
                                    {selectedTx?.articulo?.descripcion}
                                </span>
                                ) y ocultará este registro permanentemente.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="my-4 rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tipo:</span>
                                <span className="font-medium text-foreground">{selectedTx?.tipo === 'IN' ? 'Ingreso' : 'Egreso'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Cantidad:</span>
                                <span className="font-medium text-foreground">{selectedTx?.cantidad} unidades</span>
                            </div>
                            {selectedTx?.vehiculo && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Vehículo:</span>
                                    <span className="font-medium text-foreground">{selectedTx.vehiculo.patente}</span>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setAnnulDialog(false)}
                                disabled={isProcessing}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleAnnul}
                                disabled={isProcessing}
                                className="gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400"
                            >
                                {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RotateCcw className="h-4 w-4" />
                                )}
                                Confirmar Anulación
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Paginación */}
                {transactions.last_page > 1 && (
                    <div className="flex items-center justify-center gap-4 py-4">
                        <button
                            disabled={!transactions.prev_page_url}
                            onClick={() => {
                                if (transactions.prev_page_url) {
                                    router.get(
                                        transactions.prev_page_url,
                                        {},
                                        {
                                            preserveState: true,
                                            preserveScroll: true,
                                        },
                                    );
                                }
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        <span className="text-sm text-muted-foreground tabular-nums">
                            {transactions.current_page} /{' '}
                            {transactions.last_page}
                        </span>

                        <button
                            disabled={!transactions.next_page_url}
                            onClick={() => {
                                if (transactions.next_page_url) {
                                    router.get(
                                        transactions.next_page_url,
                                        {},
                                        {
                                            preserveState: true,
                                            preserveScroll: true,
                                        },
                                    );
                                }
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

TransactionsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Historial',
            href: index.url(),
        },
    ],
};
