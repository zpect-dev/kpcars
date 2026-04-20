import { Head, Link, usePage } from '@inertiajs/react';
import { dashboard, login } from '@/routes';
import AppLogoIcon from '@/components/app-logo-icon';

export default function Welcome() {
    const { auth } = usePage<any>().props;

    return (
        <>
            <Head title="Bienvenido" />
            <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
                <div className="flex w-full max-w-sm flex-col items-center gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary">
                            <AppLogoIcon className="size-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">KPcars</h1>
                        <p className="text-center text-sm text-muted-foreground">
                            Sistema de Gestión de Inventario
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-3">
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                Ir al Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="inline-flex w-full items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    Iniciar sesión
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
