import { ChevronDown, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Botón "Exportar" con PDF/Excel generados en el navegador a partir de los datos ya filtrados en pantalla. */
export function ExportDropdown({
    onExportPdf,
    onExportExcel,
    disabled = false,
}: {
    onExportPdf: () => void;
    onExportExcel: () => void;
    disabled?: boolean;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={disabled}>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Exportar</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExportPdf}>
                    <Download className="h-4 w-4" />
                    PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportExcel}>
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
