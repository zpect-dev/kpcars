import { Check } from 'lucide-react';
import { StatusBadge } from '@/components/app/status-badge';
import { formatARS } from '@/components/recaudaciones/format';

export function EstadoBadge({
    estado,
    deuda,
}: {
    estado: 'pagado' | 'deuda';
    deuda: number;
}) {
    if (estado === 'pagado') {
        return (
            <StatusBadge tone="success" icon={Check}>
                Pagado
            </StatusBadge>
        );
    }

    return (
        <StatusBadge tone="destructive">Debe {formatARS(deuda)}</StatusBadge>
    );
}
