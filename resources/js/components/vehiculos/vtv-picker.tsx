import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export const MESES_VTV = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
];

export function VtvMonthYearPicker({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const [yearPart, monthPart] = value ? value.split('-') : ['', ''];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 12 }, (_, i) => currentYear - 1 + i);

    const setMonth = (m: string) => {
        const y = yearPart || String(currentYear);
        onChange(`${y}-${m}`);
    };
    const setYear = (y: string) => {
        const m = monthPart || '01';
        onChange(`${y}-${m}`);
    };

    return (
        <div className="flex gap-2">
            <Select value={monthPart} onValueChange={setMonth}>
                <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                    {MESES_VTV.map((nombre, i) => (
                        <SelectItem
                            key={i}
                            value={String(i + 1).padStart(2, '0')}
                        >
                            {nombre}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={yearPart} onValueChange={setYear}>
                <SelectTrigger className="w-[110px]">
                    <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                    {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                            {y}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {value && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange('')}
                    aria-label="Limpiar VTV"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
