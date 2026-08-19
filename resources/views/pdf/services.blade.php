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
                <th style="width:9%">Patente</th>
                <th style="width:14%">Vehículo</th>
                <th style="width:11%">Empresa</th>
                <th style="width:14%">Conductor</th>
                <th class="numeric" style="width:10%">Km actual</th>
                <th class="numeric" style="width:10%">Últ. service</th>
                <th class="center" style="width:9%">Fecha</th>
                <th style="width:11%">Realizado por</th>
                <th class="numeric" style="width:12%">Estado</th>
            </tr>
        </thead>
        <tbody>
            @forelse($vehiculos as $v)
                <tr>
                    <td>{{ $v['patente'] }}</td>
                    <td>{{ trim($v['marca'].' '.$v['modelo']) }}</td>
                    <td>{{ $v['empresa'] ?? '—' }}</td>
                    <td>{{ $v['conductor'] ?? 'Sin conductor' }}</td>
                    <td class="numeric">{{ $km($v['km_actual']) }}</td>
                    <td class="numeric">{{ $km($v['ultimo_service']['kilometraje'] ?? null) }}</td>
                    <td class="center">
                        {{ isset($v['ultimo_service']) ? \Carbon\Carbon::parse($v['ultimo_service']['fecha'])->format('d/m/Y') : '—' }}
                    </td>
                    <td>{{ $v['ultimo_service']['realizado_por'] ?? '—' }}</td>
                    <td class="numeric">
                        {{ $estadoLabels[$v['estado']] ?? $v['estado'] }}
                        @if($v['estado'] === 'vencido')
                            (+{{ number_format(max(0, ($v['km_recorridos'] ?? 0) - $intervaloKm), 0, ',', '.') }})
                        @elseif($v['estado'] === 'al_dia')
                            ({{ number_format((int) $v['km_restantes'], 0, ',', '.') }} rest.)
                        @endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="9" class="center">No hay vehículos que coincidan con los filtros.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
