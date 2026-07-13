import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Building2,
    CalendarDays,
    Car,
    Check,
    ChevronDown,
    Download,
    FileText,
    FileX,
    Medal,
    Pencil,
    Plus,
    Search,
    Siren,
    Trash2,
    User as UserIcon,
    UserX,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatARS } from '@/components/recaudaciones-tabla';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/money-input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Multa {
    id: number;
    vehiculo_id: number;
    patente: string;
    marca?: string | null;
    modelo?: string | null;
    conductor_id: number | null;
    conductor?: string | null;
    conductor_inactivo: boolean;
    fecha: string;
    fecha_vencimiento: string | null;
    monto: number;
    descripcion: string;
    punto_rojo: boolean;
    jurisdiccion: 'CABA' | 'GBA' | null;
    pdf_url: string | null;
    pagado: boolean;
    cobrado: boolean;
    cobrada_en: string | null;
    monto_cobrado: number;
    pagos: Pago[];
}

interface Pago {
    id: number;
    fecha: string;
    monto: number;
    comprobante_url: string | null;
    con_deposito: boolean;
}

/** Una multa está pendiente mientras no esté pagada al sistema de infracciones o no esté cobrada al chofer. */
function pendiente(m: Multa): boolean {
    return !m.pagado || !m.cobrado;
}

interface VehiculoOpt {
    id: number;
    patente: string;
    marca: string;
    modelo: string;
}

interface Props {
    multas: Multa[];
    vehiculos: VehiculoOpt[];
}

type Tab = 'vehiculo' | 'chofer' | 'ex-chofer' | 'ranking';

function formatFecha(d: string): string {
    const [y, m, day] = d.slice(0, 10).split('-');
    return `${day}/${m}/${y}`;
}

const HOY = new Date().toISOString().slice(0, 10);
const _d3 = new Date();
_d3.setDate(_d3.getDate() + 3);
const HOY_PLUS_3 = _d3.toISOString().slice(0, 10);
const _d7 = new Date();
_d7.setDate(_d7.getDate() + 7);
const HOY_PLUS_7 = _d7.toISOString().slice(0, 10);

function diasHastaVenc(v: string): number {
    return Math.round(
        (new Date(v).getTime() - new Date(HOY).getTime()) / 86_400_000,
    );
}

/**
 * Solo las multas de CABA tienen 50% de descuento si se pagan antes (o el mismo
 * día) del vencimiento. Las de GBA (provincia) nunca tienen descuento, y sin
 * fecha de vencimiento tampoco aplica.
 */
function tieneDescuento(m: Multa): boolean {
    return m.jurisdiccion === 'CABA' && !!m.fecha_vencimiento && HOY <= m.fecha_vencimiento;
}

/** Monto vigente hoy: 50% si todavía no venció, total en caso contrario. */
function montoEfectivo(m: Multa): number {
    return tieneDescuento(m) ? m.monto * 0.5 : m.monto;
}

/** Lo que falta cobrarle al chofer hoy (0 si ya está cobrada del todo o es punto rojo). */
function faltante(m: Multa): number {
    if (m.cobrado || m.punto_rojo) return 0;
    return Math.max(montoEfectivo(m) - m.monto_cobrado, 0);
}

/** Estado del cobro al chofer: sin cobrar / parcial / cobrada. */
function estadoCobro(m: Multa): 'sin' | 'parcial' | 'cobrada' {
    if (m.cobrado) return 'cobrada';
    if (m.monto_cobrado > 0) return 'parcial';
    return 'sin';
}

interface Grupo {
    key: string;
    id: number | null;
    titulo: string;
    sub: string;
    multas: Multa[];
    pendientes: number;
    total: number;
}

type FiltroEstado = '' | 'si' | 'no';
type FiltroJurisdiccion = '' | 'CABA' | 'GBA';
type FiltroPeriodo = '' | 'mes' | 'mes-ant' | '3m' | 'año';

function periodoRango(p: FiltroPeriodo): { desde: string; hasta: string } {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (p === 'mes')
        return {
            desde: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
            hasta: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        };
    if (p === 'mes-ant')
        return {
            desde: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
            hasta: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
        };
    if (p === '3m') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);
        return { desde: iso(d), hasta: iso(now) };
    }
    if (p === 'año')
        return { desde: `${now.getFullYear()}-01-01`, hasta: iso(now) };
    return { desde: '', hasta: '' };
}

