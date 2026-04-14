import { Head } from '@inertiajs/react';
import { dashboard } from '@/routes';
import type { Vehiculo } from '@/types';

interface Props {
    vehiculos: Vehiculo[];
}

export default function Dashboard({ vehiculos }: Props) {
    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-muted-foreground">
                            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th scope="col" className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">Patente</th>
                                    <th scope="col" className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">Vehiculo</th>
                                    <th scope="col" className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">Empresa</th>
                                    <th scope="col" className="px-4 py-3 font-medium tracking-wider sm:px-6 sm:py-4">Conductor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {vehiculos.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground sm:px-6">
                                            No hay vehículos registrados en el sistema.
                                        </td>
                                    </tr>
                                ) : (
                                    vehiculos.map((vehiculo) => (
                                        <tr key={vehiculo.id} className="transition-colors bg-card hover:bg-muted/40">
                                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground sm:px-6 sm:py-4">
                                                {vehiculo.patente}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 sm:px-6 sm:py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground">
                                                        {vehiculo.marca} {vehiculo.modelo}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Año: {vehiculo.anio}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 font-medium sm:px-6 sm:py-4">
                                                {vehiculo.empresa?.nombre ? (
                                                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                                        {vehiculo.empresa.nombre}
                                                    </span>
                                                ) : (
                                                    <span className="italic text-muted-foreground">Sin empresa</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 sm:px-6 sm:py-4">
                                                {vehiculo.user?.name || <span className="italic text-muted-foreground">No asignado</span>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard.url(),
        },
    ],
};
