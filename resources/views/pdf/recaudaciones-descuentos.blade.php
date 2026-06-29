<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recaudaciones — Descuentos</title>
    @include('pdf._styles')
</head>
<body>
    @if($filas->isEmpty())
        <table>
            <thead><tr><th>No hay descuentos en el período actual</th></tr></thead>
        </table>
    @else
        @php $totalGeneral = 0; @endphp
        @foreach($filas as $inversion => $rows)
            @php $subtotal = collect($rows)->sum('descuento'); @endphp
            <div class="section-title">{{ $inversion }}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:18%">Patente</th>
                        <th style="width:30%">Chofer</th>
                        <th class="numeric" style="width:18%">Descuento</th>
                        <th style="width:14%">Estado</th>
                        <th style="width:20%">Descripción</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($rows as $d)
                        <tr>
                            <td>{{ $d['patente'] }}</td>
                            <td>{{ $d['chofer'] }}</td>
                            <td class="numeric">${{ number_format($d['descuento'], 0, ',', '.') }}</td>
                            <td>{{ $d['estado'] }}</td>
                            <td>{{ $d['descripcion'] ?: '—' }}</td>
                        </tr>
                    @endforeach
                    <tr class="total-row">
                        <td colspan="2">Total {{ strtolower($inversion) }}</td>
                        <td class="numeric">${{ number_format($subtotal, 0, ',', '.') }}</td>
                        <td colspan="2"></td>
                    </tr>
                </tbody>
            </table>
            @php $totalGeneral += $subtotal; @endphp
        @endforeach

        <table style="margin-top:14px">
            <tbody>
                <tr class="total-row">
                    <td colspan="2" style="width:48%">Total descuentos</td>
                    <td class="numeric" style="width:18%">${{ number_format($totalGeneral, 0, ',', '.') }}</td>
                    <td colspan="2" style="width:34%"></td>
                </tr>
            </tbody>
        </table>
    @endif
</body>
</html>
