<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Resumen de cobros con gastos</title>
    @include('pdf._styles')
</head>
<body>
    <div class="section-title">Resumen de cobros con gastos — {{ now()->format('d/m/Y') }}</div>

    @if($resumen->isEmpty())
        <table>
            <thead><tr><th>No hay cobros ni gastos en el período.</th></tr></thead>
        </table>
    @else
        @foreach($resumen as $inv)
            <div class="section-title">{{ $inv['inversion_nombre'] }}</div>

            @foreach($inv['vehiculos'] as $v)
                <table>
                    <thead>
                        <tr>
                            <th style="width:60%">{{ $v['patente'] }} — {{ trim($v['marca'].' '.$v['modelo']) }}</th>
                            <th class="numeric" style="width:40%">
                                Cobros ${{ number_format((float) $v['cobros'], 0, ',', '.') }}
                                · Gastos ${{ number_format((float) $v['gastos'], 0, ',', '.') }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($v['cobros_detalle'] as $c)
                            <tr>
                                <td>Cobro · {{ $c['articulo'] }} ×{{ $c['cantidad'] }}</td>
                                <td class="numeric">${{ number_format((float) $c['subtotal'], 0, ',', '.') }}</td>
                            </tr>
                        @endforeach
                        @foreach($v['gastos_detalle'] as $g)
                            <tr>
                                <td>Gasto · {{ $g['fecha'] ? \Illuminate\Support\Carbon::parse($g['fecha'])->format('d/m/Y') : '' }} {{ $g['descripcion'] ?: $g['recibio'] }}</td>
                                <td class="numeric">${{ number_format((float) $g['monto'], 0, ',', '.') }}</td>
                            </tr>
                        @endforeach
                        <tr class="total-row">
                            <td>Total {{ $v['patente'] }}</td>
                            <td class="numeric">${{ number_format((float) $v['total'], 0, ',', '.') }}</td>
                        </tr>
                    </tbody>
                </table>
            @endforeach

            <table>
                <tbody>
                    <tr class="total-row">
                        <td style="width:60%">Total {{ $inv['inversion_nombre'] }} (cobros ${{ number_format((float) $inv['total_cobros'], 0, ',', '.') }} + gastos ${{ number_format((float) $inv['total_gastos'], 0, ',', '.') }})</td>
                        <td class="numeric" style="width:40%">${{ number_format((float) $inv['total'], 0, ',', '.') }}</td>
                    </tr>
                </tbody>
            </table>
        @endforeach

        <table>
            <tbody>
                <tr class="total-row">
                    <td style="width:80%">TOTAL GENERAL (cobros + gastos)</td>
                    <td class="numeric" style="width:20%">${{ number_format((float) $total, 0, ',', '.') }}</td>
                </tr>
            </tbody>
        </table>
    @endif
</body>
</html>
