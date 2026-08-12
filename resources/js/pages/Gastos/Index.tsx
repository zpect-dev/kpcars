import { Head, router, usePage } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Building2,
    Car,
    ChevronDown,
    ChevronRight,
    HandCoins,
    History,
    Plus,
    Trash2,
    Undo2,
    Wallet,
    Warehouse,
    Wrench,
    Box,
    UserCircle2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { ExportDropdown } from '@/components/export-dropdown';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { exportToExcel, exportToPdf } from '@/lib/export';
import { store as cajaChicaStore, revertir as cajaChicaRevertir } from '@/routes/caja-chica';
import { index, store, destroy } from '@/routes/gastos';

type MetodoPago = 'efectivo' | 'transferencia';

type Tipo =
    | 'galpon'
    | 'taller'
    | 'oficina'
    | 'kevin'
    | 'stock'
    | 'vehiculo';

interface PatenteOption {
    id: number;
    patente: string;
    marca: string;
    modelo: string;
}

interface Distribucion {
    user_id: number;
    user_name: string | null;
    monto: number;
}

interface DistribucionEmpresa {
    empresa_id: number;
    empresa_nombre: string | null;
    monto: number;
}

interface Gasto {
    id: number;
    fecha: string;
    monto: number;
    recibio: string;
    metodo_pago: MetodoPago;
    descripcion: string | null;
    tipo: Tipo;
    vehiculo: {
        id: number;
        patente: string;
        marca: string;
        modelo: string;
        inversion_id: number | null;
        inversion_nombre: string | null;
    } | null;
    registrado_por: string | null;
    distribuciones: Distribucion[] | null;
    distribuciones_empresas: DistribucionEmpresa[] | null;
    mi_monto: number | null;
}

interface CardData {
    key: string;
    label: string;
    total: number;
}

/** Tipos de movimiento de caja chica que se cargan a mano desde la UI. */
type CajaTipoManual = 'ingreso' | 'retiro' | 'ajuste';

interface CajaMovimiento {
    id: number;
    tipo: CajaTipoManual | 'gasto';
    tipo_label: string;
    /** Firmado: positivo suma al saldo, negativo lo resta. */
    monto: number;
    fecha: string;
    nota: string | null;
    gasto_id: number | null;
    es_contraasiento: boolean;
    revertido: boolean;
    registrado_por: string | null;
}

interface CajaChica {
    /** La caja vive mientras haya alguna empresa con período de caja abierto. */
    periodo_abierto: boolean;
    saldo: number;
    ingresos: number;
    /** En positivo: plata que salió de la caja. */
    egresos: number;
    movimientos: CajaMovimiento[];
}

interface Props {
    gastos: Gasto[];
    ultimosGlobales: Gasto[];
    cards: CardData[];
    patentes: PatenteOption[];
    cajaChica: CajaChica;
    canManage: boolean;
}

const TIPOS_FIJOS: { value: string; label: string }[] = [
    { value: 'tipo:galpon', label: 'Galpón' },
    { value: 'tipo:taller', label: 'Taller' },
    { value: 'tipo:oficina', label: 'Oficina' },
    { value: 'tipo:kevin', label: 'Kevin' },
    { value: 'tipo:stock', label: 'Stock' },
];

const TIPO_LABEL: Record<Tipo, string> = {
    galpon: 'Galpón',
    taller: 'Taller',
    oficina: 'Oficina',
    kevin: 'Kevin',
    stock: 'Stock',
    vehiculo: 'Vehículo',
};

function cardIcon(key: string): React.ReactNode {
    const cls = 'h-5 w-5 text-muted-foreground';
    if (key.startsWith('empresa_')) return <Building2 className={cls} />;
    if (key === 'kevin') return <UserCircle2 className={cls} />;
    if (key === 'galpon') return <Warehouse className={cls} />;
    return <HandCoins className={cls} />;
}

/** Tipos cuyo monto se reparte por empresa según autos alquilados. */
const TIPOS_POR_EMPRESA = ['galpon', 'taller', 'oficina'];