export default function MultasIndex({ multas, vehiculos }: Props) {
    const [tab, setTab] = useState<Tab>('vehiculo');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Multa | null>(null);
    const [cobrando, setCobrando] = useState<Multa | null>(null);

    // Filtros
    const [fJurisdiccion, setFJurisdiccion] = useState<FiltroJurisdiccion>('');
    const [fSistema, setFSistema] = useState<FiltroEstado>('');
    const [fChofer, setFChofer] = useState<FiltroEstado>('');
    const [fPuntoRojo, setFPuntoRojo] = useState(false);
    const [fVencimiento, setFVencimiento] = useState<
        '' | 'vencida' | 'no-vencida'
    >('');
    const [fDesde, setFDesde] = useState('');
    const [fHasta, setFHasta] = useState('');

    // Periodo activo: se deriva comparando fechas con cada preset
    const fPeriodoActivo = useMemo<FiltroPeriodo>(() => {
        for (const p of ['mes', 'mes-ant', '3m', 'año'] as FiltroPeriodo[]) {
            const r = periodoRango(p);
            if (r.desde === fDesde && r.hasta === fHasta) return p;
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
        if (search) p.set('q', search);
        if (fJurisdiccion) p.set('jurisdiccion', fJurisdiccion);
        if (fSistema) p.set('sistema', fSistema);
        if (fChofer) p.set('chofer', fChofer);
        if (fPuntoRojo) p.set('punto_rojo', '1');
        if (fVencimiento) p.set('vencimiento', fVencimiento);
        if (tab === 'ex-chofer') p.set('inactivo', '1');
        if (fDesde) p.set('desde', fDesde);
        if (fHasta) p.set('hasta', fHasta);
        return `/multas/pdf?${p.toString()}`;
    }

    const stats = useMemo(() => {
        const conMonto = multas.filter((m) => !m.punto_rojo);
        // Solo CABA: son las únicas que pierden descuento al vencer (GBA no tiene).
        const proximasVencer = multas.filter(
            (m) =>
                m.jurisdiccion === 'CABA' &&
                m.fecha_vencimiento &&
                !m.cobrado &&
                !m.punto_rojo &&
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
            if (m.punto_rojo) continue;
            const key = m.conductor_id ? `c${m.conductor_id}` : 'sin';
            if (!map.has(key))
                map.set(key, {
                    id: m.conductor_id ?? 0,
                    nombre: m.conductor ?? 'Sin chofer',
                    cnt: 0,
                    total: 0,
                    pagado: 0,
                    adeudado: 0,
                });
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
            )
                return false;
            if (fJurisdiccion && m.jurisdiccion !== fJurisdiccion) return false;
            if (fSistema === 'si' && !m.pagado) return false;
            if (fSistema === 'no' && m.pagado) return false;
            if (fChofer === 'si' && !m.cobrado) return false;
            if (fChofer === 'no' && m.cobrado) return false;
            if (fPuntoRojo && !m.punto_rojo) return false;
            if (
                fVencimiento === 'no-vencida' &&
                !(m.fecha_vencimiento && m.fecha_vencimiento >= HOY)
            )
                return false;
            if (
                fVencimiento === 'vencida' &&
                !(m.fecha_vencimiento && m.fecha_vencimiento < HOY)
            )
                return false;
            if (tab === 'ex-chofer' && !m.conductor_inactivo) return false;
            if (fDesde && m.fecha < fDesde) return false;
            if (fHasta && m.fecha > fHasta) return false;
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
            if (!map.has(key))
                map.set(key, {
                    key,
                    id: id ?? 0,
                    titulo,
                    sub,
                    multas: [],
                    pendientes: 0,
                    total: 0,
                });
            map.get(key)!.multas.push(m);
        }

        return Array.from(map.values())
            .map((g) => ({
                ...g,
                pendientes: g.multas.filter(pendiente).length,
                total: g.multas.reduce((s, m) => s + montoEfectivo(m), 0),
            }))
            .sort(
                (a, b) =>
                    b.pendientes - a.pendientes ||
                    b.total - a.total ||
                    a.titulo.localeCompare(b.titulo, 'es', { numeric: true }),
            );
    }, [
        multas,
        tab,
        search,
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
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function togglePagado(id: number) {
        router.patch(
            `/multas/${id}/pagado`,
            {},
            { preserveScroll: true, preserveState: true },
        );
    }

    function toggleCobrado(m: Multa) {
        if (m.punto_rojo) {
            // Sin importe: cobro sí/no directo (sin monto).
            router.patch(
                `/multas/${m.id}/cobrado`,
                m.cobrado ? { reset: true } : { fecha_cobro: HOY },
                { preserveScroll: true, preserveState: true },
            );
            return;
        }
        // Con importe: el modal registra el pago (total o parcial) o reinicia.
        setCobrando(m);
    }

    function deleteMulta(id: number) {
        router.delete(`/multas/${id}`, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Multas" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                            Multas
                        </h1>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            La multa se imputa al chofer que tenía el vehículo
                            en la fecha de la infracción.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={buildPdfUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">
                                Exportar PDF
                            </span>
                        </a>
                        <Button
                            size="sm"
                            onClick={() => setShowModal(true)}
                            className="shrink-0"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">
                                Registrar multa
                            </span>
                        </Button>
                    </div>
                </div>

                {/* Mini dashboard */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="flex flex-col gap-1 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 shadow-sm">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
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
                    <div className="flex flex-col gap-1 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 shadow-sm">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
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
                    <div className="flex items-start gap-3 rounded-xl border border-orange-400/30 bg-orange-500/5 px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
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
                <div className="flex gap-1.5">
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
                        ] as const
                    ).map(({ val, label, icon: Icon }) => (
                        <button
                            key={val}
                            type="button"
                            onClick={() => setTab(val)}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.98]',
                                tab === val
                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
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
                                    <span className="w-6 shrink-0 text-[11px] font-medium text-muted-foreground">
                                        #
                                    </span>
                                    <span className="flex-1 text-[11px] font-medium text-muted-foreground">
                                        Conductor
                                    </span>
                                    <span className="w-16 shrink-0 text-center text-[11px] font-medium text-muted-foreground">
                                        Multas
                                    </span>
                                    <span className="w-28 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                                        Total
                                    </span>
                                    <span className="w-28 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                                        Pagado
                                    </span>
                                    <span className="w-28 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                                        Adeuda
                                    </span>
                                    <span className="w-24 shrink-0 text-[11px] font-medium text-muted-foreground">
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
                                                        ? 'text-yellow-500'
                                                        : i === 1
                                                          ? 'text-zinc-400'
                                                          : i === 2
                                                            ? 'text-amber-700'
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
                                            <span className="w-28 shrink-0 text-right text-xs font-semibold text-green-600 tabular-nums dark:text-green-400">
                                                {formatARS(r.pagado)}
                                            </span>
                                            <span
                                                className={cn(
                                                    'w-28 shrink-0 text-right text-xs font-semibold tabular-nums',
                                                    r.adeudado > 0
                                                        ? 'text-red-500'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {formatARS(r.adeudado)}
                                            </span>
                                            <div className="w-24 shrink-0">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                                        <div
                                                            className="h-full rounded-full bg-green-500 transition-all"
                                                            style={{
                                                                width: `${pct}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="w-7 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
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
                {tab !== 'ranking' && (
                    <div className="rounded-xl border border-border bg-card shadow-sm">
                        {/* Buscador */}
                        <div className="flex items-center gap-2 px-3 py-3">
                            <div className="relative flex-1">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Buscar patente o chofer..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            {(filtrosActivos > 0 || search) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        limpiarFiltros();
                                        setSearch('');
                                    }}
                                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                                <span className="h-2 w-2 rounded-full bg-red-500" />{' '}
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
                            <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
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

                {/* Lista agrupada */}
                {tab !== 'ranking' &&
                    (grupos.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-sm">
                            {multas.length === 0
                                ? 'Todavía no hay multas registradas.'
                                : 'No hay multas que coincidan con los filtros.'}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 pb-4">
                            {grupos.map((g) => {
                                const isOpen = expanded.has(g.key);
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
                                                        {g.titulo}
                                                    </span>
                                                ) : (
                                                    <span className="flex min-w-0 shrink items-center gap-1.5">
                                                        <span className="truncate text-sm font-semibold text-foreground">
                                                            {g.titulo}
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
                                                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                        {g.pendientes} pendiente
                                                        {g.pendientes !== 1
                                                            ? 's'
                                                            : ''}
                                                    </span>
                                                ) : (
                                                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
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
                                                    <span className="w-[80px] shrink-0 text-[11px] font-medium text-muted-foreground">
                                                        Fecha inf.
                                                    </span>
                                                    <span className="w-[80px] shrink-0 text-[11px] font-medium text-muted-foreground">
                                                        Vencimiento
                                                    </span>
                                                    <span className="w-[72px] shrink-0 text-[11px] font-medium text-muted-foreground">
                                                        Jurisd.
                                                    </span>
                                                    <span className="w-32 shrink-0 text-[11px] font-medium text-muted-foreground">
                                                        {tab === 'vehiculo'
                                                            ? 'Conductor'
                                                            : 'Patente'}
                                                    </span>
                                                    <span className="min-w-0 flex-1 text-[11px] font-medium text-muted-foreground">
                                                        Descripción
                                                    </span>
                                                    <span className="w-28 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                                                        Monto
                                                    </span>
                                                    <span className="w-[196px] shrink-0 text-[11px] font-medium text-muted-foreground">
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
                                                        m.punto_rojo ? (
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
                                                                        <span className="text-sm font-semibold text-green-600 tabular-nums dark:text-green-400">
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
                                                                        'flex flex-1 items-center justify-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors',
                                                                        m.pagado
                                                                            ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400'
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
                                                                        estadoCobro(m) === 'cobrada'
                                                                            ? (m.cobrada_en ? `Cobrada — pagó ${formatARS(m.monto_cobrado)} el ${formatFecha(m.cobrada_en)}` : 'Cobrada')
                                                                            : estadoCobro(m) === 'parcial'
                                                                                ? `Pago parcial: pagó ${formatARS(m.monto_cobrado)}, falta ${formatARS(faltante(m))}`
                                                                                : 'Registrar cobro al chofer'
                                                                    }
                                                                    className={cn(
                                                                        'flex flex-1 items-center justify-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors',
                                                                        estadoCobro(m) === 'cobrada'
                                                                            ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                            : estadoCobro(m) === 'parcial'
                                                                                ? 'border-orange-300 bg-orange-100 text-orange-700 hover:bg-orange-200 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                                                : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
                                                                    )}
                                                                >
                                                                    <UserIcon className="h-3 w-3 shrink-0" />
                                                                    {estadoCobro(m) === 'cobrada'
                                                                        ? 'Cobrada'
                                                                        : estadoCobro(m) === 'parcial'
                                                                            ? 'Parcial'
                                                                            : 'Sin cobrar'}
                                                                </button>
                                                            </div>
                                                            {!m.punto_rojo && estadoCobro(m) !== 'sin' && (
                                                                <span className="flex items-center justify-center gap-1 text-center text-[10px] text-muted-foreground">
                                                                    <UserIcon className="h-2.5 w-2.5 shrink-0" />
                                                                    {estadoCobro(m) === 'cobrada'
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

                                                    return (
                                                        <div
                                                            key={m.id}
                                                            className="divide-y divide-border border-b border-border last:border-b-0"
                                                        >
                                                            {/* ── MOBILE ── */}
                                                            <div className="flex flex-col gap-3 px-4 py-3 sm:hidden">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex min-w-0 flex-col gap-1">
                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                            {m.punto_rojo && (
                                                                                <span
                                                                                    className="h-2 w-2 rounded-full bg-red-500"
                                                                                    title="Punto rojo"
                                                                                />
                                                                            )}
                                                                            {m.jurisdiccion && (
                                                                                <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                                                                    {
                                                                                        m.jurisdiccion
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {!m.pdf_url && (
                                                                                <span
                                                                                    className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
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
                                                                                              ? 'font-semibold text-red-500'
                                                                                              : vencProximo
                                                                                                ? 'font-semibold text-amber-500 dark:text-amber-400'
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
                                                                                <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground uppercase">
                                                                                    {
                                                                                        m.patente
                                                                                    }
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
                                                                                {m.conductor ?? (
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
                                                                                ? 'font-semibold text-red-500'
                                                                                : vencProximo
                                                                                  ? 'font-semibold text-amber-500 dark:text-amber-400'
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
                                                                            <span className="ml-1 text-[10px] opacity-80">
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
                                                                            className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                                                                            title="Punto rojo"
                                                                        />
                                                                    )}
                                                                    {m.jurisdiccion && (
                                                                        <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
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
                                                                                {m.conductor ?? (
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
                                                                        <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground uppercase">
                                                                            {
                                                                                m.patente
                                                                            }
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
            </div>

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

function MultaPdf({ pdfUrl }: { pdfUrl: string | null }) {
    if (!pdfUrl) {
        return (
            <span
                title="Sin PDF"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
                <FileX className="h-3.5 w-3.5" />
            </span>
        );
    }
    return (
        <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver PDF"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
            <FileText className="h-3.5 w-3.5" />
        </a>
    );
}

/** Al marcar una multa como cobrada, pide la fecha en que pagó el chofer. */
function CobrarMultaModal({
    multa,
    onClose,
}: {
    multa: Multa | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={!!multa}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                {multa && (
                    <CobrarMultaForm
                        key={multa.id}
                        multa={multa}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function CobrarMultaForm({
    multa,
    onClose,
}: {
    multa: Multa;
    onClose: () => void;
}) {
    const today = new Date().toISOString().slice(0, 10);
    const total = montoEfectivo(multa);
    const pagado = multa.monto_cobrado;
    const falta = Math.max(total - pagado, 0);
    const fully = multa.cobrado;

    const form = useForm({
        monto: fully ? '' : String(falta.toFixed(2)),
        fecha_cobro: today,
        comprobante: null as File | null,
        con_deposito: false,
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        // Comprobante por multipart; la ruta es PATCH, hay que falsear el método.
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post(`/multas/${multa.id}/cobrado`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => onClose(),
        });
    }

    function reiniciar() {
        router.patch(
            `/multas/${multa.id}/cobrado`,
            { reset: true },
            { preserveScroll: true, onSuccess: () => onClose() },
        );
    }

    function eliminarPago(pagoId: number) {
        router.delete(`/multas/${multa.id}/pagos/${pagoId}`, {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    }

    const montoNum = Number(form.data.monto);
    const puedeRegistrar = montoNum > 0 && form.data.fecha_cobro !== '' && !form.processing;

    return (
        <form onSubmit={submit}>
            <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/15">
                    <UserIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                    <DialogTitle className="text-base font-semibold">
                        Cobro al chofer
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        <span className="font-mono font-semibold uppercase">
                            {multa.patente}
                        </span>
                        {multa.conductor ? ` · ${multa.conductor}` : ''}
                    </DialogDescription>
                </div>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5">
                {/* Resumen del cobro */}
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center">
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                        <p className="text-sm font-bold tabular-nums text-foreground">{formatARS(total)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pagado</p>
                        <p className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400">{formatARS(pagado)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Falta</p>
                        <p className={cn('text-sm font-bold tabular-nums', falta > 0 ? 'text-foreground' : 'text-muted-foreground')}>{formatARS(falta)}</p>
                    </div>
                </div>

                {/* Pagos registrados */}
                {multa.pagos.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pagos registrados</p>
                        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                            {multa.pagos.map((p) => (
                                <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                                    <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">{formatFecha(p.fecha)}</span>
                                    <span className="text-sm font-semibold tabular-nums text-foreground">{formatARS(p.monto)}</span>
                                    <span className="flex-1">
                                        {p.con_deposito && (
                                            <span className="inline-flex items-center rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400" title="Pagado con depósito">
                                                Depósito
                                            </span>
                                        )}
                                    </span>
                                    {p.comprobante_url ? (
                                        <a
                                            href={p.comprobante_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Ver comprobante"
                                            className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                            <FileText className="h-3 w-3" /> Comp.
                                        </a>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground/60">sin comprobante</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => eliminarPago(p.id)}
                                        title="Eliminar pago"
                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {fully ? (
                    <p className="text-center text-sm font-medium text-green-600 dark:text-green-400">
                        Cobrada por completo{multa.cobrada_en ? ` el ${formatFecha(multa.cobrada_en)}` : ''}.
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cobro-monto">Monto que pagó</Label>
                                <MoneyInput
                                    id="cobro-monto"
                                    value={form.data.monto === '' ? null : Number(form.data.monto)}
                                    onValueChange={(n) => form.setData('monto', n == null ? '' : String(n))}
                                />
                                {form.errors.monto && <p className="text-xs text-red-600">{form.errors.monto}</p>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cobro-fecha">Fecha del pago</Label>
                                <Input
                                    id="cobro-fecha"
                                    type="date"
                                    value={form.data.fecha_cobro}
                                    max={today}
                                    onChange={(e) => form.setData('fecha_cobro', e.target.value)}
                                />
                                {form.errors.fecha_cobro && <p className="text-xs text-red-600">{form.errors.fecha_cobro}</p>}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Comprobante <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40">
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className={cn('min-w-0 flex-1 truncate', form.data.comprobante ? 'text-foreground' : 'text-muted-foreground')}>
                                    {form.data.comprobante ? form.data.comprobante.name : 'Adjuntar comprobante (PDF o imagen)...'}
                                </span>
                                <input
                                    type="file"
                                    accept="application/pdf,image/*"
                                    className="hidden"
                                    onChange={(e) => form.setData('comprobante', e.target.files?.[0] ?? null)}
                                />
                            </label>
                            {form.errors.comprobante && <p className="text-xs text-red-600">{form.errors.comprobante}</p>}
                        </div>

                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/40">
                            <input
                                type="checkbox"
                                checked={form.data.con_deposito}
                                onChange={(e) => form.setData('con_deposito', e.target.checked)}
                                className="h-4 w-4 rounded border-input accent-primary"
                            />
                            <span className="text-sm text-foreground">Paga con depósito</span>
                        </label>

                        <p className="-mt-1 text-[11px] text-muted-foreground">
                            Si el pago no cubre el total, la multa queda como cobro parcial (pendiente).
                        </p>
                    </>
                )}
            </div>

            <DialogFooter className="flex flex-row flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
                {pagado > 0 && (
                    <Button type="button" variant="ghost" onClick={reiniciar} className="mr-auto text-red-600 hover:text-red-700 dark:text-red-400">
                        Reiniciar cobro
                    </Button>
                )}
                <Button type="button" variant="outline" onClick={onClose}>
                    <X className="h-4 w-4" /> Cerrar
                </Button>
                {!fully && (
                    <Button type="submit" disabled={!puedeRegistrar}>
                        {form.processing ? 'Guardando...' : <><Check className="h-4 w-4" /> Registrar pago</>}
                    </Button>
                )}
            </DialogFooter>
        </form>
    );
}

function RegistrarMultaModal({
    open,
    onClose,
    vehiculos,
}: {
    open: boolean;
    onClose: () => void;
    vehiculos: VehiculoOpt[];
}) {
    const today = new Date().toISOString().slice(0, 10);
    const form = useForm({
        vehiculo_id: '' as string,
        fecha: today,
        fecha_vencimiento: '' as string,
        monto: '' as string,
        descripcion: '' as string,
        punto_rojo: false,
        jurisdiccion: '' as '' | 'CABA' | 'GBA',
        pdf: null as File | null,
    });

    const opciones: ComboboxOption[] = useMemo(
        () =>
            vehiculos.map((v) => ({
                value: String(v.id),
                label: v.patente,
                sub: `${v.marca} ${v.modelo}`,
            })),
        [vehiculos],
    );

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/multas', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                form.setData('fecha', today);
                onClose();
            },
        });
    }

    const puntoRojo = form.data.punto_rojo;
    const canSubmit =
        form.data.vehiculo_id !== '' &&
        form.data.fecha !== '' &&
        form.data.descripcion.trim() !== '' &&
        form.data.jurisdiccion !== '' &&
        (puntoRojo ||
            (form.data.fecha_vencimiento !== '' && form.data.monto !== ''));

    function setPuntoRojo(checked: boolean) {
        form.setData((prev) => ({
            ...prev,
            punto_rojo: checked,
            // Punto rojo no tiene importe ni vencimiento/descuento.
            monto: checked ? '' : prev.monto,
            fecha_vencimiento: checked ? '' : prev.fecha_vencimiento,
        }));
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) {
                    form.clearErrors();
                    onClose();
                }
            }}
        >
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                        <Siren className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                        <DialogTitle className="text-base font-semibold">
                            Registrar multa
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            El chofer se determina automáticamente según la
                            fecha.
                        </DialogDescription>
                    </div>
                </div>

                <form onSubmit={submit}>
                    <div className="flex flex-col gap-4 px-5 py-5">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="multa-patente">Patente</Label>
                            <Combobox
                                id="multa-patente"
                                placeholder="Buscar patente..."
                                options={opciones}
                                value={form.data.vehiculo_id}
                                onSelect={(o) =>
                                    form.setData('vehiculo_id', o.value)
                                }
                                uppercase
                            />
                            {form.errors.vehiculo_id && (
                                <p className="text-xs text-red-600">
                                    {form.errors.vehiculo_id}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="multa-fecha">
                                    Fecha de infracción
                                </Label>
                                <Input
                                    id="multa-fecha"
                                    type="date"
                                    value={form.data.fecha}
                                    max={today}
                                    onChange={(e) =>
                                        form.setData('fecha', e.target.value)
                                    }
                                />
                                {form.errors.fecha && (
                                    <p className="text-xs text-red-600">
                                        {form.errors.fecha}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="multa-vto">
                                    Fecha de vencimiento
                                </Label>
                                <Input
                                    id="multa-vto"
                                    type="date"
                                    value={form.data.fecha_vencimiento}
                                    min={form.data.fecha}
                                    disabled={puntoRojo}
                                    onChange={(e) =>
                                        form.setData(
                                            'fecha_vencimiento',
                                            e.target.value,
                                        )
                                    }
                                    className={cn(
                                        puntoRojo &&
                                            'cursor-not-allowed opacity-50',
                                    )}
                                />
                                {form.errors.fecha_vencimiento && (
                                    <p className="text-xs text-red-600">
                                        {form.errors.fecha_vencimiento}
                                    </p>
                                )}
                            </div>
                        </div>

                        <p className="-mt-2 text-[11px] text-muted-foreground">
                            {puntoRojo
                                ? 'Las multas de punto rojo no tienen importe ni vencimiento.'
                                : form.data.jurisdiccion === 'GBA'
                                    ? 'Las multas de GBA (provincia) no tienen descuento.'
                                    : 'CABA: pagando antes del vencimiento, la multa tiene un 50% de descuento (GBA no tiene descuento).'}
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="multa-monto">Monto total</Label>
                                <MoneyInput
                                    id="multa-monto"
                                    placeholder={
                                        puntoRojo ? 'Sin monto' : '0,00'
                                    }
                                    value={form.data.monto === '' ? null : Number(form.data.monto)}
                                    disabled={puntoRojo}
                                    onValueChange={(n) =>
                                        form.setData('monto', n == null ? '' : String(n))
                                    }
                                    className={cn(
                                        puntoRojo &&
                                            'cursor-not-allowed opacity-50',
                                    )}
                                />
                                {form.errors.monto && (
                                    <p className="text-xs text-red-600">
                                        {form.errors.monto}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Jurisdicción</Label>
                                <div className="flex gap-1.5">
                                    {(['CABA', 'GBA'] as const).map((j) => (
                                        <button
                                            key={j}
                                            type="button"
                                            onClick={() =>
                                                form.setData('jurisdiccion', j)
                                            }
                                            className={cn(
                                                'h-9 flex-1 rounded-lg border text-sm font-medium transition-all active:scale-[0.98]',
                                                form.data.jurisdiccion === j
                                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                            )}
                                        >
                                            {j}
                                        </button>
                                    ))}
                                </div>
                                {form.errors.jurisdiccion && (
                                    <p className="text-xs text-red-600">
                                        {form.errors.jurisdiccion}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="multa-desc">Descripción</Label>
                            <textarea
                                id="multa-desc"
                                rows={3}
                                placeholder="Motivo de la multa..."
                                value={form.data.descripcion}
                                onChange={(e) =>
                                    form.setData('descripcion', e.target.value)
                                }
                                maxLength={1000}
                                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                            />
                            {form.errors.descripcion && (
                                <p className="text-xs text-red-600">
                                    {form.errors.descripcion}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>
                                PDF de la multa{' '}
                                <span className="font-normal text-muted-foreground">
                                    (opcional)
                                </span>
                            </Label>
                            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40">
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span
                                    className={cn(
                                        'min-w-0 flex-1 truncate',
                                        form.data.pdf
                                            ? 'text-foreground'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {form.data.pdf
                                        ? form.data.pdf.name
                                        : 'Seleccionar archivo PDF...'}
                                </span>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={(e) =>
                                        form.setData(
                                            'pdf',
                                            e.target.files?.[0] ?? null,
                                        )
                                    }
                                />
                            </label>
                            {form.errors.pdf && (
                                <p className="text-xs text-red-600">
                                    {form.errors.pdf}
                                </p>
                            )}
                        </div>

                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/40">
                            <input
                                type="checkbox"
                                checked={form.data.punto_rojo}
                                onChange={(e) => setPuntoRojo(e.target.checked)}
                                className="h-4 w-4 rounded border-input accent-red-500"
                            />
                            <span className="flex items-center gap-1.5 text-sm text-foreground">
                                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                Punto rojo
                            </span>
                        </label>
                    </div>

                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" /> Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={!canSubmit || form.processing}
                        >
                            {form.processing ? (
                                'Guardando...'
                            ) : (
                                <>
                                    <Check className="h-4 w-4" /> Registrar
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Modal para editar el monto y la fecha de vencimiento de una multa. */
function EditarMultaModal({
    multa,
    onClose,
    onDelete,
}: {
    multa: Multa | null;
    onClose: () => void;
    onDelete: (id: number) => void;
}) {
    return (
        <Dialog
            open={!!multa}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                {multa && (
                    <EditarMultaForm
                        key={multa.id}
                        multa={multa}
                        onClose={onClose}
                        onDelete={onDelete}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function EditarMultaForm({
    multa,
    onClose,
    onDelete,
}: {
    multa: Multa;
    onClose: () => void;
    onDelete: (id: number) => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const form = useForm({
        monto: String(multa.monto),
        fecha_vencimiento: multa.fecha_vencimiento ?? '',
        pdf: null as File | null,
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        // El PDF se sube por multipart; en rutas PATCH hay que falsear el método.
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post(`/multas/${multa.id}`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => onClose(),
        });
    }

    const camposOk = multa.punto_rojo
        ? form.data.pdf !== null
        : form.data.monto !== '' && form.data.fecha_vencimiento !== '';

    return (
        <>
            <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Pencil className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                    <DialogTitle className="text-base font-semibold">
                        Editar multa
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        <span className="font-mono font-semibold uppercase">
                            {multa.patente}
                        </span>{' '}
                        · infracción del {formatFecha(multa.fecha)}
                    </DialogDescription>
                </div>
            </div>

            <form onSubmit={submit}>
                <div className="flex flex-col gap-4 px-5 py-5">
                    {multa.punto_rojo ? (
                        <p className="text-xs text-muted-foreground">
                            Multa de punto rojo: no tiene monto ni vencimiento.
                            Solo podés cambiar el PDF.
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-monto">Monto total</Label>
                                <MoneyInput
                                    id="edit-monto"
                                    placeholder="0,00"
                                    value={form.data.monto === '' ? null : Number(form.data.monto)}
                                    onValueChange={(n) =>
                                        form.setData('monto', n == null ? '' : String(n))
                                    }
                                />
                                {form.errors.monto && (
                                    <p className="text-xs text-red-600">
                                        {form.errors.monto}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-vto">
                                    Fecha de vencimiento
                                </Label>
                                <Input
                                    id="edit-vto"
                                    type="date"
                                    value={form.data.fecha_vencimiento}
                                    min={multa.fecha}
                                    onChange={(e) =>
                                        form.setData(
                                            'fecha_vencimiento',
                                            e.target.value,
                                        )
                                    }
                                />
                                {form.errors.fecha_vencimiento && (
                                    <p className="text-xs text-red-600">
                                        {form.errors.fecha_vencimiento}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <Label>PDF de la multa</Label>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span
                                className={cn(
                                    'min-w-0 flex-1 truncate',
                                    form.data.pdf
                                        ? 'text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {form.data.pdf
                                    ? form.data.pdf.name
                                    : multa.pdf_url
                                      ? 'Reemplazar PDF (opcional)...'
                                      : 'Subir PDF (opcional)...'}
                            </span>
                            <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={(e) =>
                                    form.setData(
                                        'pdf',
                                        e.target.files?.[0] ?? null,
                                    )
                                }
                            />
                        </label>
                        {multa.pdf_url && !form.data.pdf && (
                            <a
                                href={multa.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                            >
                                Ver PDF actual
                            </a>
                        )}
                        {form.errors.pdf && (
                            <p className="text-xs text-red-600">
                                {form.errors.pdf}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                    {confirmDelete ? (
                        <>
                            <span className="mr-auto text-xs text-muted-foreground">
                                ¿Seguro que querés eliminarla?
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmDelete(false)}
                            >
                                No
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="bg-red-500 hover:bg-red-600"
                                onClick={() => onDelete(multa.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Sí, eliminar
                            </Button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="mr-auto text-xs text-muted-foreground/60 underline-offset-2 transition-colors hover:text-red-500 hover:underline"
                            >
                                Eliminar multa
                            </button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                            >
                                <X className="h-4 w-4" /> Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={!camposOk || form.processing}
                            >
                                {form.processing ? (
                                    'Guardando...'
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" /> Guardar
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </form>
        </>
    );
}

/** Etiqueta para choferes dados de baja. */
function InactivoBadge() {
    return (
        <span
            title="Chofer inactivo"
            className="inline-flex shrink-0 items-center gap-1 rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
        >
            Inactivo
        </span>
    );
}

function Chip({
    activo,
    onClick,
    children,
}: {
    activo: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97]',
                activo
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            {children}
        </button>
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
