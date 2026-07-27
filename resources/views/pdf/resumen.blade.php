<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Resumen financiero</title>
    @include('pdf._styles')
</head>
<body>
    <div class="section-title">
        Resumen financiero — {{ \Carbon\Carbon::parse($filtros['desde'])->format('d/m/Y') }} al {{ \Carbon\Carbon::parse($filtros['hasta'])->format('d/m/Y') }}
    </div>

    <table>
        <thead>
            <tr>
                <th style="width:34%">Ingresos</th>
                <th style="width:33%">Egresos</th>
                <th style="width:33%">Neto</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="numeric">${{ number_format($resumen['totales']['ingresos'], 2, ',', '.') }}</td>
                <td class="numeric">${{ number_format($resumen['totales']['egresos'], 2, ',', '.') }}</td>
                <td class="numeric">${{ number_format($resumen['totales']['neto'], 2, ',', '.') }}</td>
            </tr>
        </tbody>
    </table>

    @if ($resumen['abierto']['total'] > 0)
        <p style="font-size:10px; margin:6px 0 0;">
            Período de recaudación en curso (sin cierre): ${{ number_format($resumen['abierto']['total'], 2, ',', '.') }}
            — {{ $resumen['abierto']['incluido'] ? 'incluido en los ingresos' : 'NO incluido en los ingresos' }}.
        </p>
    @endif

    <div class="section-title" style="margin-top:14px;">Por vehículo</div>
    <table>
        <thead>
            <tr>
                <th style="width:14%">Patente</th>
                <th style="width:22%">Vehículo</th>
                <th style="width:16%">Inversión</th>
                <th style="width:15%">Empresa</th>
                <th class="numeric" style="width:11%">Ingresos</th>
                <th class="numeric" style="width:11%">Egresos</th>
                <th class="numeric" style="width:11%">Neto</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($resumen['por_vehiculo'] as $f)
                <tr>
                    <td>{{ $f['patente'] }}</td>
                    <td>{{ trim(($f['marca'] ?? '').' '.($f['modelo'] ?? '')) ?: '—' }}</td>
                    <td>{{ $f['inversion_nombre'] ?? '—' }}</td>
                    <td>{{ $f['empresa_nombre'] ?? '—' }}</td>
                    <td class="numeric">${{ number_format($f['ingresos'], 2, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($f['egresos'], 2, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($f['neto'], 2, ',', '.') }}</td>
                </tr>
            @empty
                <tr><td colspan="7" class="center">Sin movimientos por vehículo en el rango.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="section-title" style="margin-top:14px;">Egresos por tipo de gasto</div>
    <table>
        <thead>
            <tr>
                <th style="width:50%">Tipo</th>
                <th class="numeric" style="width:25%">Monto</th>
                <th class="numeric" style="width:25%">% del total</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($resumen['por_tipo'] as $t)
                <tr>
                    <td>{{ $t['label'] }}</td>
                    <td class="numeric">${{ number_format($t['total'], 2, ',', '.') }}</td>
                    <td class="numeric">{{ number_format($t['porcentaje'], 1, ',', '.') }}%</td>
                </tr>
            @empty
                <tr><td colspan="3" class="center">Sin egresos en el rango.</td></tr>
            @endforelse
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td>TOTAL EGRESOS</td>
                <td class="numeric">${{ number_format($resumen['totales']['egresos'], 2, ',', '.') }}</td>
                <td></td>
            </tr>
        </tfoot>
    </table>

</body>
</html>
