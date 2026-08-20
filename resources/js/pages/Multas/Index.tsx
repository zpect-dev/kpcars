import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowDownUp,
    Building2,
    CalendarDays,
    CalendarRange,
    Car,
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    Download,
    FileX,
    Medal,
    Pencil,
    Plus,
    Siren,
    User as UserIcon,
    UserX,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/app/empty-state';
import { SearchInput } from '@/components/app/filter-bar';
import { PageContainer } from '@/components/app/page-container';
import { PageHeader } from '@/components/app/page-header';
import { Chip, Highlight, InactivoBadge } from '@/components/multas/atomos';
import { CobrarMultaModal } from '@/components/multas/cobrar-modal';
import { EditarMultaModal } from '@/components/multas/editar-modal';
import {
    diasHastaVenc,
    estadoCobro,
    faltante,
    formatFecha,
    HOY,
    HOY_PLUS_7,
    montoEfectivo,
    normEstado,
    ORDEN_LABEL,
    pendiente,
    periodoRango,
    readParams,
    sinImporte,
    TABS,
    tieneDescuento,
} from '@/components/multas/logica';
import { MultaPdf } from '@/components/multas/multa-pdf';
import { RegistrarMultaModal } from '@/components/multas/registrar-modal';
import { ReporteSemanal } from '@/components/multas/reporte-semanal';
import type {
    FiltroEstado,
    FiltroJurisdiccion,
    FiltroPeriodo,
    Grupo,
    Multa,
    MultaEliminada,
    Orden,
    Tab,
    VehiculoOpt,
} from '@/components/multas/tipos';
import { formatARS } from '@/components/recaudaciones-tabla';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
    multas: Multa[];
    vehiculos: VehiculoOpt[];
    eliminadas: MultaEliminada[];
}


