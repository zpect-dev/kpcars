import { Head } from '@inertiajs/react';
import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import { edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    return (
        <>
            <Head title="Apariencia" />

            <h1 className="sr-only">Apariencia</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Apariencia"
                    description="Elegí cómo se ve la aplicación"
                />
                <AppearanceTabs />
            </div>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Apariencia',
            href: editAppearance(),
        },
    ],
};
