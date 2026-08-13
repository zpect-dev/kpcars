<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recaudaciones — Período actual</title>
    @include('pdf._styles')
</head>
<body>
    <div class="section-title">
        Recaudaciones — {{ $encabezado ?? 'Período actual' }}
        <span style="font-weight:normal;font-size:11px;">(al {{ now()->format('d/m/Y H:i') }})</span>
    </div>
    @if(!empty($filtroDesc))
        <div style="font-size:11px;color:#6b7280;margin-bottom:8px;">Filtros aplicados: {{ $filtroDesc }}</div>
    @endif

    @if($porInversion->isEmpty())
        <table>
            <thead><tr><th>No hay recaudaciones en el período actual.</th></tr></thead>
        </table>
    @else
        @foreach($porInversion as $nombre => $filas)
            @php $subEfectivo = 0; $subTransf = 0; $subTotal = 0; @endphp
            <div class="section-title">{{ $nombre }}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:12%">Patente</th>
                        <th style="width:24%">Chofer</th>
                        <th style="width:12%">DNI</th>
                        <th class="numeric" style="width:15%">Efectivo</th>
                        <th class="numeric" style="width:15%">Transf.</th>
                        <th class="numeric" style="width:15%">Total</th>
                        <th style="width:7%">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($filas as $f)
                        @php
                            $subEfectivo += $f['efectivo'];
                            $subTransf   += $f['transf'];
                            $subTotal    += $f['total'];
                        @endphp
                        <tr>
                            <td>{{ $f['patente'] }}</td>
                            <td>{{ $f['chofer'] }}</td>
                            <td>{{ $f['chofer_dni'] }}</td>
                            <td class="numeric">${{ number_format($f['efectivo'], 0, ',', '.') }}</td>
                            <td class="numeric">${{ number_format($f['transf'], 0, ',', '.') }}</td>
                            <td class="numeric">${{ number_format($f['total'], 0, ',', '.') }}</td>
                            <td>{{ $f['estado'] }}</td>
                        </tr>
                    @endforeach
                    <tr class="total-row">
                        <td colspan="3">Subtotal {{ strtolower($nombre) }}</td>
                        <td class="numeric">${{ number_format($subEfectivo, 0, ',', '.') }}</td>
                        <td class="numeric">${{ number_format($subTransf, 0, ',', '.') }}</td>
                        <td class="numeric">${{ number_format($subTotal, 0, ',', '.') }}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        @endforeach

        <table style="margin-top:14px">
            <tbody>
                <tr class="total-row">
                    <td colspan="3" style="width:48%">TOTAL GENERAL</td>
                    <td class="numeric" style="width:15%">${{ number_format($totalEfectivo, 0, ',', '.') }}</td>
                    <td class="numeric" style="width:15%">${{ number_format($totalTransferencia, 0, ',', '.') }}</td>
                    <td class="numeric" style="width:15%">${{ number_format($totalGeneral, 0, ',', '.') }}</td>
                    <td style="width:7%"></td>
                </tr>
            </tbody>
        </table>
    @endif
</body>
</html>
