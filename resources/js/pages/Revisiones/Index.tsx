import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    ClipboardCheck,
    Search,
    UserCheck,
    X,
} from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Revision, Vehiculo } from '@/types';

interface VehiculoRow {
    vehiculo: Vehiculo;
    revision_semanal: Revision | null;
    ultimo_kilometraje: number | null;
}

interface Props {
    vehiculos: VehiculoRow[];
    semana_inicio: string;
}

const MESES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const STEPS = ['Documentación', 'Estado', 'Mecánica', 'Equipamiento', 'Finalización'];

function formatMonthYear(dateStr?: string | null): string {
    if (!dateStr) return 'N/A';
    const part = dateStr.split('T')[0].split(' ')[0];
    const [y, m] = part.split('-');
    return `${m}/${y}`;
}

function MonthYearPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
    const [yp, mp] = value ? value.split('-') : ['', ''];
    const cy = new Date().getFullYear();
    const years = Array.from({ length: 12 }, (_, i) => cy - 1 + i);

    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <div className="flex gap-2">
                <Select value={mp} onValueChange={(m) => onChange(`${yp || cy}-${m}`)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Mes" /></SelectTrigger>
                    <SelectContent>
                        {MESES.map((n, i) => (
                            <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{n}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={yp} onValueChange={(y) => onChange(`${y}-${mp || '01'}`)}>
                    <SelectTrigger className="w-[110px]"><SelectValue placeholder="Año" /></SelectTrigger>
                    <SelectContent>
                        {years.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {value && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => onChange('')}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-all',
                selected
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
        >
            {children}
        </button>
    );
}

function ToggleSwitch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
    return (
        <label htmlFor={id} className="flex cursor-pointer items-center justify-between rounded-md border border-border px-4 py-3">
            <span className="text-sm font-medium">{label}</span>
            <button
                type="button"
                id={id}
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                    checked ? 'bg-primary' : 'bg-input',
                )}
            >
                <span className={cn(
                    'inline-block h-4 w-4 rounded-full bg-background transition-transform',
                    checked ? 'translate-x-6' : 'translate-x-1',
                )} />
            </button>
        </label>
    );
}

