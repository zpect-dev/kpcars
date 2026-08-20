import { Head, router } from '@inertiajs/react';
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
    Scale,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer } from '@/components/app/page-container';
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
import { cn } from '@/lib/utils';
import { index as articulosIndex } from '@/routes/articulos';
import { index } from '@/routes/transactions';
import type { Articulo, Vehiculo, User } from '@/types';

interface Transaccion {
    id: number;
    articulo_id: number;
    vehiculo_id: number | null;
    user_id: number;
    solicitante: string | null;
    tipo: 'IN' | 'OUT' | 'AJUSTE';
    cantidad: number;
    descripcion: string | null;
    /** Anulada: el stock volvió al inventario. Se muestra como devolución. */
    inactiva: boolean;
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
        estado?: string;
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
        if (!selectedTx) {
return;
}

        setIsProcessing(true);
        router.post(
            `/transactions/${selectedTx.id}/annul`,
            {},
            {
                onSuccess: () => {
                    setAnnulDialog(false);
                    setSelectedTx(null);
                },
                onFinish: () => setIsProcessing(false),
                preserveScroll: true,
            },
        );
    }
    // ─── Filtro: Artículo (select con dropdown) ──────────────────────────────
    // El artículo puede venir preseleccionado por query string: se resuelve
    // como estado inicial perezoso, no con un efecto de montaje que pisaba el
    // valor después del primer pintado.
    const [articleSearch, setArticleSearch] = useState(
        () =>
            items.find((i) => String(i.id) === filters.article)?.descripcion ??
            '',
    );
    const [selectedArticleId, setSelectedArticleId] = useState(
        filters.article || '',
    );
    const [showArticleDropdown, setShowArticleDropdown] = useState(false);
    const [articleHighlightedIndex, setArticleHighlightedIndex] = useState(-1);
    const articleRef = useRef<HTMLInputElement>(null);

    const articleSuggestions = useMemo(() => {
        const q = articleSearch.toLowerCase().trim();

        if (!q) {
return items;
}

        return items.filter((i) => i.descripcion.toLowerCase().includes(q));
    }, [items, articleSearch]);

    function handleSelectArticle(item: Pick<Articulo, 'id' | 'descripcion'>) {
        setArticleSearch(item.descripcion);
        setSelectedArticleId(String(item.id));
        setShowArticleDropdown(false);
        setArticleHighlightedIndex(-1);
    }

    function handleArticleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!showArticleDropdown || articleSuggestions.length === 0) {
return;
}

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

        if (!q) {
return vehiculos;
}

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
        if (!showPlateDropdown || plateSuggestions.length === 0) {
return;
}

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

    // ─── Filtro: Estado (activas / devoluciones) ─────────────────────────────
    const [estado, setEstado] = useState(filters.estado || 'todas');

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
            toDate !== (filters.to || '') ||
            estado !== (filters.estado || 'todas');

        if (!hasChanges) {
return;
}

        const timeoutId = setTimeout(() => {
            const activeFilters: Record<string, string> = {};

            if (selectedArticleId) {
activeFilters.article = selectedArticleId;
}

            if (selectedPlate) {
activeFilters.plate = selectedPlate;
}

            if (applicantQuery) {
activeFilters.applicant = applicantQuery;
}

            if (fromDate) {
activeFilters.from = fromDate;
}

            if (toDate) {
activeFilters.to = toDate;
}

            if (estado !== 'todas') {
activeFilters.estado = estado;
}

            router.get(index.url(), activeFilters, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [
        selectedArticleId,
        selectedPlate,
        applicantQuery,
        fromDate,
        toDate,
        estado,
        filters,
    ]);

    function clearFilters() {
        setArticleSearch('');
        setSelectedArticleId('');
        setPlateSearch('');
        setSelectedPlate('');
        setApplicantQuery('');
        setFromDate('');
        setToDate('');
        setEstado('todas');
    }

    const hasActiveFilters =
        Boolean(selectedArticleId) ||
        Boolean(selectedPlate) ||
        Boolean(applicantQuery) ||
        Boolean(fromDate) ||
        Boolean(toDate) ||
        estado !== 'todas';

    return (
        <>
            <Head title="Historial Transacciones" />

            <PageContainer>
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

                                if (selectedArticleId) {
params.set('article', selectedArticleId);
}

                                if (selectedPlate) {
params.set('plate', selectedPlate);
}

                                if (applicantQuery) {
params.set('applicant', applicantQuery);
}

                                if (fromDate) {
params.set('from', fromDate);
}

                                if (toDate) {
params.set('to', toDate);
}

                                if (estado !== 'todas') {
params.set('estado', estado);
}

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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
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

                        {/* Filtro Estado: las anuladas son las devoluciones. */}
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="estado">Estado</Label>
                            <select
                                id="estado"
                                value={estado}
                                onChange={(e) => setEstado(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus:ring-1 focus:ring-ring focus:outline-none"
                            >
                                <option
                                    value="todas"
                                    className="bg-background text-foreground"
                                >
                                    Todas
                                </option>
                                <option
                                    value="activas"
                                    className="bg-background text-foreground"
                                >
                                    Sin devoluciones
                                </option>
                                <option
                                    value="anuladas"
                                    className="bg-background text-foreground"
                                >
                                    Sólo devoluciones
                                </option>
                            </select>
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
                                <span className="lg:hidden">
                                    Limpiar filtros
                                </span>
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
                                        ></th>
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
                                            className={cn(
                                                'bg-card transition-colors hover:bg-muted/40',
                                                // Devolución: fila teñida con
                                                // el tono informativo, el mismo
                                                // en todo el historial.
                                                tx.inactiva &&
                                                    'bg-info-soft/40 text-muted-foreground',
                                            )}
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
                                                className="px-3 py-3 font-medium text-foreground sm:px-6 sm:py-4"
                                                title={
                                                    tx.articulo?.descripcion ||
                                                    'N/A'
                                                }
                                            >
                                                <div className="flex flex-col items-start gap-1">
                                                    <span
                                                        className={cn(
                                                            'block w-full truncate',
                                                            tx.inactiva &&
                                                                'text-muted-foreground',
                                                        )}
                                                    >
                                                        {tx.articulo
                                                            ?.descripcion ||
                                                            'N/A'}
                                                    </span>
                                                    {tx.inactiva && (
                                                        <span className="rounded border border-info/30 bg-info-soft px-1.5 py-0.5 text-xs font-semibold text-info-soft-foreground">
                                                            Stock devuelto al
                                                            inventario
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="truncate px-3 py-3 sm:px-6 sm:py-4">
                                                <div className="flex items-center gap-2">
                                                    {/* La devolución usa su
                                                        propio color: no es un
                                                        ingreso ni un egreso
                                                        vigente. */}
                                                    {tx.inactiva ? (
                                                        <RotateCcw aria-hidden="true" className="size-4 text-info" />
                                                    ) : tx.tipo === 'IN' ? (
                                                        <ArrowDownCircle aria-hidden="true" className="size-4 text-success" />
                                                    ) : tx.tipo === 'AJUSTE' ? (
                                                        <Scale aria-hidden="true" className="size-4 text-primary" />
                                                    ) : (
                                                        <ArrowUpCircle aria-hidden="true" className="size-4 text-destructive" />
                                                    )}
                                                    <span
                                                        className={cn(
                                                            'font-semibold',
                                                            tx.inactiva
                                                                ? 'text-muted-foreground line-through'
                                                                : 'text-foreground',
                                                        )}
                                                    >
                                                        {tx.tipo === 'AJUSTE' && tx.cantidad > 0
                                                            ? `+${tx.cantidad}`
                                                            : tx.cantidad}
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
                                                    {/* Una devolución ya no se
                                                        vuelve a anular. Un ajuste
                                                        de conteo tampoco: se
                                                        corrige con otro conteo. */}
                                                    {!tx.inactiva && tx.tipo !== 'AJUSTE' && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openAnnulModal(
                                                                    tx,
                                                                )
                                                            }
                                                            className="rounded text-muted-foreground transition-colors outline-none hover:text-warning-soft-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                                            title="Anular transacción"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </button>
                                                    )}
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
                                    className={cn(
                                        'flex flex-col gap-1.5 p-4',
                                        tx.inactiva && 'bg-info-soft/40',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex flex-1 flex-col items-start gap-1">
                                            <p
                                                className={cn(
                                                    'line-clamp-2 text-sm font-semibold',
                                                    tx.inactiva
                                                        ? 'text-muted-foreground'
                                                        : 'text-foreground',
                                                )}
                                            >
                                                {tx.articulo?.descripcion ||
                                                    'N/A'}
                                            </p>
                                            {tx.inactiva && (
                                                <span className="rounded border border-info/30 bg-info-soft px-1.5 py-0.5 text-xs font-semibold text-info-soft-foreground">
                                                    Stock devuelto al inventario
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5 text-sm">
                                            {tx.inactiva ? (
                                                <RotateCcw aria-hidden="true" className="size-4 text-info" />
                                            ) : tx.tipo === 'IN' ? (
                                                <ArrowDownCircle aria-hidden="true" className="size-4 text-success" />
                                            ) : tx.tipo === 'AJUSTE' ? (
                                                <Scale aria-hidden="true" className="size-4 text-primary" />
                                            ) : (
                                                <ArrowUpCircle aria-hidden="true" className="size-4 text-destructive" />
                                            )}
                                            <span
                                                className={cn(
                                                    'font-semibold',
                                                    tx.inactiva
                                                        ? 'text-muted-foreground line-through'
                                                        : 'text-foreground',
                                                )}
                                            >
                                                {tx.tipo === 'AJUSTE' && tx.cantidad > 0
                                                    ? `+${tx.cantidad}`
                                                    : tx.cantidad}
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
                                    {isAdmin && !tx.inactiva && (
                                        <div className="mt-1 flex justify-end border-t border-border/50 pt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1.5 text-xs text-warning-soft-foreground hover:bg-warning-soft"
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
                            <DialogTitle className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-5 w-5" />
                                Confirmar Anulación
                            </DialogTitle>
                            <DialogDescription className="pt-2">
                                ¿Estás seguro de que deseas anular esta
                                transacción? Esta acción **revertirá el stock**
                                del artículo (
                                <span className="font-semibold text-foreground">
                                    {selectedTx?.articulo?.descripcion}
                                </span>
                                ) y el registro quedará en el historial marcado
                                como devolución.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    Tipo
                                </span>
                                <span className="font-medium text-foreground">
                                    {selectedTx?.tipo === 'IN'
                                        ? 'Ingreso'
                                        : selectedTx?.tipo === 'AJUSTE'
                                          ? 'Ajuste'
                                          : 'Egreso'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    Cantidad
                                </span>
                                <span className="font-medium text-foreground">
                                    {selectedTx?.cantidad} unidades
                                </span>
                            </div>
                            {selectedTx?.vehiculo && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Vehículo
                                    </span>
                                    <span className="font-medium text-foreground">
                                        {selectedTx.vehiculo.patente}
                                    </span>
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
                                className="gap-2 border-warning/30 bg-warning-soft text-warning-soft-foreground hover:bg-warning/20"
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
            </PageContainer>
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
