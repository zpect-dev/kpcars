{{-- Render por inversión → vehículo con cobros + gastos (detalle + total por auto).
     Espera: $inversiones (iterable de arrays con la forma de BuildResumenIntegradoAction). --}}
@foreach($inversiones as $inv)
    <div class="section-title">{{ preg_replace('/^INV_(\d+)$/i', 'Inversión $1', $inv['inversion_nombre']) }}</div>

    @foreach($inv['vehiculos'] as $v)
        <table>
            <thead>
                <tr>
                    <th style="width:62%">{{ $v['patente'] }} — {{ trim($v['marca'].' '.$v['modelo']) }}</th>
                    <th class="numeric" style="width:38%">
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
                <td style="width:62%">Total {{ preg_replace('/^INV_(\d+)$/i', 'Inversión $1', $inv['inversion_nombre']) }} (cobros ${{ number_format((float) $inv['total_cobros'], 0, ',', '.') }} + gastos ${{ number_format((float) $inv['total_gastos'], 0, ',', '.') }})</td>
                <td class="numeric" style="width:38%">${{ number_format((float) $inv['total'], 0, ',', '.') }}</td>
            </tr>
        </tbody>
    </table>
@endforeach
