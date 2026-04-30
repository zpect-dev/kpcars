import { Head, router } from '@inertiajs/react';
import { ArrowLeft, FileDown, CarFront, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Vehiculo {
    id: number;
    patente: string;
    marca: string;
    modelo: string;
    anio: string;
}

interface Asignacion {
    id: number;
    vehiculo: Vehiculo | null;
    asignado_por: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
}

interface UserInfo {
    id: number;
    name: string;
    dni: string;
    role: string;
}

interface Props {
    user: UserInfo;
    asignaciones: Asignacion[];
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function UserAsignaciones({ user, asignaciones }: Props) {
    return (
        <>
            <Head title={`Asignaciones — ${user.name}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="px-2"
                            onClick={() => {
                                if (window.history.length > 1) {
                                    window.history.back();
                                } else {
                                    router.get('/users');
                                }
                            }}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                                Historial de Asignaciones
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {user.name} — DNI {user.dni}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            window.open(
                                `/users/${user.id}/asignaciones/pdf`,
                                '_blank',
                            )
                        }
                    >
                        <FileDown className="h-4 w-4" />
                        Exportar PDF
                    </Button>
                </div>

                {/* Tabla (desktop) + Cards (mobile) */}
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full table-fixed text-left text-sm text-muted-foreground">
                            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                                <tr>
                                    <th className="w-[25%] px-4 py-3 font-medium sm:px-6 sm:py-4">Vehículo</th>
                                    <th className="hidden w-[13%] px-4 py-3 font-medium sm:table-cell sm:px-6 sm:py-4">Patente</th>
                                    <th className="w-[20%] px-4 py-3 font-medium sm:px-6 sm:py-4">Inicio</th>
                                    <th className="hidden w-[20%] px-4 py-3 font-medium md:table-cell sm:px-6 sm:py-4">Fin</th>
                                    <th className="w-[12%] px-4 py-3 font-medium sm:px-6 sm:py-4">Estado</th>
                                    <th className="hidden w-[10%] px-4 py-3 font-medium lg:table-cell sm:px-6 sm:py-4">Asignado por</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {asignaciones.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-12 text-center text-muted-foreground sm:px-6"
                                        >
                                            No hay historial de asignaciones para este usuario.
                                        </td>
                                    </tr>
                                ) : (
                                    asignaciones.map((a) => {
                                        const activo = a.fecha_fin === null;
                                        return (
                                            <tr
                                                key={a.id}
                                                className="bg-card transition-colors hover:bg-muted/40"
                                            >
                                                <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                    {a.vehiculo ? (
                                                        <div className="flex items-center gap-2">
                                                            <CarFront className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                            <span className="font-medium text-foreground">
                                                                {a.vehiculo.marca} {a.vehiculo.modelo}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <Car className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                            <span className="italic text-muted-foreground">
                                                                Sin vehículo
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell sm:px-6 sm:py-4">
                                                    {a.vehiculo?.patente ?? '—'}
                                                </td>
                                                <td className="truncate px-4 py-3 sm:px-6 sm:py-4" title={formatDate(a.fecha_inicio)}>
                                                    {formatDate(a.fecha_inicio)}
                                                </td>
                                                <td className="hidden truncate px-4 py-3 text-muted-foreground md:table-cell sm:px-6 sm:py-4" title={formatDate(a.fecha_fin)}>
                                                    {formatDate(a.fecha_fin)}
                                                </td>
                                                <td className="px-4 py-3 sm:px-6 sm:py-4">
                                                    {activo ? (
                                                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                            Activo
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                                            Finalizado
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell sm:px-6 sm:py-4">
                                                    {a.asignado_por ?? '—'}
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
                        {asignaciones.length === 0 ? (
                            <li className="px-4 py-12 text-center text-sm text-muted-foreground">
                                No hay historial de asignaciones para este usuario.
                            </li>
                        ) : (
                            asignaciones.map((a) => {
                                const activo = a.fecha_fin === null;
                                return (
                                    <li key={a.id} className="flex flex-col gap-2 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1 text-xs text-foreground">
                                                <p className="truncate" title={formatDate(a.fecha_inicio)}>
                                                    <span className="text-muted-foreground">Inicio: </span>
                                                    {formatDate(a.fecha_inicio)}
                                                </p>
                                                <p className="truncate text-muted-foreground" title={formatDate(a.fecha_fin)}>
                                                    <span>Fin: </span>
                                                    {formatDate(a.fecha_fin)}
                                                </p>
                                            </div>
                                            {activo ? (
                                                <span className="inline-flex shrink-0 items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                    Activo
                                                </span>
                                            ) : (
                                                <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                                    Finalizado
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {a.vehiculo ? (
                                                <>
                                                    <CarFront className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <span className="truncate font-medium text-foreground">
                                                        {a.vehiculo.marca} {a.vehiculo.modelo}
                                                    </span>
                                                    <span className="shrink-0 text-xs text-muted-foreground">
                                                        · {a.vehiculo.patente}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <Car className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <span className="italic text-muted-foreground">Sin vehículo</span>
                                                </>
                                            )}
                                        </div>

                                        <p className="text-xs text-muted-foreground">
                                            Asignado por: {a.asignado_por ?? '—'}
                                        </p>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            </div>
        </>
    );
}