export default function Revisiones({ vehiculos, semana_inicio }: Props) {
    const [wizardOpen, setWizardOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<VehiculoRow | null>(null);
    const [step, setStep] = useState(0);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'revisado' | 'pendiente'>('all');

    const form = useForm({
        fecha_vencimiento_vtv: '',
        fecha_vencimiento_gnc: '',
        limpieza: '' as 'mala' | 'buena' | '',
        nivel_nafta: '' as 'bajo' | 'optimo' | '',
        kilometraje: '',
        rueda_auxiliar: false,
        kit_seguridad: false,
        sticker: false,
        observaciones: '',
    });

    function preloadDate(dateStr?: string | null): string {
        if (!dateStr) return '';
        return dateStr.split('T')[0].split(' ')[0].slice(0, 7);
    }

    function openWizard(row: VehiculoRow) {
        setSelectedRow(row);
        setStep(0);
        form.reset();
        form.setData({
            fecha_vencimiento_vtv: preloadDate(row.vehiculo.fecha_vencimiento_vtv),
            fecha_vencimiento_gnc: preloadDate(row.vehiculo.fecha_vencimiento_gnc),
            limpieza: '' as 'mala' | 'buena' | '',
            nivel_nafta: '' as 'bajo' | 'optimo' | '',
            kilometraje: row.ultimo_kilometraje ? String(row.ultimo_kilometraje) : '',
            rueda_auxiliar: false,
            kit_seguridad: false,
            sticker: false,
            observaciones: '',
        });
        setWizardOpen(true);
    }

    function openDetail(row: VehiculoRow) {
        setSelectedRow(row);
        setDetailOpen(true);
    }

    function canAdvance(): boolean {
        if (step === 1) return form.data.limpieza !== '' && form.data.nivel_nafta !== '';
        if (step === 2) return form.data.kilometraje !== '' && Number(form.data.kilometraje) >= 0;
        return true;
    }

    function handleSubmit() {
        if (!selectedRow) return;
        form.post(`/revisiones/${selectedRow.vehiculo.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setWizardOpen(false);
                setStep(0);
            },
        });
    }

    const filtered = vehiculos.filter((r) => {
        const matchesSearch = !search || 
            r.vehiculo.patente.toLowerCase().includes(search.toLowerCase()) ||
            r.vehiculo.marca.toLowerCase().includes(search.toLowerCase()) ||
            r.vehiculo.modelo.toLowerCase().includes(search.toLowerCase());
            
        const matchesStatus = filterStatus === 'all' || 
            (filterStatus === 'revisado' && r.revision_semanal) || 
            (filterStatus === 'pendiente' && !r.revision_semanal);
            
        return matchesSearch && matchesStatus;
    });

    const revisadosCount = vehiculos.filter(v => v.revision_semanal).length;
    const pendientesCount = vehiculos.length - revisadosCount;

    return (
        <>
            <Head title="Revisiones Semanales" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                            Revisiones Semanales
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                Semana del {new Date(semana_inicio + 'T00:00:00').toLocaleDateString('es-AR')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            {revisadosCount} revisados
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            {pendientesCount} pendientes
                        </span>
                    </div>
                </div>

                {/* Filtros */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex w-full flex-col gap-2 lg:min-w-[240px] lg:flex-1">
                            <Label htmlFor="search">Buscar</Label>
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="search"
                                    type="text"
                                    placeholder="Patente, marca o modelo..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="flex w-full flex-col gap-2 lg:w-auto">
                            <Label>Estado de revisión</Label>
                            <div className="flex h-9 gap-1.5">
                                {(
                                    [
                                        { val: 'all', label: 'Todos', icon: ClipboardCheck },
                                        { val: 'revisado', label: 'Revisados', icon: CheckCircle2 },
                                        { val: 'pendiente', label: 'Pendientes', icon: AlertCircle },
                                    ] as const
                                ).map(({ val, label, icon: Icon }) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setFilterStatus(val)}
                                        className={cn(
                                            'flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] lg:flex-none',
                                            filterStatus === val
                                                ? val === 'revisado'
                                                    ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                                                    : val === 'pendiente'
                                                      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                                                      : 'border-primary/30 bg-primary/10 text-primary'
                                                : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex w-full items-center justify-end lg:w-auto">
                            <button
                                type="button"
                                onClick={() => { setSearch(''); setFilterStatus('all'); }}
                                disabled={!search && filterStatus === 'all'}
                                title="Limpiar filtros"
                                className={cn(
                                    'flex h-9 w-full items-center justify-center gap-2 rounded-lg border transition-all duration-150 lg:w-9 lg:px-0',
                                    search || filterStatus !== 'all'
                                        ? 'border-border text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97]'
                                        : 'cursor-not-allowed border-border/40 text-muted-foreground/30',
                                )}
                            >
                                <X className="h-4 w-4" />
                                <span className="text-xs lg:hidden">Limpiar filtros</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grid de Cards Clickables */}
                {filtered.length === 0 ? (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-transparent py-16 text-muted-foreground">
                        No hay vehículos que coincidan con los filtros.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filtered.map((row) => (
                            <div
                                key={row.vehiculo.id}
                                onClick={() => row.revision_semanal ? openDetail(row) : openWizard(row)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        row.revision_semanal ? openDetail(row) : openWizard(row);
                                    }
                                }}
                                className={cn(
                                    "flex cursor-pointer flex-col justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                    row.revision_semanal 
                                        ? "border-green-500/30 hover:border-green-500/60 dark:border-green-900/30" 
                                        : "border-red-500/30 hover:border-red-500/60 dark:border-red-900/30"
                                )}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex flex-col">
                                        <h3 className="font-mono text-lg font-bold text-foreground leading-none">{row.vehiculo.patente}</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">{row.vehiculo.marca} {row.vehiculo.modelo}</p>
                                    </div>
                                    {row.revision_semanal ? (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Revisado
                                        </span>
                                    ) : (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            Pendiente
                                        </span>
                                    )}
                                </div>
                                
                                {row.revision_semanal ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <span className="rounded-md border border-border bg-muted/50 px-2 py-1 font-medium">
                                                Km: {row.revision_semanal.kilometraje.toLocaleString('es-AR')}
                                            </span>
                                            <span className="rounded-md border border-border bg-muted/50 px-2 py-1 capitalize font-medium">
                                                Nafta {row.revision_semanal.nivel_nafta}
                                            </span>
                                            {row.revision_semanal.observaciones && (
                                                <span className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                    Obs
                                                </span>
                                            )}
                                        </div>
                                        {row.revision_semanal.revisor && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <UserCheck className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                                                <span className="truncate">
                                                    Revisado por <span className="font-medium text-foreground">{row.revision_semanal.revisor.name}</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground mt-2">
                                        Haga clic para iniciar la revisión
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Wizard Dialog */}
            <Dialog open={wizardOpen} onOpenChange={(o) => !o && setWizardOpen(false)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Revisión — {selectedRow?.vehiculo.patente}</DialogTitle>
                        <DialogDescription>
                            Paso {step + 1} de {STEPS.length}: {STEPS[step]}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Progress bar */}
                    <div className="flex gap-1">
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    'h-1.5 flex-1 rounded-full transition-colors',
                                    i <= step ? 'bg-primary' : 'bg-muted',
                                )}
                            />
                        ))}
                    </div>

                    <div className="space-y-4 py-2">
                        {step === 0 && (
                            <div className="space-y-4">
                                <MonthYearPicker
                                    label="Vencimiento VTV"
                                    value={form.data.fecha_vencimiento_vtv}
                                    onChange={(v) => form.setData('fecha_vencimiento_vtv', v)}
                                />
                                <InputError message={form.errors.fecha_vencimiento_vtv} />
                                <MonthYearPicker
                                    label="Vencimiento GNC"
                                    value={form.data.fecha_vencimiento_gnc}
                                    onChange={(v) => form.setData('fecha_vencimiento_gnc', v)}
                                />
                                <InputError message={form.errors.fecha_vencimiento_gnc} />
                            </div>
                        )}

                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nivel de Limpieza</Label>
                                    <div className="flex gap-3">
                                        <OptionButton selected={form.data.limpieza === 'mala'} onClick={() => form.setData('limpieza', 'mala')}>
                                            Mala
                                        </OptionButton>
                                        <OptionButton selected={form.data.limpieza === 'buena'} onClick={() => form.setData('limpieza', 'buena')}>
                                            Buena
                                        </OptionButton>
                                    </div>
                                    <InputError message={form.errors.limpieza} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nivel de Nafta</Label>
                                    <div className="flex gap-3">
                                        <OptionButton selected={form.data.nivel_nafta === 'bajo'} onClick={() => form.setData('nivel_nafta', 'bajo')}>
                                            Bajo
                                        </OptionButton>
                                        <OptionButton selected={form.data.nivel_nafta === 'optimo'} onClick={() => form.setData('nivel_nafta', 'optimo')}>
                                            Óptimo
                                        </OptionButton>
                                    </div>
                                    <InputError message={form.errors.nivel_nafta} />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-2">
                                <Label htmlFor="kilometraje">Kilometraje actual</Label>
                                <Input
                                    id="kilometraje"
                                    type="number"
                                    min={0}
                                    placeholder="Ej. 45000"
                                    value={form.data.kilometraje}
                                    onChange={(e) => form.setData('kilometraje', e.target.value)}
                                />
                                {selectedRow?.ultimo_kilometraje != null && (
                                    <p className="text-xs text-muted-foreground">
                                        Último registro: {selectedRow.ultimo_kilometraje.toLocaleString('es-AR')} km
                                    </p>
                                )}
                                <InputError message={form.errors.kilometraje} />
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-3">
                                <ToggleSwitch
                                    id="rueda_auxiliar"
                                    label="¿Posee rueda auxiliar?"
                                    checked={form.data.rueda_auxiliar}
                                    onChange={(v) => form.setData('rueda_auxiliar', v)}
                                />
                                <ToggleSwitch
                                    id="kit_seguridad"
                                    label="¿Posee kit de seguridad?"
                                    checked={form.data.kit_seguridad}
                                    onChange={(v) => form.setData('kit_seguridad', v)}
                                />
                                <ToggleSwitch
                                    id="sticker"
                                    label="¿Posee sticker?"
                                    checked={form.data.sticker}
                                    onChange={(v) => form.setData('sticker', v)}
                                />
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-2">
                                <Label htmlFor="observaciones">Observaciones (Opcional)</Label>
                                <textarea
                                    id="observaciones"
                                    rows={4}
                                    placeholder="Escriba cualquier observación..."
                                    value={form.data.observaciones}
                                    onChange={(e) => form.setData('observaciones', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                <InputError message={form.errors.observaciones} />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={step === 0}
                            onClick={() => setStep((s) => s - 1)}
                        >
                            <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
                        </Button>

                        {step < STEPS.length - 1 ? (
                            <Button
                                type="button"
                                size="sm"
                                disabled={!canAdvance()}
                                onClick={() => setStep((s) => s + 1)}
                            >
                                Siguiente <ArrowRight className="ml-1 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                disabled={form.processing}
                                onClick={handleSubmit}
                            >
                                {form.processing ? 'Guardando...' : 'Guardar Revisión'}
                                {!form.processing && <Check className="ml-1 h-4 w-4" />}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={(o) => !o && setDetailOpen(false)}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Detalle — {selectedRow?.vehiculo.patente}</DialogTitle>
                        <DialogDescription>
                            {selectedRow?.vehiculo.marca} {selectedRow?.vehiculo.modelo}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedRow?.revision_semanal && (
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">VTV</span>
                                    <p className="font-medium">{formatMonthYear(selectedRow.revision_semanal.fecha_vencimiento_vtv)}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">GNC</span>
                                    <p className="font-medium">{formatMonthYear(selectedRow.revision_semanal.fecha_vencimiento_gnc)}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Limpieza</span>
                                    <p className="font-medium capitalize">{selectedRow.revision_semanal.limpieza}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Nafta</span>
                                    <p className="font-medium capitalize">{selectedRow.revision_semanal.nivel_nafta}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Kilometraje</span>
                                    <p className="font-medium">{selectedRow.revision_semanal.kilometraje.toLocaleString('es-AR')} km</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Rueda aux.</span>
                                    <p className="font-medium">{selectedRow.revision_semanal.rueda_auxiliar ? 'Sí' : 'No'}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Kit seguridad</span>
                                    <p className="font-medium">{selectedRow.revision_semanal.kit_seguridad ? 'Sí' : 'No'}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Sticker</span>
                                    <p className="font-medium">{selectedRow.revision_semanal.sticker ? 'Sí' : 'No'}</p>
                                </div>
                            </div>
                            {selectedRow.revision_semanal.observaciones && (
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Observaciones</span>
                                    <p className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                                        {selectedRow.revision_semanal.observaciones}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

Revisiones.layout = {
    breadcrumbs: [{ title: 'Revisiones', href: '/revisiones' }],
};
