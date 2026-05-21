<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cobros</title>
    @include('pdf._styles')
</head>
<body>
    @if($inversiones->isEmpty())
        <table>
            <thead><tr><th>No hay cobros pendientes</th></tr></thead>
        </table>
    @else
        @foreach($inversiones as $nombre => $cobros)
            @php
                $nombreFormateado = preg_replace('/^INV_(\d+)$/i', 'Inversión $1', $nombre);
                $total = 0;
            @endphp
            <div class="section-title">{{ $nombreFormateado }}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:50%">Artículo</th>
                        <th class="center" style="width:10%">Cant.</th>
                        <th style="width:20%">Patente</th>
                        <th class="numeric" style="width:20%">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($cobros as $cobro)
                        @php $total += $cobro->subtotal; @endphp
                        <tr>
                            <td>{{ $cobro->articulo_descripcion }}</td>
                            <td class="center">{{ $cobro->cantidad }}</td>
                            <td>{{ $cobro->patente ?: 'N/A' }}</td>
                            <td class="numeric">${{ number_format($cobro->subtotal, 0, ',', '.') }}</td>
                        </tr>
                    @endforeach
                    <tr class="total-row">
                        <td colspan="3">Total {{ strtolower($nombreFormateado) }}</td>
                        <td class="numeric">${{ number_format($total, 0, ',', '.') }}</td>
                    </tr>
                </tbody>
            </table>
        @endforeach
    @endif
</body>
</html>
