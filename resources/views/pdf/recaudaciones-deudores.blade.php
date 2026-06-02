<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recaudaciones — Deudores</title>
    @include('pdf._styles')
</head>
<body>
    @if($inversiones->isEmpty())
        <table>
            <thead><tr><th>No hay deudores en el período actual</th></tr></thead>
        </table>
    @else
        @php
            $totalGeneralRecaudado = 0;
            $totalGeneralDeuda = 0;
        @endphp
        @foreach($inversiones as $nombre => $rows)
            @php
                $subRecaudado = 0;
                $subDeuda = 0;
            @endphp
            <div class="section-title">{{ $nombre }}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:20%">Patente</th>
                        <th style="width:40%">Chofer</th>
                        <th class="numeric" style="width:20%">Recaudado</th>
                        <th class="numeric" style="width:20%">Deuda</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($rows as $d)
                        @php
                            $subRecaudado += $d['recaudado'];
                            $subDeuda += $d['deuda'];
                        @endphp
                        <tr>
                            <td>{{ $d['patente'] }}</td>
                            <td>{{ $d['chofer'] }}</td>
                            <td class="numeric">${{ number_format($d['recaudado'], 0, ',', '.') }}</td>
                            <td class="numeric">${{ number_format($d['deuda'], 0, ',', '.') }}</td>
                        </tr>
                    @endforeach
                    <tr class="total-row">
                        <td colspan="2">Total {{ strtolower($nombre) }}</td>
                        <td class="numeric">${{ number_format($subRecaudado, 0, ',', '.') }}</td>
                        <td class="numeric">${{ number_format($subDeuda, 0, ',', '.') }}</td>
                    </tr>
                </tbody>
            </table>
            @php
                $totalGeneralRecaudado += $subRecaudado;
                $totalGeneralDeuda += $subDeuda;
            @endphp
        @endforeach

        <table style="margin-top:14px">
            <tbody>
                <tr class="total-row">
                    <td colspan="2" style="width:60%">Total general</td>
                    <td class="numeric" style="width:20%">${{ number_format($totalGeneralRecaudado, 0, ',', '.') }}</td>
                    <td class="numeric" style="width:20%">${{ number_format($totalGeneralDeuda, 0, ',', '.') }}</td>
                </tr>
            </tbody>
        </table>
    @endif
</body>
</html>
