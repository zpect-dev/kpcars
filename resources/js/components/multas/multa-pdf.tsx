import { FileText, FileX } from 'lucide-react';

/** Enlace al PDF de la infracción, o el hueco de que falta cargarlo. */
export function MultaPdf({ pdfUrl }: { pdfUrl: string | null }) {
    if (!pdfUrl) {
        return (
            <span
                title="Sin PDF"
                aria-label="Sin PDF cargado"
                className="flex size-7 items-center justify-center rounded-lg border border-warning/30 bg-warning-soft text-warning-soft-foreground"
            >
                <FileX aria-hidden="true" className="size-3.5" />
            </span>
        );
    }

    return (
        <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver PDF"
            aria-label="Ver el PDF de la infracción"
            className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
            <FileText aria-hidden="true" className="size-3.5" />
        </a>
    );
}
