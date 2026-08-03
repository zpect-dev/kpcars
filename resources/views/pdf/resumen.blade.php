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
        @if ($resumen['seleccion']['activa'])
            <span style="font-weight:normal;">(reporte de la selección)</span>
        @endif
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
                <th style="width:12%">Patente</th>
                <th style="width:18%">Chofer</th>
                <th style="width:14%">Inversión</th>
                <th style="width:12%">Empresa</th>
                <th class="numeric" style="width:11%">Ingresos</th>
                <th class="numeric" style="width:11%">Gastos</th>
                <th class="numeric" style="width:11%">Repuestos</th>
                <th class="numeric" style="width:11%">Neto</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($resumen['por_vehiculo'] as $f)
                <tr>
                    <td>{{ $f['patente'] }}</td>
                    <td>{{ $f['chofer_nombre'] ?? '—' }}</td>
                    <td>{{ $f['inversion_nombre'] ?? '—' }}</td>
                    <td>{{ $f['empresa_nombre'] ?? '—' }}</td>
                    <td class="numeric">${{ number_format($f['ingresos'], 2, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($f['gastos'], 2, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($f['repuestos'], 2, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($f['neto'], 2, ',', '.') }}</td>
                </tr>
            @empty
                <tr><td colspan="8" class="center">Sin movimientos por vehículo en el rango.</td></tr>
            @endforelse
        </tbody>
        @if ($resumen['seleccion']['activa'] && $resumen['por_vehiculo']->isNotEmpty())
            <tfoot>
                <tr class="total-row">
                    <td colspan="4">TOTAL SELECCIÓN ({{ $resumen['por_vehiculo']->count() }})</td>
                    <td class="numeric">${{ number_format($resumen['seleccion']['vehiculo']['ingresos'], 2, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($resumen['seleccion']['vehiculo']['gastos'], 2, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($resumen['seleccion']['vehiculo']['repuestos'], 2, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($resumen['seleccion']['vehiculo']['neto'], 2, ',', '.') }}</td>
                </tr>
            </tfoot>
        @endif
    </table>

    <p style="font-size:10px; margin:6px 0 0;">
        El egreso de cada vehículo suma sus gastos propios más los repuestos de inventario (a precio de venta).
        Los gastos de galpón no se reparten por vehículo: cuentan sólo en los totales y en el desglose por categoría.
    </p>

    <div class="section-title" style="margin-top:14px;">Egresos por categoría</div>
    <table>
        <thead>
            <tr>
                <th style="width:50%">Categoría</th>
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
            @if ($resumen['seleccion']['activa'] && $resumen['por_tipo']->isNotEmpty())
                <tr class="total-row">
                    <td>TOTAL SELECCIÓN ({{ $resumen['por_tipo']->count() }})</td>
                    <td class="numeric">${{ number_format($resumen['seleccion']['tipo_total'], 2, ',', '.') }}</td>
                    <td></td>
                </tr>
            @else
                <tr class="total-row">
                    <td>TOTAL EGRESOS</td>
                    <td class="numeric">${{ number_format($resumen['totales']['egresos'], 2, ',', '.') }}</td>
                    <td></td>
                </tr>
            @endif
        </tfoot>
    </table>

</body>
</html>
