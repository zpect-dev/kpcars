@php
    $estadoLabels = [
        'vencido' => 'Service vencido',
        'al_dia' => 'Al día',
        'sin_service' => 'Sin service',
        'sin_km' => 'Sin datos',
    ];

    $km = fn ($valor) => $valor === null ? '—' : number_format((int) $valor, 0, ',', '.').' km';
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Service</title>
    @include('pdf._styles')
</head>
<body>
    <div class="section-title">
        Service — kilometraje actual y último service
        @if(! empty($filtros['estado']) && isset($estadoLabels[$filtros['estado']]))
            · {{ $estadoLabels[$filtros['estado']] }}
        @endif
        @if(! empty($filtros['q']))
            · Búsqueda: {{ $filtros['q'] }}
        @endif
        · Intervalo {{ number_format($intervaloKm, 0, ',', '.') }} km
        · {{ now()->format('d/m/Y') }}
    </div>

    <table>
        <thead>
            <tr>
                <th style="width:14%">Patente</th>
                <th style="width:18%">Empresa</th>
                <th style="width:20%">Inversión</th>
                <th class="numeric" style="width:16%">Km actual</th>
                <th class="numeric" style="width:16%">Últ. service</th>
                <th class="center" style="width:16%">Fecha</th>
            </tr>
        </thead>
        <tbody>
            @forelse($vehiculos as $v)
                <tr>
                    <td>{{ $v['patente'] }}</td>
                    <td>{{ $v['empresa'] ?? '—' }}</td>
                    <td>{{ $v['inversion'] ?? 'Sin inversión' }}</td>
                    <td class="numeric">{{ $km($v['km_actual']) }}</td>
                    <td class="numeric">{{ $km($v['ultimo_service']['kilometraje'] ?? null) }}</td>
                    <td class="center">
                        {{ isset($v['ultimo_service']) ? \Carbon\Carbon::parse($v['ultimo_service']['fecha'])->format('d/m/Y') : '—' }}
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="center">No hay vehículos que coincidan con los filtros.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
