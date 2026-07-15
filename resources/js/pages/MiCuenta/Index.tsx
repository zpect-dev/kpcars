import { Head } from '@inertiajs/react';

// Página en reconstrucción: el backend sigue enviando los datos crudos
// (inversiones, cierres, tasaActual) — la UI nueva se arma desde cero.
export default function MiCuentaIndex() {
    return (
        <>
            <Head title="Mi Cuenta" />

            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    Mi Cuenta
                </h1>
            </div>
        </>
    );
}

MiCuentaIndex.layout = {
    breadcrumbs: [{ title: 'Mi Cuenta', href: '/mi-cuenta' }],
};
