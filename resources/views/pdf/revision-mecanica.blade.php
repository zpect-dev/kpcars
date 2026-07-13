<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Revisión Mecánica — {{ $titulo }}</title>
    @include('pdf._styles')
    <style>
        .prio { display:inline-block; padding:1px 6px; border-radius:4px; font-weight:700; font-size:10px; }
        .prio-alta { background:#fee2e2; color:#b91c1c; }
        .prio-media { background:#fef3c7; color:#b45309; }
        .prio-baja { background:#dcfce7; color:#15803d; }
        .prio-pend { background:#f3f4f6; color:#6b7280; }
        .summary-grid { width:100%; margin-top:16px; border-collapse:collapse; }
        .summary-grid td { border:1px solid #000; padding:6px 10px; width:25%; }
        .summary-label { font-size:9px; color:#6b7280; text-transform:uppercase; letter-spacing:0.4px; }
        .summary-value { font-size:14px; font-weight:700; margin-top:2px; }
    </style>
</head>
<body>

@php
    $cnt = [
        'alta'  => $filas->filter(fn ($f) => ($f['revision']['prioridad'] ?? null) === 'alta')->count(),
        'media' => $filas->filter(fn ($f) => ($f['revision']['prioridad'] ?? null) === 'media')->count(),
        'baja'  => $filas->filter(fn ($f) => ($f['revision']['prioridad'] ?? null) === 'baja')->count(),
        'pend'  => $filas->filter(fn ($f) => $f['revision'] === null)->count(),
    ];
@endphp

<div class="section-title">
    Revisión Mecánica — {{ $titulo }}
    @if($busqueda) &nbsp;·&nbsp; Búsqueda: "{{ $busqueda }}" @endif
    &nbsp;&nbsp;·&nbsp;&nbsp; {{ $filas->count() }} vehículo{{ $filas->count() !== 1 ? 's' : '' }}
    &nbsp;&nbsp;·&nbsp;&nbsp; Generado el {{ now()->format('d/m/Y H:i') }}
</div>

<table class="summary-grid">
    <tr>
        <td><div class="summary-label">Prioridad alta</div><div class="summary-value" style="color:#b91c1c">{{ $cnt['alta'] }}</div></td>
        <td><div class="summary-label">Prioridad media</div><div class="summary-value" style="color:#b45309">{{ $cnt['media'] }}</div></td>
        <td><div class="summary-label">Prioridad baja</div><div class="summary-value" style="color:#15803d">{{ $cnt['baja'] }}</div></td>
        <td><div class="summary-label">Sin revisión</div><div class="summary-value" style="color:#6b7280">{{ $cnt['pend'] }}</div></td>
    </tr>
</table>

<table style="margin-top:10px">
    <thead>
        <tr>
            <th style="width:70px">Patente</th>
            <th>Vehículo</th>
            <th>Chofer</th>
            <th>Inversión</th>
            <th style="width:80px" class="center">Prioridad</th>
            <th style="width:60px" class="numeric">Promedio</th>
            <th style="width:70px">Fecha</th>
            <th>Revisor</th>
        </tr>
    </thead>
    <tbody>
        @forelse($filas as $f)
            @php $r = $f['revision']; @endphp
            <tr>
                <td><strong>{{ $f['patente'] }}</strong></td>
                <td>{{ trim(($f['marca'] ?? '') . ' ' . ($f['modelo'] ?? '')) ?: '—' }}</td>
                <td>{{ $f['chofer'] }}</td>
                <td>{{ $f['inversion'] ?? '—' }}</td>
                <td class="center">
                    @if($r)
                        @php $p = $r['prioridad']; @endphp
                        <span class="prio prio-{{ $p }}">{{ ucfirst($p) }}</span>
                    @else
                        <span class="prio prio-pend">Pendiente</span>
                    @endif
                </td>
                <td class="numeric">{{ $r ? number_format($r['promedio'], 2, ',', '.') : '—' }}</td>
                <td>{{ $r && $r['fecha'] ? \Carbon\Carbon::parse($r['fecha'])->format('d/m/Y') : '—' }}</td>
                <td>{{ $r['revisor'] ?? '—' }}</td>
            </tr>
        @empty
            <tr><td colspan="8" style="text-align:center;color:#6b7280">Sin vehículos que coincidan con los filtros.</td></tr>
        @endforelse
    </tbody>
</table>

</body>
</html>
