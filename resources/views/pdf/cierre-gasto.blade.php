<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cierre de Gastos #{{ $cierre->id }}</title>
    @include('pdf._styles')
    @php
        $tipoLabels = [
            'galpon' => 'Galpón',
            'taller' => 'Taller',
            'oficina' => 'Oficina',
            'kevin' => 'Kevin',
            'stock' => 'Stock',
        ];
    @endphp
</head>
<body>
    <div class="section-title">
        Cierre de Gastos #{{ $cierre->id }}
        @if($cierre->periodo_inicio)
            — del {{ $cierre->periodo_inicio->format('d/m/Y H:i') }}
        @endif
        al {{ $cierre->periodo_fin->format('d/m/Y H:i') }}
    </div>

    <table>
        <tbody>
            <tr>
                <td style="width:50%"><strong>Ejecutado por:</strong> {{ $cierre->user?->name ?? '—' }}</td>
                <td style="width:50%"><strong>Fecha:</strong> {{ $cierre->created_at?->format('d/m/Y H:i') }}</td>
            </tr>
        </tbody>
    </table>

    <div class="section-title">Por categoría</div>
    <table>
        <thead>
            <tr>
                <th style="width:70%">Categoría</th>
                <th class="numeric" style="width:30%">Monto</th>
            </tr>
        </thead>
        <tbody>
            @forelse($porTipo as $d)
                <tr>
                    <td>{{ $tipoLabels[$d->tipo] ?? ucfirst($d->tipo) }}</td>
                    <td class="numeric">${{ number_format((float) $d->total, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr><td colspan="2" class="center">Sin gastos de categorías generales.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="section-title">Por vehículo</div>
    <table>
        <thead>
            <tr>
                <th style="width:70%">Patente</th>
                <th class="numeric" style="width:30%">Monto</th>
            </tr>
        </thead>
        <tbody>
            @forelse($porVehiculo as $d)
                <tr>
                    <td>{{ $d->patente ?? '—' }}</td>
                    <td class="numeric">${{ number_format((float) $d->total, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr><td colspan="2" class="center">Sin gastos de vehículos.</td></tr>
            @endforelse
        </tbody>
    </table>

    <table>
        <tbody>
            <tr class="total-row">
                <td style="width:70%">TOTAL DEL CIERRE</td>
                <td class="numeric" style="width:30%">${{ number_format((float) $cierre->total_general, 0, ',', '.') }}</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
