import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    ChevronDown,
    Plus,
    Search,
    Trash2,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import { Combobox  } from '@/components/ui/combobox';
import type {ComboboxOption} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Persona {
    id: number;
    name: string;
    dni: string | null;
}

interface Socio {
    user: Persona;
    es_financiador: boolean;
    deuda: number;
    es_deudor: boolean;
}

interface InversionData {
    id: number;
    nombre: string;
    empresa: { id: number; nombre: string } | null;
    autos: number;
    completa: boolean;
    socios: Socio[];
}

interface Props {
    inversiones: InversionData[];
    candidatos: Persona[];
    maxInversores: number;
    cotizacionDolar: number;
}

type Rol = 'normal' | 'financiador' | 'deudor';

interface SocioRow {
    user: Persona;
    rol: Rol;
    deuda: string;
}

function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? '')
        .join('');
}

const formatNum = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
}).format;

function rolDeSocio(s: Socio): Rol {
    if (s.es_financiador) {
return 'financiador';
}

    if (s.es_deudor || s.deuda > 0) {
return 'deudor';
}

    return 'normal';
}

export default function UsersInversiones({
    inversiones,
    candidatos,
    maxInversores,
    cotizacionDolar,
}: Props) {
    const tasa = cotizacionDolar > 0 ? cotizacionDolar : null;
    const [busqueda, setBusqueda] = useState('');

    const porEmpresa = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        const filtradas = q
            ? inversiones.filter((i) => i.nombre.toLowerCase().includes(q))
            : inversiones;

        const map = new Map<string, InversionData[]>();

        for (const inv of filtradas) {
            const emp = inv.empresa?.nombre ?? 'Sin empresa';

            if (!map.has(emp)) {
map.set(emp, []);
}

            map.get(emp)!.push(inv);
        }

        return Array.from(map.entries());
    }, [inversiones, busqueda]);

    return (
        <>
            <Head title="Configurar inversores" />

            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-4 sm:p-6">
                {/* Header */}
                <div className="flex flex-col gap-3">
                    <Link
                        href="/users?role=inversor"
                        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Volver a Personal
                    </Link>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                            Configurar inversores
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Abrí una inversión y asigná sus inversores, su rol y
                            su deuda en dólares.
                        </p>
                    </div>

                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar inversión…"
                            className="pl-9"
                        />
                    </div>
                </div>

                {porEmpresa.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                        No se encontraron inversiones.
                    </div>
                ) : (
                    porEmpresa.map(([empresa, invs]) => (
                        <section key={empresa} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                    {empresa}
                                </h2>
                            </div>
                            <div className="flex flex-col gap-2">
                                {invs.map((inv) => (
                                    <InversionPanel
                                        key={inv.id}
                                        inversion={inv}
                                        candidatos={candidatos}
                                        maxInversores={maxInversores}
                                        tasa={tasa}
                                    />
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </>
    );
}

const ROLES: { key: Rol; label: string; active: string }[] = [
    {
        key: 'normal',
        label: 'Al día',
        active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    },
    {
        key: 'financiador',
        label: 'Financiador',
        active: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
    },
    {
        key: 'deudor',
        label: 'Deudor',
        active: 'bg-red-500/15 text-red-700 dark:text-red-400',
    },
];

function InversionPanel({
    inversion,
    candidatos,
    maxInversores,
    tasa,
}: {
    inversion: InversionData;
    candidatos: Persona[];
    maxInversores: number;
    tasa: number | null;
}) {
    const [abierto, setAbierto] = useState(false);
    const [socios, setSocios] = useState<SocioRow[]>(() =>
        inversion.socios.map((s) => ({
            user: s.user,
            rol: rolDeSocio(s),
            deuda: String(s.deuda),
        })),
    );
    const [dirty, setDirty] = useState(false);
    const [processing, setProcessing] = useState(false);

    function mutar(next: SocioRow[]) {
        setSocios(next);
        setDirty(true);
    }

    function setRol(userId: number, rol: Rol) {
        mutar(
            socios.map((s) =>
                s.user.id === userId
                    ? { ...s, rol, deuda: rol === 'deudor' ? s.deuda : '0' }
                    : s,
            ),
        );
    }

    function setDeuda(userId: number, v: string) {
        mutar(
            socios.map((s) => (s.user.id === userId ? { ...s, deuda: v } : s)),
        );
    }

    function quitar(userId: number) {
        mutar(socios.filter((s) => s.user.id !== userId));
    }

    function agregar(userId: number) {
        const persona = candidatos.find((c) => c.id === userId);

        if (!persona || socios.some((s) => s.user.id === userId)) {
return;
}

        mutar([...socios, { user: persona, rol: 'normal', deuda: '0' }]);
    }

    const resumen = useMemo(
        () => ({
            financiador: socios.filter((s) => s.rol === 'financiador').length,
            deudor: socios.filter((s) => s.rol === 'deudor').length,
            deudaUsd: socios
                .filter((s) => s.rol === 'deudor' && inversion.completa)
                .reduce((sum, s) => sum + (Number(s.deuda) || 0), 0),
        }),
        [socios, inversion.completa],
    );

    const opcionesCandidatos: ComboboxOption[] = useMemo(
        () =>
            candidatos
                .filter((c) => !socios.some((s) => s.user.id === c.id))
                .map((c) => ({
                    value: String(c.id),
                    label: c.name,
                    sub: c.dni ?? undefined,
                })),
        [candidatos, socios],
    );

    function guardar() {
        setProcessing(true);
        router.put(
            `/inversiones/${inversion.id}/inversores`,
            {
                socios: socios.map((s) => ({
                    user_id: s.user.id,
                    es_financiador: s.rol === 'financiador',
                    deuda:
                        s.rol === 'deudor' && inversion.completa
                            ? Number(s.deuda) || 0
                            : 0,
                    es_deudor:
                        s.rol === 'deudor'
                            ? inversion.completa
                                ? Number(s.deuda) > 0
                                : true
                            : false,
                })),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setDirty(false),
                onFinish: () => setProcessing(false),
            },
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Encabezado clickeable */}
            <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
            >
                <ChevronDown
                    className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                        abierto && 'rotate-180',
                    )}
                />
                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                            {inversion.nombre}
                        </span>
                        <span
                            className={cn(
                                'rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                                inversion.completa
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                            )}
                            title={
                                inversion.completa
                                    ? 'Inversión completa'
                                    : 'Inversión incompleta: el deudor se marca sin monto'
                            }
                        >
                            {inversion.autos}/10
                        </span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {socios.length}/{maxInversores}
                        </span>
                        {resumen.financiador > 0 && (
                            <span className="text-violet-500 dark:text-violet-400">
                                {resumen.financiador} financiador
                                {resumen.financiador !== 1 ? 'es' : ''}
                            </span>
                        )}
                        {resumen.deudor > 0 && (
                            <span className="text-red-500 dark:text-red-400">
                                {resumen.deudor} deudor
                                {resumen.deudor !== 1 ? 'es' : ''}
                            </span>
                        )}
                        {resumen.deudaUsd > 0 && (
                            <span className="tabular-nums">
                                Deuda USD {formatNum(resumen.deudaUsd)}
                            </span>
                        )}
                    </span>
                </span>
                {dirty && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
            </button>

            {/* Cuerpo */}
            {abierto && (
                <div className="flex flex-col gap-2 border-t border-border p-3">
                    {socios.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-muted-foreground">
                            Todavía no hay inversores en esta inversión.
                        </p>
                    ) : (
                        <div className="flex flex-col divide-y divide-border/60">
                            {socios.map((s) => (
                                <SocioRow
                                    key={s.user.id}
                                    socio={s}
                                    completa={inversion.completa}
                                    tasa={tasa}
                                    onRol={(rol) => setRol(s.user.id, rol)}
                                    onDeuda={(v) => setDeuda(s.user.id, v)}
                                    onQuitar={() => quitar(s.user.id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Sumar inversor */}
                    {socios.length < maxInversores &&
                        opcionesCandidatos.length > 0 && (
                            <div className="flex items-center gap-2 pt-1">
                                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <Combobox
                                    className="flex-1"
                                    placeholder="Sumar inversor…"
                                    options={opcionesCandidatos}
                                    value=""
                                    emptyText="Sin inversores para sumar"
                                    onSelect={(opt) =>
                                        agregar(Number(opt.value))
                                    }
                                />
                            </div>
                        )}

                    {/* Guardar */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            size="sm"
                            onClick={guardar}
                            disabled={processing || !dirty}
                        >
                            {processing ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SocioRow({
    socio,
    completa,
    tasa,
    onRol,
    onDeuda,
    onQuitar,
}: {
    socio: SocioRow;
    completa: boolean;
    tasa: number | null;
    onRol: (rol: Rol) => void;
    onDeuda: (v: string) => void;
    onQuitar: () => void;
}) {
    const arsEquiv =
        tasa && socio.rol === 'deudor' && completa && Number(socio.deuda) > 0
            ? Number(socio.deuda) * tasa
            : null;

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            {/* Inversor */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    {initials(socio.user.name)}
                </span>
                <span className="truncate text-sm font-medium text-foreground">
                    {socio.user.name}
                </span>
            </div>

            {/* Rol */}
            <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-border">
                {ROLES.map((rol) => {
                    const activo = socio.rol === rol.key;

                    return (
                        <button
                            key={rol.key}
                            type="button"
                            onClick={() => onRol(rol.key)}
                            className={cn(
                                'border-l border-border px-2.5 py-1 text-xs font-medium transition-colors first:border-l-0',
                                activo
                                    ? rol.active
                                    : 'text-muted-foreground hover:bg-muted',
                            )}
                        >
                            {rol.label}
                        </button>
                    );
                })}
            </div>

            {/* Deuda (solo deudor) */}
            {socio.rol === 'deudor' &&
                (completa ? (
                    <div className="flex shrink-0 flex-col items-end">
                        <MoneyInput
                            value={
                                socio.deuda === '' ? null : Number(socio.deuda)
                            }
                            onValueChange={(n) =>
                                onDeuda(n == null ? '' : String(n))
                            }
                            className="h-8 w-28 px-2 py-1 text-right text-sm tabular-nums"
                        />
                        {arsEquiv != null && (
                            <span className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                                ≈ ARS {formatNum(arsEquiv)}
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="shrink-0 text-[11px] text-muted-foreground italic">
                        sin monto
                    </span>
                ))}

            {/* Quitar */}
            <button
                type="button"
                onClick={onQuitar}
                title="Quitar de la inversión"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

UsersInversiones.layout = {
    breadcrumbs: [
        { title: 'Gestión de Usuarios', href: '/users' },
        { title: 'Inversores', href: '#' },
    ],
};