export default function MultasIndex({
    multas,
    vehiculos,
    eliminadas = [],
}: Props) {
    // Estado inicial tomado de la URL: sobrevive a recargas y permite compartir
    // el link con la misma vista (tab, búsqueda, filtros y orden).
    const [tab, setTab] = useState<Tab>(() => {
        const t = readParams().get('tab') as Tab;

        return TABS.includes(t) ? t : 'vehiculo';
    });
    const [search, setSearch] = useState(() => readParams().get('q') ?? '');
    const [orden, setOrden] = useState<Orden>(() => {
        const o = readParams().get('orden') as Orden;

        return o in ORDEN_LABEL ? o : 'pendientes';
    });
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Multa | null>(null);
    const [cobrando, setCobrando] = useState<Multa | null>(null);

    // Filtros
    const [fJurisdiccion, setFJurisdiccion] = useState<FiltroJurisdiccion>(
        () => {
            const v = readParams().get('jur');

            return v === 'CABA' || v === 'GBA' ? v : '';
        },
    );
    const [fSistema, setFSistema] = useState<FiltroEstado>(() =>
        normEstado(readParams().get('sis')),
    );
    const [fChofer, setFChofer] = useState<FiltroEstado>(() =>
        normEstado(readParams().get('cob')),
    );
    const [fPuntoRojo, setFPuntoRojo] = useState(
        () => readParams().get('pr') === '1',
    );
    const [fVencimiento, setFVencimiento] = useState<
        '' | 'vencida' | 'no-vencida'
    >(() => {
        const v = readParams().get('venc');

        return v === 'vencida' || v === 'no-vencida' ? v : '';
    });
    const [fDesde, setFDesde] = useState(() => readParams().get('desde') ?? '');
    const [fHasta, setFHasta] = useState(() => readParams().get('hasta') ?? '');

    // Reflejar tab + búsqueda + filtros + orden en la URL (sin recargar).
    useEffect(() => {
        if (typeof window === 'undefined') {
return;
}

        const p = new URLSearchParams();

        if (tab !== 'vehiculo') {
p.set('tab', tab);
}

        if (search.trim()) {
p.set('q', search);
}

        if (orden !== 'pendientes') {
p.set('orden', orden);
}

        if (fJurisdiccion) {
p.set('jur', fJurisdiccion);
}

        if (fSistema) {
p.set('sis', fSistema);
}

        if (fChofer) {
p.set('cob', fChofer);
}

        if (fPuntoRojo) {
p.set('pr', '1');
}

        if (fVencimiento) {
p.set('venc', fVencimiento);
}

        if (fDesde) {
p.set('desde', fDesde);
}

        if (fHasta) {
p.set('hasta', fHasta);
}

        const qs = p.toString();
        const url =
            window.location.pathname +
            (qs ? `?${qs}` : '') +
            window.location.hash;
        window.history.replaceState(window.history.state, '', url);
    }, [
        tab,
        search,
        orden,
        fJurisdiccion,
        fSistema,
        fChofer,
        fPuntoRojo,
        fVencimiento,
        fDesde,
        fHasta,
    ]);

    // Periodo activo: se deriva comparando fechas con cada preset
    const fPeriodoActivo = useMemo<FiltroPeriodo>(() => {
        for (const p of ['mes', 'mes-ant', '3m', 'año'] as FiltroPeriodo[]) {
            const r = periodoRango(p);

            if (r.desde === fDesde && r.hasta === fHasta) {
return p;
}
        }

        return '';
    }, [fDesde, fHasta]);

    function setPeriodo(p: FiltroPeriodo) {
        const r = periodoRango(p);
        setFDesde(r.desde);
        setFHasta(r.hasta);
    }

    const filtrosActivos =
        [fJurisdiccion, fSistema, fChofer, fVencimiento].filter(Boolean)
            .length +
        (fPuntoRojo ? 1 : 0) +
        (fDesde ? 1 : 0) +
        (fHasta ? 1 : 0);

    function limpiarFiltros() {
        setFJurisdiccion('');
        setFSistema('');
        setFChofer('');
        setFPuntoRojo(false);
        setFVencimiento('');
        setFDesde('');
        setFHasta('');
    }

    // El backend solo entiende tipo 'vehiculo' | 'chofer'. Ex-chofer es "por chofer" + inactivo.
    const tipoPdf =
        tab === 'vehiculo' || tab === 'ranking' ? 'vehiculo' : 'chofer';

    function buildPdfUrl() {
        const p = new URLSearchParams({ tipo: tipoPdf });

        if (search) {
p.set('q', search);
}

        if (fJurisdiccion) {
p.set('jurisdiccion', fJurisdiccion);
}

        if (fSistema) {
p.set('sistema', fSistema);
}

        if (fChofer) {
p.set('chofer', fChofer);
}

        if (fPuntoRojo) {
p.set('punto_rojo', '1');
}

        if (fVencimiento) {
p.set('vencimiento', fVencimiento);
}

        if (tab === 'ex-chofer') {
p.set('inactivo', '1');
}

        if (fDesde) {
p.set('desde', fDesde);
}

        if (fHasta) {
p.set('hasta', fHasta);
}

        return `/multas/pdf?${p.toString()}`;
    }

    const stats = useMemo(() => {
        const conMonto = multas.filter((m) => !sinImporte(m));
        // Solo CABA: son las únicas que pierden descuento al vencer (GBA no tiene).
        const proximasVencer = multas.filter(
            (m) =>
                m.jurisdiccion === 'CABA' &&
                m.fecha_vencimiento &&
                !m.cobrado &&
                !sinImporte(m) &&
                m.fecha_vencimiento >= HOY &&
                m.fecha_vencimiento <= HOY_PLUS_7,
        );

        return {
            total: multas.length,
            deudaSistema: conMonto
                .filter((m) => !m.pagado)
                .reduce((s, m) => s + montoEfectivo(m), 0),
            cntSinPagar: conMonto.filter((m) => !m.pagado).length,
            porCobrar: conMonto.reduce((s, m) => s + faltante(m), 0),
            cntSinCobrar: conMonto.filter((m) => !m.cobrado).length,
            pagado: conMonto
                .filter((m) => m.pagado)
                .reduce((s, m) => s + montoEfectivo(m), 0),
            cobrado: conMonto.reduce((s, m) => s + m.monto_cobrado, 0),
            proximasVencer,
        };
    }, [multas]);

    const ranking = useMemo(() => {
        const map = new Map<
            string,
            {
                id: number;
                nombre: string;
                cnt: number;
                total: number;
                pagado: number;
                adeudado: number;
            }
        >();

        for (const m of multas) {
            if (sinImporte(m)) {
continue;
}

            const key = m.conductor_id ? `c${m.conductor_id}` : 'sin';

            if (!map.has(key)) {
map.set(key, {
                    id: m.conductor_id ?? 0,
                    nombre: m.conductor ?? 'Sin chofer',
                    cnt: 0,
                    total: 0,
                    pagado: 0,
                    adeudado: 0,
                });
}

            const e = map.get(key)!;
            e.cnt++;
            // Total efectivo (con descuento de hoy; si ya está cobrada, lo pagado).
            // Así total = pagado + adeudado y el % pagado cierra correcto.
            e.total += m.cobrado ? m.monto_cobrado : montoEfectivo(m);
            e.pagado += m.monto_cobrado;
            e.adeudado += faltante(m);
        }

        return Array.from(map.values()).sort(
            (a, b) => b.adeudado - a.adeudado || b.total - a.total,
        );
    }, [multas]);

    const grupos = useMemo<Grupo[]>(() => {
        const q = search.toLowerCase().trim();

        const visibles = multas.filter((m) => {
            if (
                q &&
                !m.patente.toLowerCase().includes(q) &&
                !(m.conductor ?? '').toLowerCase().includes(q)
            ) {
return false;
}

            if (fJurisdiccion && m.jurisdiccion !== fJurisdiccion) {
return false;
}

            if (fSistema === 'si' && !m.pagado) {
return false;
}

            if (fSistema === 'no' && m.pagado) {
return false;
}

            if (fChofer === 'si' && !m.cobrado) {
return false;
}

            if (fChofer === 'no' && m.cobrado) {
return false;
}

            if (fPuntoRojo && !m.punto_rojo) {
return false;
}

            if (
                fVencimiento === 'no-vencida' &&
                !(m.fecha_vencimiento && m.fecha_vencimiento >= HOY)
            ) {
return false;
}

            if (
                fVencimiento === 'vencida' &&
                !(m.fecha_vencimiento && m.fecha_vencimiento < HOY)
            ) {
return false;
}

            if (tab === 'ex-chofer' && !m.conductor_inactivo) {
return false;
}

            if (fDesde && m.fecha < fDesde) {
return false;
}

            if (fHasta && m.fecha > fHasta) {
return false;
}

            return true;
        });

        const map = new Map<string, Grupo>();

        for (const m of visibles) {
            let key: string, id: number | null, titulo: string, sub: string;

            if (tab === 'vehiculo') {
                key = String(m.vehiculo_id);
                id = m.vehiculo_id;
                titulo = m.patente;
                sub = [m.marca, m.modelo].filter(Boolean).join(' ');
            } else {
                key = m.conductor_id ? `c${m.conductor_id}` : 'sin';
                id = m.conductor_id;
                titulo = m.conductor ?? 'Sin chofer';
                sub = '';
            }

            if (!map.has(key)) {
map.set(key, {
                    key,
                    id: id ?? 0,
                    titulo,
                    sub,
                    multas: [],
                    pendientes: 0,
                    total: 0,
                });
}

            map.get(key)!.multas.push(m);
        }

        const alfa = (a: Grupo, b: Grupo) =>
            a.titulo.localeCompare(b.titulo, 'es', { numeric: true });

        return Array.from(map.values())
            .map((g) => ({
                ...g,
                pendientes: g.multas.filter(pendiente).length,
                total: g.multas.reduce((s, m) => s + montoEfectivo(m), 0),
            }))
            .sort((a, b) => {
                if (orden === 'monto') {
return b.total - a.total || alfa(a, b);
}

                if (orden === 'cantidad') {
return b.multas.length - a.multas.length || alfa(a, b);
}

                if (orden === 'alfabetico') {
return alfa(a, b);
}

                // 'pendientes' (default)
                return (
                    b.pendientes - a.pendientes ||
                    b.total - a.total ||
                    alfa(a, b)
                );
            });
    }, [
        multas,
        tab,
        search,
        orden,
        fJurisdiccion,
        fSistema,
        fChofer,
        fPuntoRojo,
        fVencimiento,
        fDesde,
        fHasta,
    ]);

    function toggleExpand(key: string) {
        setExpanded((prev) => {
            const next = new Set(prev);

            if (next.has(key)) {
next.delete(key);
} else {
next.add(key);
}

            return next;
        });
    }

    // Solo estos tabs muestran el buscador/filtros y la lista agrupada.
    const esTabGrupo =
        tab === 'vehiculo' || tab === 'chofer' || tab === 'ex-chofer';

    // Opciones comunes a todas las mutaciones: recarga parcial (multas +
    // eliminadas para el reporte, más flash para los toasts) conservando el
    // estado local (grupos abiertos, tab, búsqueda y filtros).
    const visitaMulta = {
        preserveScroll: true,
        preserveState: true,
        only: ['multas', 'eliminadas', 'flash'],
    };

    // Como visitaMulta pero marcando la fila como "procesando" (feedback visual).
    function visitaFila(id: number) {
        return {
            ...visitaMulta,
            onStart: () => setProcessingId(id),
            onFinish: () => setProcessingId(null),
        };
    }

    function togglePagado(id: number) {
        router.patch(`/multas/${id}/pagado`, {}, visitaFila(id));
    }

    function toggleCobrado(m: Multa) {
        if (sinImporte(m)) {
            // Sin importe: cobro sí/no directo (sin monto).
            router.patch(
                `/multas/${m.id}/cobrado`,
                m.cobrado ? { reset: true } : { fecha_cobro: HOY },
                visitaFila(m.id),
            );

            return;
        }

        // Con importe: el modal registra el pago (total o parcial) o reinicia.
        setCobrando(m);
    }

    function deleteMulta(id: number) {
        router.delete(`/multas/${id}`, {
            ...visitaMulta,
            onSuccess: () => {
                setEditing(null);
                toast.success('Multa eliminada', {
                    action: {
                        label: 'Deshacer',
                        onClick: () =>
                            router.patch(
                                `/multas/${id}/restaurar`,
                                {},
                                visitaMulta,
                            ),
                    },
                });
            },
        });
    }

    // Expandir / colapsar todos los grupos visibles de una vez.
    const allExpanded =
        grupos.length > 0 && grupos.every((g) => expanded.has(g.key));

    function toggleExpandAll() {
        setExpanded(
            allExpanded ? new Set() : new Set(grupos.map((g) => g.key)),
        );
    }

    // Contador de multas pendientes por tab (para el badge).
    const tabPendientes = useMemo<Record<Tab, number>>(
        () => ({
            vehiculo: multas.filter(pendiente).length,
            chofer: multas.filter(pendiente).length,
            'ex-chofer': multas.filter(
                (m) => m.conductor_inactivo && pendiente(m),
            ).length,
            ranking: 0,
            reporte: 0,
        }),
        [multas],
    );

    return (
        <>
            <Head title="Multas" />

            <PageContainer>
                <PageHeader
                    title="Multas"
                    count={{
                        value: multas.length,
                        singular: 'multa',
                        plural: 'multas',
                    }}
                    description="La multa se imputa al chofer que tenía el vehículo en la fecha de la infracción."
                    actions={
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <a
                                    href={buildPdfUrl()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Download className="size-4" />
                                    <span className="hidden sm:inline">
                                        Exportar PDF
                                    </span>
                                </a>
                            </Button>
                            <Button size="sm" onClick={() => setShowModal(true)}>
                                <Plus className="size-4" />
                                <span className="hidden sm:inline">
                                    Registrar multa
                                </span>
                            </Button>
                        </>
                    }
                />

                {/* Mini dashboard */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="flex flex-col gap-1 rounded-xl border border-destructive/20 bg-destructive-soft/40 px-4 py-3 shadow-sm">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                            <Building2 className="h-3.5 w-3.5" /> Deuda al
                            sistema
                        </span>
                        <span className="text-xl font-bold text-foreground tabular-nums">
                            {formatARS(stats.deudaSistema)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {stats.cntSinPagar} multa
                            {stats.cntSinPagar !== 1 ? 's' : ''} sin pagar
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-xl border border-warning/20 bg-warning-soft/40 px-4 py-3 shadow-sm">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-warning-soft-foreground">
                            <UserIcon className="h-3.5 w-3.5" /> Por cobrar a
                            choferes
                        </span>
                        <span className="text-xl font-bold text-foreground tabular-nums">
                            {formatARS(stats.porCobrar)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {stats.cntSinCobrar} multa
                            {stats.cntSinCobrar !== 1 ? 's' : ''} sin cobrar
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" /> Pagado al
                            sistema
                        </span>
                        <span className="text-xl font-bold text-foreground tabular-nums">
                            {formatARS(stats.pagado)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            acumulado histórico
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <UserIcon className="h-3.5 w-3.5" /> Cobrado a
                            choferes
                        </span>
                        <span className="text-xl font-bold text-foreground tabular-nums">
                            {formatARS(stats.cobrado)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            acumulado histórico
                        </span>
                    </div>
                </div>

                {/* Alerta de vencimientos próximos */}
                {stats.proximasVencer.length > 0 && (
                    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft/40 px-4 py-3">
                        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-warning-soft-foreground">
                                {stats.proximasVencer.length} multa
                                {stats.proximasVencer.length !== 1
                                    ? 's'
                                    : ''}{' '}
                                pierden el descuento en los próximos 7 días
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {stats.proximasVencer
                                    .sort((a, b) =>
                                        a.fecha_vencimiento!.localeCompare(
                                            b.fecha_vencimiento!,
                                        ),
                                    )
                                    .map((m) => {
                                        const dias = diasHastaVenc(
                                            m.fecha_vencimiento!,
                                        );

                                        return `${m.patente} (${dias === 0 ? 'hoy' : `${dias}d`})`;
                                    })
                                    .join(' · ')}
                            </p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex flex-wrap gap-1.5">
                    {(
                        [
                            {
                                val: 'vehiculo',
                                label: 'Por vehículo',
                                icon: Car,
                            },
                            {
                                val: 'chofer',
                                label: 'Por chofer',
                                icon: UserIcon,
                            },
                            {
                                val: 'ex-chofer',
                                label: 'Por ex-chofer',
                                icon: UserX,
                            },
                            { val: 'ranking', label: 'Ranking', icon: Medal },
                            {
                                val: 'reporte',
                                label: 'Reporte',
                                icon: CalendarRange,
                            },
                        ] as const
                    ).map(({ val, label, icon: Icon }) => {
                        const activo = tab === val;
                        const pend = tabPendientes[val];

                        return (
                            <button
                                key={val}
                                type="button"
                                onClick={() => setTab(val)}
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.98]',
                                    activo
                                        ? 'border-primary/30 bg-primary/10 text-primary'
                                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                                {pend > 0 && (
                                    <span
                                        className={cn(
                                            'ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-md px-1 text-xs font-bold tabular-nums',
                                            activo
                                                ? 'bg-primary/20 text-primary'
                                                : 'bg-warning-soft text-warning-soft-foreground',
                                        )}
                                        title={`${pend} multa${pend !== 1 ? 's' : ''} pendiente${pend !== 1 ? 's' : ''}`}
                                    >
                                        {pend}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Ranking */}
                {tab === 'ranking' && (
                    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                            <Medal className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">
                                Ranking de choferes por deuda pendiente
                            </span>
                        </div>
                        {ranking.length === 0 ? (
                            <p className="py-10 text-center text-sm text-muted-foreground">
                                Sin datos.
                            </p>
                        ) : (
                            <div>
                                {/* Header desktop */}
                                <div className="hidden items-center gap-4 border-b border-border px-4 py-2 sm:flex">
                                    <span className="w-6 shrink-0 text-xs font-medium text-muted-foreground">
                                        #
                                    </span>
                                    <span className="flex-1 text-xs font-medium text-muted-foreground">
                                        Conductor
                                    </span>
                                    <span className="w-16 shrink-0 text-center text-xs font-medium text-muted-foreground">
                                        Multas
                                    </span>
                                    <span className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
                                        Total
                                    </span>
                                    <span className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
                                        Pagado
                                    </span>
                                    <span className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
                                        Adeuda
                                    </span>
                                    <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">
                                        % pagado
                                    </span>
                                </div>
                                {ranking.map((r, i) => {
                                    const pct =
                                        r.total > 0
                                            ? Math.round(
                                                  (r.pagado / r.total) * 100,
                                              )
                                            : 0;

                                    return (
                                        <div
                                            key={r.id}
                                            className={cn(
                                                'flex items-center gap-4 px-4 py-3 text-sm',
                                                i % 2 === 1 && 'bg-muted/20',
                                                i < ranking.length - 1 &&
                                                    'border-b border-border',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'w-6 shrink-0 text-xs font-bold tabular-nums',
                                                    i === 0
                                                        ? 'text-warning'
                                                        : i === 1
                                                          ? 'text-muted-foreground'
                                                          : i === 2
                                                            ? 'text-warning-soft-foreground'
                                                            : 'text-muted-foreground/50',
                                                )}
                                            >
                                                {i + 1}
                                            </span>
                                            <span className="flex-1 truncate font-medium">
                                                {r.nombre}
                                            </span>
                                            <span className="w-16 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                                                {r.cnt}
                                            </span>
                                            <span className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                                {formatARS(r.total)}
                                            </span>
                                            <span className="w-28 shrink-0 text-right text-xs font-semibold text-success tabular-nums">
                                                {formatARS(r.pagado)}
                                            </span>
                                            <span
                                                className={cn(
                                                    'w-28 shrink-0 text-right text-xs font-semibold tabular-nums',
                                                    r.adeudado > 0
                                                        ? 'text-destructive'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {formatARS(r.adeudado)}
                                            </span>
                                            <div className="w-24 shrink-0">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                                        <div
                                                            className="h-full rounded-full bg-success transition-all"
                                                            style={{
                                                                width: `${pct}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                                        {pct}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Filtros */}
                {esTabGrupo && (
                    <div className="sticky top-0 z-20 rounded-xl border border-border bg-card shadow-sm">
                        {/* Buscador */}
                        <div className="flex items-center gap-2 px-3 py-3">
                            <SearchInput
                                className="flex-1"
                                value={search}
                                onChange={setSearch}
                                placeholder="Buscar patente o chofer..."
                            />
                            {(filtrosActivos > 0 || search) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        limpiarFiltros();
                                        setSearch('');
                                    }}
                                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>

                        {/* Fila 2: estado */}
                        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5">
                            <Chip
                                activo={fJurisdiccion === 'CABA'}
                                onClick={() =>
                                    setFJurisdiccion((v) =>
                                        v === 'CABA' ? '' : 'CABA',
                                    )
                                }
                            >
                                CABA
                            </Chip>
                            <Chip
                                activo={fJurisdiccion === 'GBA'}
                                onClick={() =>
                                    setFJurisdiccion((v) =>
                                        v === 'GBA' ? '' : 'GBA',
                                    )
                                }
                            >
                                GBA
                            </Chip>
                            <div className="h-4 w-px bg-border" />
                            <Chip
                                activo={fSistema === 'no'}
                                onClick={() =>
                                    setFSistema((v) => (v === 'no' ? '' : 'no'))
                                }
                            >
                                <Building2 className="h-3 w-3" /> Sin pagar al
                                sistema
                            </Chip>
                            <Chip
                                activo={fSistema === 'si'}
                                onClick={() =>
                                    setFSistema((v) => (v === 'si' ? '' : 'si'))
                                }
                            >
                                <Building2 className="h-3 w-3" /> Pagada al
                                sistema
                            </Chip>
                            <div className="h-4 w-px bg-border" />
                            <Chip
                                activo={fChofer === 'no'}
                                onClick={() =>
                                    setFChofer((v) => (v === 'no' ? '' : 'no'))
                                }
                            >
                                <UserIcon className="h-3 w-3" /> Sin cobrar
                            </Chip>
                            <Chip
                                activo={fChofer === 'si'}
                                onClick={() =>
                                    setFChofer((v) => (v === 'si' ? '' : 'si'))
                                }
                            >
                                <UserIcon className="h-3 w-3" /> Cobrada
                            </Chip>
                            <div className="h-4 w-px bg-border" />
                            <Chip
                                activo={fPuntoRojo}
                                onClick={() => setFPuntoRojo((v) => !v)}
                            >
                                <span aria-hidden="true" className="size-2 rounded-full bg-destructive" />{' '}
                                Punto rojo
                            </Chip>
                            <Chip
                                activo={fVencimiento === 'no-vencida'}
                                onClick={() =>
                                    setFVencimiento((v) =>
                                        v === 'no-vencida' ? '' : 'no-vencida',
                                    )
                                }
                            >
                                No vencida
                            </Chip>
                            <Chip
                                activo={fVencimiento === 'vencida'}
                                onClick={() =>
                                    setFVencimiento((v) =>
                                        v === 'vencida' ? '' : 'vencida',
                                    )
                                }
                            >
                                Vencida
                            </Chip>
                        </div>

                        {/* Fila 3: período */}
                        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-3 py-2.5">
                            <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase">
                                <CalendarDays className="h-3.5 w-3.5" /> Período
                            </span>
                            <div className="h-4 w-px bg-border" />
                            {(
                                [
                                    { val: 'mes', label: 'Este mes' },
                                    { val: 'mes-ant', label: 'Mes anterior' },
                                    { val: '3m', label: 'Últimos 3 meses' },
                                    { val: 'año', label: 'Este año' },
                                ] as { val: FiltroPeriodo; label: string }[]
                            ).map(({ val, label }) => (
                                <Chip
                                    key={val}
                                    activo={fPeriodoActivo === val}
                                    onClick={() =>
                                        fPeriodoActivo === val
                                            ? (setFDesde(''), setFHasta(''))
                                            : setPeriodo(val)
                                    }
                                >
                                    {label}
                                </Chip>
                            ))}
                            <div className="ml-auto flex items-center gap-1.5">
                                <Input
                                    type="date"
                                    value={fDesde}
                                    onChange={(e) => setFDesde(e.target.value)}
                                    className="h-8 w-[130px] text-xs"
                                />
                                <span className="text-xs text-muted-foreground">
                                    –
                                </span>
                                <Input
                                    type="date"
                                    value={fHasta}
                                    min={fDesde}
                                    onChange={(e) => setFHasta(e.target.value)}
                                    className="h-8 w-[130px] text-xs"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Reporte semanal */}
                {tab === 'reporte' && (
                    <ReporteSemanal multas={multas} eliminadas={eliminadas} />
                )}

                {/* Lista agrupada */}
                {esTabGrupo &&
                    (grupos.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card shadow-sm">
                            <EmptyState
                                variant={
                                    multas.length === 0 ? 'empty' : 'filtered'
                                }
                                icon={multas.length === 0 ? Siren : undefined}
                                title={
                                    multas.length === 0
                                        ? 'Todavía no hay multas registradas'
                                        : 'No hay multas que coincidan'
                                }
                                description={
                                    multas.length === 0
                                        ? 'Registrá la primera multa para empezar a hacer seguimiento.'
                                        : 'Probá ajustar la búsqueda o limpiar los filtros.'
                                }
                                action={
                                    multas.length === 0
                                        ? {
                                              label: 'Registrar multa',
                                              onClick: () => setShowModal(true),
                                          }
                                        : filtrosActivos > 0 || search
                                          ? {
                                                label: 'Limpiar filtros',
                                                onClick: () => {
                                                    limpiarFiltros();
                                                    setSearch('');
                                                },
                                            }
                                          : undefined
                                }
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 pb-4">
                            {/* Toolbar: resumen + orden + expandir todo */}
                            <div className="flex items-center justify-between gap-2 px-1">
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {grupos.length}{' '}
                                    {tab === 'vehiculo'
                                        ? grupos.length === 1
                                            ? 'vehículo'
                                            : 'vehículos'
                                        : grupos.length === 1
                                          ? 'chofer'
                                          : 'choferes'}
                                    {' · '}
                                    {grupos.reduce(
                                        (s, g) => s + g.multas.length,
                                        0,
                                    )}{' '}
                                    multas
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                            >
                                                <ArrowDownUp className="h-3.5 w-3.5" />
                                                <span className="hidden sm:inline">
                                                    {ORDEN_LABEL[orden]}
                                                </span>
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {(
                                                Object.keys(
                                                    ORDEN_LABEL,
                                                ) as Orden[]
                                            ).map((o) => (
                                                <DropdownMenuItem
                                                    key={o}
                                                    onClick={() => setOrden(o)}
                                                    className={cn(
                                                        orden === o &&
                                                            'bg-muted font-medium',
                                                    )}
                                                >
                                                    {ORDEN_LABEL[o]}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <button
                                        type="button"
                                        onClick={toggleExpandAll}
                                        aria-label={allExpanded ? 'Colapsar todo' : 'Expandir todo'}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    >
                                        {allExpanded ? (
                                            <ChevronsDownUp className="h-3.5 w-3.5" />
                                        ) : (
                                            <ChevronsUpDown className="h-3.5 w-3.5" />
                                        )}
                                        <span className="hidden sm:inline">
                                            {allExpanded
                                                ? 'Colapsar todo'
                                                : 'Expandir todo'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                            {grupos.map((g) => {
                                // Al buscar, los grupos se abren solos para ver las coincidencias.
                                const isOpen =
                                    search.trim().length > 0 ||
                                    expanded.has(g.key);

                                return (
                                    <div
                                        key={g.key}
                                        className="group/card overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                                    >
                                        <div className="flex items-center transition-colors hover:bg-muted/40">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleExpand(g.key)
                                                }
                                                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                                            >
                                                <ChevronDown
                                                    className={cn(
                                                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                                        isOpen && 'rotate-180',
                                                    )}
                                                />
                                                {tab === 'vehiculo' ? (
                                                    <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-sm font-bold tracking-wide text-foreground uppercase">
                                                        <Highlight
                                                            text={g.titulo}
                                                            query={search}
                                                        />
                                                    </span>
                                                ) : (
                                                    <span className="flex min-w-0 shrink items-center gap-1.5">
                                                        <span className="truncate text-sm font-semibold text-foreground">
                                                            <Highlight
                                                                text={g.titulo}
                                                                query={search}
                                                            />
                                                        </span>
                                                        {g.multas[0]
                                                            ?.conductor_inactivo && (
                                                            <InactivoBadge />
                                                        )}
                                                    </span>
                                                )}
                                                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                                    {g.sub}
                                                </span>
                                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                                    {g.multas.length} multa
                                                    {g.multas.length !== 1
                                                        ? 's'
                                                        : ''}
                                                </span>
                                                {g.pendientes > 0 ? (
                                                    <span className="shrink-0 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-soft-foreground">
                                                        {g.pendientes} pendiente
                                                        {g.pendientes !== 1
                                                            ? 's'
                                                            : ''}
                                                    </span>
                                                ) : (
                                                    <span className="shrink-0 rounded-md bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-soft-foreground">
                                                        Al día
                                                    </span>
                                                )}
                                                <span className="min-w-[90px] shrink-0 text-right text-sm font-bold text-foreground tabular-nums">
                                                    {formatARS(g.total)}
                                                </span>
                                            </button>
                                            {g.id !== null && (
                                                <a
                                                    href={`/multas/pdf?tipo=${tipoPdf}&id=${g.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="Descargar PDF"
                                                    className="mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/30 opacity-0 transition-all group-hover/card:opacity-100 hover:bg-muted hover:!text-foreground"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                        </div>

                                        {isOpen && (
                                            <div className="border-t border-border">
                                                {/* Header — solo desktop */}
                                                <div className="hidden items-center gap-4 border-b border-border bg-muted/30 px-4 py-2 sm:flex">
                                                    <span className="w-[80px] shrink-0 text-xs font-medium text-muted-foreground">
                                                        Fecha inf.
                                                    </span>
                                                    <span className="w-[80px] shrink-0 text-xs font-medium text-muted-foreground">
                                                        Vencimiento
                                                    </span>
                                                    <span className="w-[72px] shrink-0 text-xs font-medium text-muted-foreground">
                                                        Jurisd.
                                                    </span>
                                                    <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">
                                                        {tab === 'vehiculo'
                                                            ? 'Conductor'
                                                            : 'Patente'}
                                                    </span>
                                                    <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                                                        Descripción
                                                    </span>
                                                    <span className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
                                                        Monto
                                                    </span>
                                                    <span className="w-[196px] shrink-0 text-xs font-medium text-muted-foreground">
                                                        Estado
                                                    </span>
                                                    <span className="w-[60px] shrink-0" />
                                                </div>

                                                {g.multas.map((m) => {
                                                    const conDesc =
                                                        tieneDescuento(m);
                                                    const vencida =
                                                        !!m.fecha_vencimiento &&
                                                        HOY >
                                                            m.fecha_vencimiento;
                                                    const dias =
                                                        m.fecha_vencimiento &&
                                                        !m.cobrado
                                                            ? diasHastaVenc(
                                                                  m.fecha_vencimiento,
                                                              )
                                                            : null;
                                                    const vencUrgente =
                                                        dias !== null &&
                                                        dias >= 0 &&
                                                        dias <= 3;
                                                    const vencProximo =
                                                        dias !== null &&
                                                        dias > 3 &&
                                                        dias <= 7;

                                                    const montoNode =
                                                        sinImporte(m) ? (
                                                            <span className="text-sm text-muted-foreground">
                                                                —
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span
                                                                    className={cn(
                                                                        'text-sm font-semibold tabular-nums',
                                                                        m.cobrado ||
                                                                            conDesc
                                                                            ? 'text-muted-foreground line-through'
                                                                            : 'text-foreground',
                                                                    )}
                                                                >
                                                                    {formatARS(
                                                                        m.monto,
                                                                    )}
                                                                </span>
                                                                {conDesc &&
                                                                    !m.cobrado && (
                                                                        <span className="text-sm font-semibold text-success tabular-nums">
                                                                            {formatARS(
                                                                                montoEfectivo(
                                                                                    m,
                                                                                ),
                                                                            )}
                                                                        </span>
                                                                    )}
                                                            </div>
                                                        );

                                                    const estadosNode = (
                                                        extraClass = '',
                                                    ) => (
                                                        <div
                                                            className={cn(
                                                                'flex flex-col gap-1',
                                                                extraClass,
                                                            )}
                                                        >
                                                            <div className="flex gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        togglePagado(
                                                                            m.id,
                                                                        )
                                                                    }
                                                                    title={
                                                                        m.pagado
                                                                            ? 'Marcar como no pagada en el sistema de infracciones'
                                                                            : 'Marcar como pagada en el sistema de infracciones'
                                                                    }
                                                                    className={cn(
                                                                        'flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors',
                                                                        m.pagado
                                                                            ? 'border-success/30 bg-success-soft text-success-soft-foreground hover:bg-success/20'
                                                                            : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                                                    )}
                                                                >
                                                                    <Building2 className="h-3 w-3 shrink-0" />
                                                                    {m.pagado
                                                                        ? 'Pagada'
                                                                        : 'Sin pagar'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleCobrado(
                                                                            m,
                                                                        )
                                                                    }
                                                                    title={
                                                                        estadoCobro(
                                                                            m,
                                                                        ) ===
                                                                        'cobrada'
                                                                            ? m.cobrada_en
                                                                                ? `Cobrada — pagó ${formatARS(m.monto_cobrado)} el ${formatFecha(m.cobrada_en)}`
                                                                                : 'Cobrada'
                                                                            : estadoCobro(
                                                                                    m,
                                                                                ) ===
                                                                                'parcial'
                                                                              ? `Pago parcial: pagó ${formatARS(m.monto_cobrado)}, falta ${formatARS(faltante(m))}`
                                                                              : 'Registrar cobro al chofer'
                                                                    }
                                                                    className={cn(
                                                                        'flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors',
                                                                        estadoCobro(
                                                                            m,
                                                                        ) ===
                                                                            'cobrada'
                                                                            ? 'border-success/30 bg-success-soft text-success-soft-foreground hover:bg-success/20'
                                                                            : estadoCobro(
                                                                                    m,
                                                                                ) ===
                                                                                'parcial'
                                                                              ? 'border-warning/30 bg-warning-soft text-warning-soft-foreground hover:bg-warning/20'
                                                                              : 'border-warning/30 bg-transparent text-warning-soft-foreground hover:bg-warning-soft',
                                                                    )}
                                                                >
                                                                    <UserIcon className="h-3 w-3 shrink-0" />
                                                                    {estadoCobro(
                                                                        m,
                                                                    ) ===
                                                                    'cobrada'
                                                                        ? 'Cobrada'
                                                                        : estadoCobro(
                                                                                m,
                                                                            ) ===
                                                                            'parcial'
                                                                          ? 'Parcial'
                                                                          : 'Sin cobrar'}
                                                                </button>
                                                            </div>
                                                            {!sinImporte(m) &&
                                                                estadoCobro(
                                                                    m,
                                                                ) !== 'sin' && (
                                                                    <span className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
                                                                        <UserIcon className="h-2.5 w-2.5 shrink-0" />
                                                                        {estadoCobro(
                                                                            m,
                                                                        ) ===
                                                                        'cobrada'
                                                                            ? `Pagó ${formatARS(m.monto_cobrado)}${m.cobrada_en ? ' el ' + formatFecha(m.cobrada_en) : ''}`
                                                                            : `Pagó ${formatARS(m.monto_cobrado)} · Falta ${formatARS(faltante(m))}`}
                                                                    </span>
                                                                )}
                                                        </div>
                                                    );

                                                    const editBtn = (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setEditing(m)
                                                            }
                                                            title="Editar"
                                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                    );

                                                    const procesando =
                                                        processingId === m.id;

                                                    return (
                                                        <div
                                                            key={m.id}
                                                            className={cn(
                                                                'divide-y divide-border border-b border-border transition-opacity last:border-b-0',
                                                                procesando &&
                                                                    'pointer-events-none opacity-50',
                                                            )}
                                                        >
                                                            {/* ── MOBILE ── */}
                                                            <div className="flex flex-col gap-3 px-4 py-3 sm:hidden">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex min-w-0 flex-col gap-1">
                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                            {m.punto_rojo && (
                                                                                <span
                                                                                    aria-hidden="true" className="size-2 rounded-full bg-destructive"
                                                                                    title="Punto rojo"
                                                                                />
                                                                            )}
                                                                            {m.jurisdiccion && (
                                                                                <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                                                                    {
                                                                                        m.jurisdiccion
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {!m.pdf_url && (
                                                                                <span
                                                                                    className="inline-flex items-center gap-1 rounded border border-warning/30 bg-warning-soft px-1.5 py-0.5 text-xs font-semibold text-warning-soft-foreground"
                                                                                    title="Sin PDF"
                                                                                >
                                                                                    <FileX className="h-2.5 w-2.5" />{' '}
                                                                                    Sin
                                                                                    PDF
                                                                                </span>
                                                                            )}
                                                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                                                {formatFecha(
                                                                                    m.fecha,
                                                                                )}
                                                                            </span>
                                                                            {m.fecha_vencimiento && (
                                                                                <span
                                                                                    className={cn(
                                                                                        'text-xs tabular-nums',
                                                                                        vencida
                                                                                            ? 'text-muted-foreground/40 line-through'
                                                                                            : vencUrgente
                                                                                              ? 'font-semibold text-destructive'
                                                                                              : vencProximo
                                                                                                ? 'font-semibold text-warning-soft-foreground'
                                                                                                : 'text-muted-foreground/70',
                                                                                    )}
                                                                                >
                                                                                    vto{' '}
                                                                                    {formatFecha(
                                                                                        m.fecha_vencimiento,
                                                                                    )}
                                                                                    {vencUrgente &&
                                                                                        dias !==
                                                                                            null &&
                                                                                        ` (${dias === 0 ? 'hoy' : `${dias}d`})`}
                                                                                </span>
                                                                            )}
                                                                            {tab !==
                                                                                'vehiculo' && (
                                                                                <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground uppercase">
                                                                                    <Highlight
                                                                                        text={
                                                                                            m.patente
                                                                                        }
                                                                                        query={
                                                                                            search
                                                                                        }
                                                                                    />
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-sm font-medium text-foreground">
                                                                            {
                                                                                m.descripcion
                                                                            }
                                                                        </p>
                                                                        {tab ===
                                                                            'vehiculo' && (
                                                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                                {m.conductor ? (
                                                                                    <Highlight
                                                                                        text={
                                                                                            m.conductor
                                                                                        }
                                                                                        query={
                                                                                            search
                                                                                        }
                                                                                    />
                                                                                ) : (
                                                                                    <span className="italic opacity-50">
                                                                                        Sin
                                                                                        chofer
                                                                                    </span>
                                                                                )}
                                                                                {m.conductor_inactivo && (
                                                                                    <InactivoBadge />
                                                                                )}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                                                                        {
                                                                            montoNode
                                                                        }
                                                                        {
                                                                            editBtn
                                                                        }
                                                                    </div>
                                                                </div>
                                                                {estadosNode(
                                                                    'w-full',
                                                                )}
                                                            </div>

                                                            {/* ── DESKTOP ── */}
                                                            <div className="hidden items-center gap-4 px-4 py-2.5 sm:flex">
                                                                <span className="w-[80px] shrink-0 text-xs text-muted-foreground tabular-nums">
                                                                    {formatFecha(
                                                                        m.fecha,
                                                                    )}
                                                                </span>
                                                                <span
                                                                    className={cn(
                                                                        'w-[80px] shrink-0 text-xs tabular-nums',
                                                                        !m.fecha_vencimiento
                                                                            ? 'text-muted-foreground/30'
                                                                            : vencida
                                                                              ? 'text-muted-foreground/40 line-through'
                                                                              : vencUrgente
                                                                                ? 'font-semibold text-destructive'
                                                                                : vencProximo
                                                                                  ? 'font-semibold text-warning-soft-foreground'
                                                                                  : 'text-muted-foreground',
                                                                    )}
                                                                >
                                                                    {m.fecha_vencimiento
                                                                        ? formatFecha(
                                                                              m.fecha_vencimiento,
                                                                          )
                                                                        : '—'}
                                                                    {vencUrgente &&
                                                                        dias !==
                                                                            null && (
                                                                            <span className="ml-1 text-xs opacity-80">
                                                                                {dias ===
                                                                                0
                                                                                    ? 'hoy'
                                                                                    : `${dias}d`}
                                                                            </span>
                                                                        )}
                                                                </span>
                                                                <div className="flex w-[72px] shrink-0 items-center gap-1.5">
                                                                    {m.punto_rojo && (
                                                                        <span
                                                                            aria-hidden="true" className="size-2 shrink-0 rounded-full bg-destructive"
                                                                            title="Punto rojo"
                                                                        />
                                                                    )}
                                                                    {m.jurisdiccion && (
                                                                        <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                                                            {
                                                                                m.jurisdiccion
                                                                            }
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="w-32 shrink-0">
                                                                    {tab ===
                                                                    'vehiculo' ? (
                                                                        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                                            <span className="truncate">
                                                                                {m.conductor ? (
                                                                                    <Highlight
                                                                                        text={
                                                                                            m.conductor
                                                                                        }
                                                                                        query={
                                                                                            search
                                                                                        }
                                                                                    />
                                                                                ) : (
                                                                                    <span className="italic opacity-50">
                                                                                        Sin
                                                                                        chofer
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                            {m.conductor_inactivo && (
                                                                                <InactivoBadge />
                                                                            )}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground uppercase">
                                                                            <Highlight
                                                                                text={
                                                                                    m.patente
                                                                                }
                                                                                query={
                                                                                    search
                                                                                }
                                                                            />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p
                                                                    className="min-w-0 flex-1 truncate text-sm text-foreground"
                                                                    title={
                                                                        m.descripcion
                                                                    }
                                                                >
                                                                    {
                                                                        m.descripcion
                                                                    }
                                                                </p>
                                                                <div className="w-28 shrink-0 text-right">
                                                                    {montoNode}
                                                                </div>
                                                                {estadosNode(
                                                                    'w-[196px] shrink-0',
                                                                )}
                                                                <div className="flex w-[60px] shrink-0 items-center justify-end gap-1">
                                                                    {editBtn}
                                                                    <MultaPdf
                                                                        pdfUrl={
                                                                            m.pdf_url
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
            </PageContainer>

            <RegistrarMultaModal
                open={showModal}
                onClose={() => setShowModal(false)}
                vehiculos={vehiculos}
            />

            <EditarMultaModal
                multa={editing}
                onClose={() => setEditing(null)}
                onDelete={deleteMulta}
            />

            <CobrarMultaModal
                multa={cobrando}
                onClose={() => setCobrando(null)}
            />
        </>
    );
}

MultasIndex.layout = {
    breadcrumbs: [
        {
            title: 'Multas',
            href: '/multas',
        },
    ],
};
