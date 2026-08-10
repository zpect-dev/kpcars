<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Transacciones</title>
    @include('pdf._styles')
</head>
<body>
    <table>
        <thead>
            <tr>
                <th style="width:14%">Fecha</th>
                <th style="width:22%">Artículo</th>
                <th class="center" style="width:8%">Tipo</th>
                <th class="center" style="width:8%">Cantidad</th>
                <th style="width:14%">Patente</th>
                <th style="width:18%">Descripción</th>
                <th style="width:8%">Solicitante</th>
                <th style="width:8%">Usuario</th>
            </tr>
        </thead>
        <tbody>
            @foreach($transactions as $tx)
                <tr>
                    <td>{{ \Carbon\Carbon::parse($tx->created_at)->format('d/m/Y H:i') }}</td>
                    <td>{{ $tx->articulo?->descripcion ?? 'N/A' }}</td>
                    {{-- Las anuladas se listan como devolución: el stock ya volvió al inventario. --}}
                    <td class="center">{{ $tx->inactiva ? 'Devolución' : ($tx->tipo === 'IN' ? 'Ingreso' : ($tx->tipo === 'AJUSTE' ? 'Ajuste' : 'Egreso')) }}</td>
                    <td class="center">{{ $tx->tipo === 'AJUSTE' && $tx->cantidad > 0 ? '+'.$tx->cantidad : $tx->cantidad }}</td>
                    <td>{{ $tx->vehiculo?->patente ?? '-' }}</td>
                    <td>{{ $tx->descripcion ?? '-' }}</td>
                    <td>{{ $tx->solicitante ?? '-' }}</td>
                    <td>{{ $tx->user?->name ?? 'N/A' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
