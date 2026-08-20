import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

type Props = {
    columns: number;
    rows?: number;
};

/**
 * Filas fantasma mientras la tabla resuelve. Usa el número real de columnas
 * para que el ancho no salte cuando llegan los datos.
 */
export function DataTableSkeleton({ columns, rows = 8 }: Props) {
    return (
        <>
            {Array.from({ length: rows }, (_, rowIndex) => (
                <TableRow key={rowIndex} aria-hidden="true">
                    {Array.from({ length: columns }, (_, colIndex) => (
                        <TableCell key={colIndex}>
                            <Skeleton
                                className="h-4"
                                style={{
                                    // Anchos irregulares: un bloque perfecto se
                                    // lee como un error de render, no como carga.
                                    width: `${55 + ((rowIndex * 7 + colIndex * 13) % 40)}%`,
                                }}
                            />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}
