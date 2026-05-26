<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cierre de Caja #{{ $cierre->id }}</title>
    @include('pdf._styles')
</head>
<body>
    @php $grandTotal = 0; @endphp

    @if($empresas->isEmpty())
        <table>
            <thead><tr><th>No hay detalles para este cierre</th></tr></thead>
        </table>
    @else
        @foreach($empresas as $empresaNombre => $inversiones)
            @php $empresaTotal = 0; @endphp
            <div class="section-title">{{ $empresaNombre }}</div>

            @foreach($inversiones as $inversionNombre => $cobros)
                @php
                    $nombreFormateado = preg_replace('/^INV_(\d+)$/i', 'Inversión $1', $inversionNombre);
                    $inversionTotal = 0;
                @endphp
                <table>
                    <thead>
                        <tr>
                            <th style="width:50%">{{ $nombreFormateado }} — Artículo</th>
                            <th class="center" style="width:10%">Cant.</th>
                            <th style="width:20%">Patente</th>
                            <th class="numeric" style="width:20%">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($cobros as $cobro)
                            @php
                                $inversionTotal += $cobro->subtotal;
                                $empresaTotal += $cobro->subtotal;
                                $grandTotal += $cobro->subtotal;
                            @endphp
                            <tr>
                                <td>{{ $cobro->articulo_descripcion }}</td>
                                <td class="center">{{ $cobro->cantidad }}</td>
                                <td>{{ $cobro->patente ?: 'N/A' }}</td>
                                <td class="numeric">${{ number_format($cobro->subtotal, 0, ',', '.') }}</td>
                            </tr>
                        @endforeach
                        <tr class="total-row">
                            <td colspan="3">Total {{ strtolower($nombreFormateado) }}</td>
                            <td class="numeric">${{ number_format($inversionTotal, 0, ',', '.') }}</td>
                        </tr>
                    </tbody>
                </table>
            @endforeach

            <table>
                <tbody>
                    <tr class="total-row">
                        <td style="width:80%">Total {{ $empresaNombre }}</td>
                        <td class="numeric" style="width:20%">${{ number_format($empresaTotal, 0, ',', '.') }}</td>
                    </tr>
                </tbody>
            </table>
        @endforeach

        <table>
            <tbody>
                <tr class="total-row">
                    <td style="width:80%">TOTAL DEL CIERRE</td>
                    <td class="numeric" style="width:20%">${{ number_format($grandTotal, 0, ',', '.') }}</td>
                </tr>
            </tbody>
        </table>
    @endif
</body>
</html>
