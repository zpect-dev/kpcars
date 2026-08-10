import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { utils, writeFile } from 'xlsx';

type CellValue = string | number;

/** Genera y descarga un .xlsx a partir de encabezados + filas ya armadas (no toca el backend). */
export function exportToExcel(
    filename: string,
    headers: string[],
    rows: CellValue[][],
) {
    const sheet = utils.aoa_to_sheet([headers, ...rows]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, 'Datos');
    writeFile(workbook, filename);
}

/** Genera y descarga un PDF tabular a partir de encabezados + filas ya armadas. */
export function exportToPdf(
    filename: string,
    title: string,
    headers: string[],
    rows: CellValue[][],
) {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 20,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [51, 51, 51] },
    });
    doc.save(filename);
}