/** Agrega el reparto por empresa (congelado por gasto) sumando una lista de gastos. */
function empresasBreakdown(list: Gasto[]): { empresa_id: number; nombre: string; total: number }[] {
    const map = new Map<number, { empresa_id: number; nombre: string; total: number }>();
    for (const g of list) {
        for (const e of g.distribuciones_empresas ?? []) {
            const cur = map.get(e.empresa_id) ?? {
                empresa_id: e.empresa_id,
                nombre: e.empresa_nombre ?? 'Empresa',
                total: 0,
            };
            cur.total += e.monto;
            map.set(e.empresa_id, cur);
        }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function formatARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(value);
}

function formatDate(d: string): string {
    return new Date(`${d}T00:00:00`).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatDateDia(d: string): string {
    const date = new Date(`${d}T00:00:00`);
    const dia = date.toLocaleDateString('es-AR', { weekday: 'long' });
    const fecha = date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fecha}`;
}

const CAJA_TIPOS: { value: CajaTipoManual; label: string; hint: string }[] = [
    { value: 'ingreso', label: 'Ingreso', hint: 'Carga de plata a la caja (fondo inicial o reposición).' },
    { value: 'retiro', label: 'Retiro', hint: 'Sale plata de la caja sin ser un gasto (devolución, traspaso).' },
    { value: 'ajuste', label: 'Ajuste', hint: 'Corrección manual. El signo del monto define si suma o resta.' },
];

export default function GastosIndex({
    gastos,
    ultimosGlobales,
    cards,
    patentes,
    cajaChica,
    canManage,
}: Props) {
    const { auth } = usePage<any>().props;
    const isInversor = auth.user.role === 'inversor';

    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [mostrarTodosUltimos, setMostrarTodosUltimos] = useState(false);
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
    const [expandedInversiones, setExpandedInversiones] = useState<Set<string>>(
        new Set(),
    );

    function toggleCat(key: string) {
        setExpandedCats((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function toggleInv(key: string) {
        setExpandedInversiones((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    // Form state
    const today = new Date().toISOString().slice(0, 10);
    const [fecha, setFecha] = useState(today);
    const [monto, setMonto] = useState('');
    const [recibio, setRecibio] = useState('');
    const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
    const [descripcion, setDescripcion] = useState('');
    const [comboValue, setComboValue] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ─── Caja chica ─────────────────────────────────────────────────────────
    // Popover en hover con el mismo patrón que la card "Gastos de inventario"
    // de Cobros: un pequeño retardo al salir para poder entrar al contenido.
    const [showCajaPopover, setShowCajaPopover] = useState(false);
    const closeCajaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cancelCloseCaja = () => {
        if (closeCajaTimer.current) {
            clearTimeout(closeCajaTimer.current);
            closeCajaTimer.current = null;
        }
    };
    const openCajaNow = () => {
        cancelCloseCaja();
        setShowCajaPopover(true);
    };
    const scheduleCloseCaja = () => {
        cancelCloseCaja();
        closeCajaTimer.current = setTimeout(() => setShowCajaPopover(false), 90);
    };

    const [showCajaModal, setShowCajaModal] = useState(false);
    const [showCajaHistorial, setShowCajaHistorial] = useState(false);
    const [cajaSubmitting, setCajaSubmitting] = useState(false);
    const [cajaTipo, setCajaTipo] = useState<CajaTipoManual>('ingreso');
    const [cajaFecha, setCajaFecha] = useState(today);
    const [cajaMonto, setCajaMonto] = useState('');
    const [cajaNota, setCajaNota] = useState('');
    const [cajaErrors, setCajaErrors] = useState<Record<string, string>>({});

    function resetCajaForm() {
        setCajaTipo('ingreso');
        setCajaFecha(today);
        setCajaMonto('');
        setCajaNota('');
        setCajaErrors({});
    }

    function handleCajaSubmit() {
        const newErrors: Record<string, string> = {};
        if (!cajaFecha) newErrors.fecha = 'Requerido';
        // El ajuste admite monto negativo; el resto sólo importes positivos.
        if (!cajaMonto || Number(cajaMonto) === 0) newErrors.monto = 'Monto inválido';
        else if (cajaTipo !== 'ajuste' && Number(cajaMonto) < 0)
            newErrors.monto = 'Usá un ajuste para cargar un monto negativo';
        if (cajaTipo === 'ajuste' && !cajaNota.trim())
            newErrors.nota = 'Indicá el motivo del ajuste';

        if (Object.keys(newErrors).length > 0) {
            setCajaErrors(newErrors);
            return;
        }

        setCajaSubmitting(true);
        router.post(
            cajaChicaStore.url(),
            {
                tipo: cajaTipo,
                monto: Number(cajaMonto),
                fecha: cajaFecha,
                nota: cajaNota.trim() || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowCajaModal(false);
                    resetCajaForm();
                },
                onError: (errs) => setCajaErrors(errs as Record<string, string>),
                onFinish: () => setCajaSubmitting(false),
            },
        );
    }

    function handleCajaRevertir(id: number) {
        router.post(cajaChicaRevertir.url(id), {}, { preserveScroll: true });
    }

    // ─── Exportar (PDF/Excel se generan en el navegador, mismos gastos pendientes que se ven en pantalla) ───
    function buildGastosExportRows(): { headers: string[]; rows: (string | number)[][] } {
        const headers = ['Fecha', 'Descripción', 'Categoría', 'Patente', 'Monto', 'Recibió'];
        const rows = gastos.map((g) => [
            formatDate(g.fecha),
            g.descripcion?.trim() || 'Sin descripción',
            TIPO_LABEL[g.tipo],
            g.vehiculo?.patente ?? '—',
            g.monto,
            g.recibio,
        ]);
        return { headers, rows };
    }

    function exportGastosPdf() {
        const { headers, rows } = buildGastosExportRows();
        exportToPdf(`gastos-${today}.pdf`, 'Gastos', headers, rows);
    }

    function exportGastosExcel() {
        const { headers, rows } = buildGastosExportRows();
        exportToExcel(`gastos-${today}.xlsx`, headers, rows);
    }

    // Group gastos by category
    const gastosByCat = useMemo(() => {
        const map: Record<string, Gasto[]> = {
            galpon: [],
            taller: [],
            oficina: [],
            stock: [],
            kevin: [],
            flota: [],
        };
        for (const g of gastos) {
            if (g.tipo === 'vehiculo') map.flota.push(g);
            else if (map[g.tipo]) map[g.tipo].push(g);
        }
        return map;
    }, [gastos]);

    // Within flota, group by inversion (natural order)
    const flotaByInversion = useMemo(() => {
        const groups: Record<
            string,
            { inversion_id: number | null; inversion_nombre: string; gastos: Gasto[] }
        > = {};
        for (const g of gastosByCat.flota) {
            const id = g.vehiculo?.inversion_id ?? null;
            const nombre =
                g.vehiculo?.inversion_nombre ?? 'Sin inversión asignada';
            const key = id === null ? 'none' : String(id);
            if (!groups[key]) {
                groups[key] = {
                    inversion_id: id,
                    inversion_nombre: nombre,
                    gastos: [],
                };
            }
            groups[key].gastos.push(g);
        }
        return Object.values(groups).sort((a, b) =>
            a.inversion_nombre.localeCompare(b.inversion_nombre, 'es', {
                numeric: true,
                sensitivity: 'base',
            }),
        );
    }, [gastosByCat.flota]);

    const CATEGORIAS: {
        key: 'galpon' | 'taller' | 'oficina' | 'stock' | 'kevin' | 'flota';
        label: string;
        icon: React.ReactNode;
    }[] = [
        {
            key: 'galpon',
            label: 'Galpón',
            icon: <Building2 className="h-5 w-5 text-muted-foreground" />,
        },
        {
            key: 'taller',
            label: 'Taller',
            icon: <Wrench className="h-5 w-5 text-muted-foreground" />,
        },
        {
            key: 'oficina',
            label: 'Oficina',
            icon: <Building2 className="h-5 w-5 text-muted-foreground" />,
        },
        {
            key: 'stock',
            label: 'Stock',
            icon: <Box className="h-5 w-5 text-muted-foreground" />,
        },
        {
            key: 'kevin',
            label: 'Kevin',
            icon: <UserCircle2 className="h-5 w-5 text-muted-foreground" />,
        },
        {
            key: 'flota',
            label: 'Flota',
            icon: <Car className="h-5 w-5 text-muted-foreground" />,
        },
    ];

    function categoryAmount(list: Gasto[]): number {
        return list.reduce(
            (sum, g) =>
                sum + Number(isInversor ? g.mi_monto ?? 0 : g.monto),
            0,
        );
    }

    const comboOptions: ComboboxOption[] = useMemo(() => {
        const fijos: ComboboxOption[] = TIPOS_FIJOS.map((t) => ({
            value: t.value,
            label: t.label,
        }));
        const veh: ComboboxOption[] = patentes.map((p) => ({
            value: `vehiculo:${p.id}`,
            label: p.patente,
            sub: `${p.marca} ${p.modelo}`,
        }));
        return [...fijos, ...veh];
    }, [patentes]);

    function resetForm() {
        setFecha(today);
        setMonto('');
        setRecibio('');
        setMetodoPago('efectivo');
        setDescripcion('');
        setComboValue('');
        setErrors({});
    }

    function handleSubmit() {
        const newErrors: Record<string, string> = {};
        if (!fecha) newErrors.fecha = 'Requerido';
        if (!monto || Number(monto) <= 0) newErrors.monto = 'Monto inválido';
        if (!recibio.trim()) newErrors.recibio = 'Requerido';
        if (!comboValue) newErrors.tipo = 'Seleccioná un tipo o patente';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        let tipo: Tipo;
        let vehiculoId: number | null = null;
        if (comboValue.startsWith('tipo:')) {
            tipo = comboValue.slice(5) as Tipo;
        } else if (comboValue.startsWith('vehiculo:')) {
            tipo = 'vehiculo';
            vehiculoId = Number(comboValue.slice(9));
        } else {
            setErrors({ tipo: 'Selección inválida' });
            return;
        }

        setSubmitting(true);
        router.post(
            store.url(),
            {
                fecha,
                monto: Number(monto),
                recibio: recibio.trim(),
                metodo_pago: metodoPago,
                descripcion: descripcion.trim() || null,
                tipo,
                vehiculo_id: vehiculoId,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowModal(false);
                    resetForm();
                },
                onError: (errs) =>
                    setErrors(errs as Record<string, string>),
                onFinish: () => setSubmitting(false),
            },
        );
    }

    function handleDelete() {
        if (!confirmDeleteId) return;
        router.delete(destroy.url(confirmDeleteId), {
            preserveScroll: true,
            onFinish: () => setConfirmDeleteId(null),
        });
    }

    function renderGastoList(list: Gasto[]) {
        if (list.length === 0) return null;

        return (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                        <tr>
                            <th className="px-3 py-2 font-medium">Fecha</th>
                            <th className="px-3 py-2 font-medium">
                                Descripción
                            </th>
                            <th className="px-3 py-2 font-medium">Patente</th>
                            <th className="px-3 py-2 font-medium">Inversión</th>
                            <th className="px-3 py-2 font-medium">Método</th>
                            <th className="px-3 py-2 text-right font-medium">
                                Monto
                            </th>
                            {canManage && (
                                <th className="w-10 px-3 py-2"></th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {list.map((g) => {
                            const descripcion =
                                g.descripcion?.trim() || 'Sin descripción';
                            return (
                                <tr
                                    key={g.id}
                                    className="hover:bg-muted/20"
                                >
                                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                                        {formatDateDia(g.fecha)}
                                    </td>
                                    <td className="px-3 py-2 font-medium text-foreground">
                                        {descripcion}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                                        {g.vehiculo?.patente ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                                        {g.vehiculo?.inversion_nombre ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-foreground capitalize">
                                        {g.metodo_pago}
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-bold text-foreground">
                                                {formatARS(
                                                    isInversor
                                                        ? Number(g.mi_monto)
                                                        : Number(g.monto),
                                                )}
                                            </span>
                                            {isInversor && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    (total{' '}
                                                    {formatARS(
                                                        Number(g.monto),
                                                    )}
                                                    )
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    {canManage && (
                                        <td className="px-2 py-2 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setConfirmDeleteId(g.id)
                                                }
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                aria-label="Eliminar gasto"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <>
            <Head title="Gastos" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Gastos
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {isInversor
                                ? 'Gastos asignados a tu cuenta'
                                : 'Registro de gastos y distribución entre inversores'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Caja chica: chip discreto, el detalle vive en el popover al pasar el mouse */}
                        <Popover open={showCajaPopover} onOpenChange={setShowCajaPopover}>
                            <PopoverTrigger asChild onMouseEnter={openCajaNow} onMouseLeave={scheduleCloseCaja}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCajaPopover(false);
                                        setShowCajaHistorial(true);
                                    }}
                                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-sm transition-colors hover:bg-muted/40"
                                >
                                    <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase underline decoration-dotted underline-offset-2">
                                        Caja chica
                                    </span>
                                    <span
                                        className={`text-sm font-bold tabular-nums ${
                                            cajaChica.saldo < 0 ? 'text-destructive' : 'text-foreground'
                                        }`}
                                    >
                                        {formatARS(Number(cajaChica.saldo))}
                                    </span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="end"
                                sideOffset={6}
                                className="w-64 p-1"
                                onMouseEnter={openCajaNow}
                                onMouseLeave={scheduleCloseCaja}
                            >
                                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                    {cajaChica.periodo_abierto
                                        ? 'Caja chica del período'
                                        : 'Sin período de caja abierto'}
                                </p>

                                {cajaChica.periodo_abierto ? (
                                    <>
                                        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                                            <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-500" />
                                            <span className="flex-1 text-left text-foreground">Cargado</span>
                                            <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                                                {formatARS(Number(cajaChica.ingresos))}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                                            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="flex-1 text-left text-foreground">Salidas</span>
                                            <span className="font-semibold text-foreground tabular-nums">
                                                {formatARS(Number(cajaChica.egresos))}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 border-t border-border px-2 pt-2 pb-1.5 text-sm">
                                            <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="flex-1 text-left text-foreground">Saldo</span>
                                            <span
                                                className={`font-semibold tabular-nums ${
                                                    cajaChica.saldo < 0 ? 'text-destructive' : 'text-foreground'
                                                }`}
                                            >
                                                {formatARS(Number(cajaChica.saldo))}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="px-2 pb-2 text-xs text-muted-foreground">
                                        La caja se abre junto con el período de caja, desde Cobros.
                                    </p>
                                )}

                                <div className="flex items-center gap-1 border-t border-border pt-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 flex-1 justify-start px-2 text-xs"
                                        onClick={() => {
                                            setShowCajaPopover(false);
                                            setShowCajaHistorial(true);
                                        }}
                                    >
                                        <History className="mr-1.5 h-3.5 w-3.5" />
                                        Historial
                                    </Button>
                                    {canManage && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 flex-1 justify-start px-2 text-xs"
                                            disabled={!cajaChica.periodo_abierto}
                                            onClick={() => {
                                                setShowCajaPopover(false);
                                                resetCajaForm();
                                                setShowCajaModal(true);
                                            }}
                                        >
                                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                                            Cargar
                                        </Button>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <ExportDropdown
                            onExportPdf={exportGastosPdf}
                            onExportExcel={exportGastosExcel}
                            disabled={gastos.length === 0}
                        />
                        {canManage && (
                            <Button
                                size="sm"
                                onClick={() => {
                                    resetForm();
                                    setShowModal(true);
                                }}
                            >
                                <Plus className="mr-1.5 h-4 w-4" />
                                Nuevo gasto
                            </Button>
                        )}
                    </div>
                </div>

                {/* ─── Sección 1: cards de totales ───────────────────────── */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {cards.map((card) => {
                        const isGeneral = card.key === 'general';
                        return (
                            <div
                                key={card.key}
                                className={`rounded-xl border p-4 shadow-sm ${
                                    isGeneral
                                        ? 'border-primary/40 bg-primary/5'
                                        : 'border-border bg-card'
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                        {cardIcon(card.key)}
                                    </div>
                                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                        {card.label}
                                    </p>
                                </div>
                                <p className="mt-2 text-xl font-bold text-foreground">
                                    {formatARS(Number(card.total))}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* ─── Sección 2: últimos gastos globales (10 + ver todos) ─── */}
                <div className="rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">
                            Últimos gastos
                        </h3>
                    </div>
                    {ultimosGlobales.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                            No hay gastos registrados.
                        </p>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">Fecha</th>
                                            <th className="px-3 py-2 font-medium">Descripción</th>
                                            <th className="px-3 py-2 font-medium">Categoría</th>
                                            <th className="px-3 py-2 font-medium">Patente</th>
                                            <th className="px-3 py-2 text-right font-medium">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(mostrarTodosUltimos ? gastos : ultimosGlobales).map((g) => (
                                            <tr key={g.id} className="hover:bg-muted/20">
                                                <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                                                    {formatDate(g.fecha)}
                                                </td>
                                                <td className="px-3 py-2 font-medium text-foreground">
                                                    {g.descripcion?.trim() || 'Sin descripción'}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-foreground">
                                                    {TIPO_LABEL[g.tipo]}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-foreground">
                                                    {g.vehiculo?.patente ?? '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold whitespace-nowrap text-foreground">
                                                    {formatARS(Number(g.monto))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {gastos.length > ultimosGlobales.length && (
                                <div className="border-t border-border px-4 py-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setMostrarTodosUltimos((v) => !v)}
                                        className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        {mostrarTodosUltimos
                                            ? 'Mostrar menos'
                                            : `Mostrar más (${gastos.length - ultimosGlobales.length})`}
                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mostrarTodosUltimos ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ─── Sección 3: desglose detallado por categoría ───────── */}
                {gastos.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
                        <HandCoins className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            No hay gastos registrados.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {CATEGORIAS.map((cat) => {
                            const catGastos = gastosByCat[cat.key];
                            const catOpen = expandedCats.has(cat.key);
                            const catTotal = categoryAmount(catGastos);
                            return (
                                <div
                                    key={cat.key}
                                    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleCat(cat.key)}
                                        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            {catOpen ? (
                                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            )}
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                {cat.icon}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-foreground">
                                                    {cat.label}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {catGastos.length} gasto
                                                    {catGastos.length !== 1
                                                        ? 's'
                                                        : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-base font-bold text-foreground">
                                            {formatARS(catTotal)}
                                        </span>
                                    </button>

                                    {catOpen && (
                                        <div className="border-t border-border bg-muted/10 p-2">
                                            {!isInversor &&
                                                TIPOS_POR_EMPRESA.includes(cat.key) &&
                                                catGastos.length > 0 &&
                                                (() => {
                                                    const bd = empresasBreakdown(catGastos);
                                                    if (bd.length === 0) return null;
                                                    return (
                                                        <div className="mb-2 rounded-lg border border-border bg-card p-3">
                                                            <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                                                Reparto por empresa (según autos alquilados)
                                                            </p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {bd.map((e) => (
                                                                    <div
                                                                        key={e.empresa_id}
                                                                        className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1"
                                                                    >
                                                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                                        <span className="text-xs font-medium text-foreground">
                                                                            {e.nombre}
                                                                        </span>
                                                                        <span className="text-xs font-bold tabular-nums text-foreground">
                                                                            {formatARS(e.total)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            {catGastos.length === 0 ? (
                                                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                                                    Sin gastos en esta
                                                    categoría.
                                                </p>
                                            ) : cat.key === 'flota' ? (
                                                <div className="space-y-2">
                                                    {flotaByInversion.map(
                                                        (inv) => {
                                                            const invKey = `inv-${inv.inversion_id ?? 'none'}`;
                                                            const invOpen =
                                                                expandedInversiones.has(
                                                                    invKey,
                                                                );
                                                            const invTotal =
                                                                categoryAmount(
                                                                    inv.gastos,
                                                                );
                                                            return (
                                                                <div
                                                                    key={invKey}
                                                                    className="overflow-hidden rounded-lg border border-border bg-card"
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            toggleInv(
                                                                                invKey,
                                                                            )
                                                                        }
                                                                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                                                                    >
                                                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                            {invOpen ? (
                                                                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                                            ) : (
                                                                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                                            )}
                                                                            <span className="truncate text-sm font-medium text-foreground">
                                                                                {
                                                                                    inv.inversion_nombre
                                                                                }
                                                                            </span>
                                                                            <span className="shrink-0 text-[10px] text-muted-foreground">
                                                                                ·{' '}
                                                                                {
                                                                                    inv
                                                                                        .gastos
                                                                                        .length
                                                                                }{' '}
                                                                                gasto
                                                                                {inv
                                                                                    .gastos
                                                                                    .length !==
                                                                                1
                                                                                    ? 's'
                                                                                    : ''}
                                                                            </span>
                                                                        </div>
                                                                        <span className="shrink-0 text-sm font-semibold text-foreground">
                                                                            {formatARS(
                                                                                invTotal,
                                                                            )}
                                                                        </span>
                                                                    </button>

                                                                    {invOpen && (
                                                                        <div className="border-t border-border bg-background p-2">
                                                                            {renderGastoList(
                                                                                inv.gastos,
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            ) : (
                                                renderGastoList(catGastos)
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── Modal Nuevo Gasto ─────────────────────────────────────── */}
            <Dialog
                open={showModal}
                onOpenChange={(open) => {
                    setShowModal(open);
                    if (!open) resetForm();
                }}
            >
                <DialogContent
                    className="gap-0 overflow-hidden p-0 sm:max-w-lg"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                            <HandCoins className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Registrar gasto</DialogTitle>
                            <DialogDescription className="text-xs">
                                Completá los datos del gasto. La distribución entre inversores se calcula automáticamente.
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-5">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="g-tipo">Tipo / Patente</Label>
                            <Combobox
                                id="g-tipo"
                                placeholder="Galpón, Taller, ... o patente"
                                options={comboOptions}
                                value={comboValue}
                                onSelect={(opt) => setComboValue(opt.value)}
                                uppercase
                            />
                            {errors.tipo && (
                                <p className="text-xs text-destructive">
                                    {errors.tipo}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="g-fecha">Fecha</Label>
                                <Input
                                    id="g-fecha"
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                />
                                {errors.fecha && (
                                    <p className="text-xs text-destructive">
                                        {errors.fecha}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="g-monto">Monto</Label>
                                <MoneyInput
                                    id="g-monto"
                                    value={monto === '' ? null : Number(monto)}
                                    onValueChange={(n) => setMonto(n == null ? '' : String(n))}
                                    placeholder="0,00"
                                />
                                {errors.monto && (
                                    <p className="text-xs text-destructive">
                                        {errors.monto}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="g-recibio">Recibió</Label>
                            <Input
                                id="g-recibio"
                                value={recibio}
                                onChange={(e) => setRecibio(e.target.value)}
                                placeholder="Nombre de quien recibió el pago"
                            />
                            {errors.recibio && (
                                <p className="text-xs text-destructive">
                                    {errors.recibio}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="g-metodo">Método de pago</Label>
                            <Select
                                value={metodoPago}
                                onValueChange={(v) =>
                                    setMetodoPago(v as MetodoPago)
                                }
                            >
                                <SelectTrigger id="g-metodo">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="efectivo">
                                        Efectivo
                                    </SelectItem>
                                    <SelectItem value="transferencia">
                                        Transferencia
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="g-descripcion">
                                Descripción (opcional)
                            </Label>
                            <textarea
                                id="g-descripcion"
                                value={descripcion}
                                onChange={(e) =>
                                    setDescripcion(e.target.value)
                                }
                                rows={3}
                                className="flex w-full rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none"
                                placeholder="Detalle del gasto..."
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Registrar gasto'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Cargar / ajustar caja chica ───────────────────────────── */}
            <Dialog
                open={showCajaModal}
                onOpenChange={(open) => {
                    setShowCajaModal(open);
                    if (!open) resetCajaForm();
                }}
            >
                <DialogContent
                    className="gap-0 overflow-hidden p-0 sm:max-w-md"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                            <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Movimiento de caja chica</DialogTitle>
                            <DialogDescription className="text-xs">
                                El saldo se recalcula sumando los movimientos: nada se edita ni se borra.
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 px-5 py-5">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="cc-tipo">Tipo</Label>
                            <Select
                                value={cajaTipo}
                                onValueChange={(v) => setCajaTipo(v as CajaTipoManual)}
                            >
                                <SelectTrigger id="cc-tipo">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CAJA_TIPOS.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {CAJA_TIPOS.find((t) => t.value === cajaTipo)?.hint}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cc-fecha">Fecha</Label>
                                <Input
                                    id="cc-fecha"
                                    type="date"
                                    value={cajaFecha}
                                    onChange={(e) => setCajaFecha(e.target.value)}
                                />
                                {cajaErrors.fecha && (
                                    <p className="text-xs text-destructive">{cajaErrors.fecha}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cc-monto">Monto</Label>
                                <MoneyInput
                                    id="cc-monto"
                                    value={cajaMonto === '' ? null : Number(cajaMonto)}
                                    onValueChange={(n) => setCajaMonto(n == null ? '' : String(n))}
                                    placeholder="0,00"
                                />
                                {cajaErrors.monto && (
                                    <p className="text-xs text-destructive">{cajaErrors.monto}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="cc-nota">
                                Nota {cajaTipo === 'ajuste' ? '' : '(opcional)'}
                            </Label>
                            <Input
                                id="cc-nota"
                                value={cajaNota}
                                onChange={(e) => setCajaNota(e.target.value)}
                                placeholder="Detalle del movimiento..."
                            />
                            {cajaErrors.nota && (
                                <p className="text-xs text-destructive">{cajaErrors.nota}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button type="button" variant="outline" onClick={() => setShowCajaModal(false)} disabled={cajaSubmitting}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleCajaSubmit} disabled={cajaSubmitting}>
                            {cajaSubmitting ? 'Guardando...' : 'Registrar movimiento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Historial de caja chica ───────────────────────────────── */}
            <Dialog open={showCajaHistorial} onOpenChange={setShowCajaHistorial}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                            <History className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Historial de caja chica</DialogTitle>
                            <DialogDescription className="text-xs">
                                Movimientos del período abierto. Saldo {formatARS(Number(cajaChica.saldo))}; un descuento de gasto se deshace eliminando el gasto.
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        {cajaChica.movimientos.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                                Todavía no hay movimientos en la caja.
                            </p>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-muted/40 text-[10px] tracking-wider text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Fecha</th>
                                        <th className="px-3 py-2 font-medium">Tipo</th>
                                        <th className="px-3 py-2 font-medium">Detalle</th>
                                        <th className="px-3 py-2 font-medium">Registró</th>
                                        <th className="px-3 py-2 text-right font-medium">Monto</th>
                                        {canManage && <th className="w-10 px-3 py-2"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {cajaChica.movimientos.map((m) => (
                                        <tr key={m.id} className="hover:bg-muted/20">
                                            <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                                                {formatDate(m.fecha)}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-foreground">
                                                {m.tipo_label}
                                            </td>
                                            <td className="px-3 py-2 text-foreground">
                                                {m.nota ?? '—'}
                                                {m.revertido && (
                                                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                                                        (revertido)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                                {m.registrado_por ?? '—'}
                                            </td>
                                            <td
                                                className={`px-3 py-2 text-right font-bold whitespace-nowrap ${
                                                    m.monto < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                                                }`}
                                            >
                                                {formatARS(Number(m.monto))}
                                            </td>
                                            {canManage && (
                                                <td className="px-2 py-2 text-right">
                                                    {/* Sólo movimientos manuales vivos: el descuento de un
                                                        gasto se deshace borrando el gasto. */}
                                                    {m.gasto_id === null &&
                                                        !m.es_contraasiento &&
                                                        !m.revertido && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleCajaRevertir(m.id)}
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                aria-label="Revertir movimiento"
                                                            >
                                                                <Undo2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button variant="outline" onClick={() => setShowCajaHistorial(false)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Confirmar eliminación ─────────────────────────────────── */}
            <Dialog
                open={confirmDeleteId !== null}
                onOpenChange={(open) => {
                    if (!open) setConfirmDeleteId(null);
                }}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
                    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                            <Trash2 className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-base font-semibold">Eliminar gasto</DialogTitle>
                            <DialogDescription className="text-xs">
                                Esta acción no se puede deshacer: también elimina la distribución asignada a los inversores y devuelve el monto a la caja chica.
                            </DialogDescription>
                        </div>
                    </div>
                    <DialogFooter className="flex-row items-center border-t border-border px-5 py-4">
                        <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

GastosIndex.layout = {
    breadcrumbs: [
        {
            title: 'Gastos',
            href: index.url(),
        },
    ],
};
