<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte de multas — {{ $r['run']['snapshot'] ?? 'sin snapshot' }}</title>
    @include('pdf._styles')
    <style>
        .verde { color: #16a34a; font-weight:700; }
        .rojo { color: #dc2626; font-weight:700; }
        .summary-grid { width:100%; margin-top:16px; border-collapse:collapse; }
        .summary-grid td { border:1px solid #000; padding:6px 10px; width:25%; }
        .summary-label { font-size:9px; color:#6b7280; text-transform:uppercase; letter-spacing:0.4px; }
        .summary-value { font-size:14px; font-weight:700; margin-top:2px; }
        .vacio { text-align:center; color:#6b7280; }
    </style>
</head>
<body>

@php
    /** Fecha ISO (con o sin hora) a dd/mm/aaaa. */
    $fecha = fn (?string $iso) => $iso ? \Illuminate\Support\Carbon::parse($iso)->format('d/m/Y') : '—';
    /** Fecha y hora ISO a dd/mm/aaaa HH:mm. */
    $fechaHora = fn (?string $iso) => $iso ? \Illuminate\Support\Carbon::parse($iso)->format('d/m/Y H:i') : '—';
    $plata = fn ($n) => '$' . number_format((float) $n, 2, ',', '.');

    $t = $r['totales'];
@endphp

<div class="section-title">
    Reporte de multas (feed) — Sincronización del {{ $fechaHora($r['run']['cuando']) }}
    &nbsp;&nbsp;·&nbsp;&nbsp; Snapshot {{ $fecha($r['run']['snapshot']) }}
    &nbsp;&nbsp;·&nbsp;&nbsp; Origen {{ $r['run']['origen'] }}
</div>

<p style="margin-top:8px; font-size:10px; color:#374151;">
    Cobros a choferes incluidos: los registrados entre el {{ $fechaHora($r['periodo']['desde']) }}
    y {{ $r['periodo']['hasta'] ? 'el ' . $fechaHora($r['periodo']['hasta']) . ' (sincronización siguiente)' : 'hoy' }}.
    Generado el {{ now()->format('d/m/Y H:i') }}.
</p>

@if(! $r['run']['ok'])
    <p style="margin-top:8px; font-size:10px;" class="rojo">
        Esta sincronización falló{{ $r['run']['error'] ? ': ' . $r['run']['error'] : '.' }}
    </p>
@endif

{{-- Resumen --}}
<table class="summary-grid">
    <tr>
        <td>
            <div class="summary-label">Multas nuevas</div>
            <div class="summary-value">{{ $t['nuevas'] }} · {{ $plata($t['monto_nuevas']) }}</div>
        </td>
        <td>
            <div class="summary-label">Pagadas al organismo</div>
            <div class="summary-value verde">{{ $t['resueltas'] }} · {{ $plata($t['monto_resueltas']) }}</div>
        </td>
        <td>
            <div class="summary-label">Cobrado a choferes</div>
            <div class="summary-value verde">{{ $t['pagos'] }} pagos · {{ $plata($t['cobrado']) }}</div>
        </td>
        <td>
            <div class="summary-label">Deuda vigente al cierre</div>
            <div class="summary-value rojo">{{ $plata($t['deuda_vigente']) }}</div>
        </td>
    </tr>
</table>

@if($t['reabiertas'] > 0)
    <p style="margin-top:8px; font-size:10px; color:#374151;">
        {{ $t['reabiertas'] }} multa{{ $t['reabiertas'] === 1 ? '' : 's' }} reapareció en el feed
        después de haber figurado como pagada.
    </p>
@endif

{{-- Desgloses --}}
@php
    $desgloses = [
        ['titulo' => 'Desglose por chofer', 'header' => 'Chofer', 'filas' => $r['por_chofer']],
        ['titulo' => 'Desglose por vehículo', 'header' => 'Patente', 'filas' => $r['por_vehiculo']],
    ];
@endphp

@foreach($desgloses as $d)
    <div class="section-title" style="margin-top:20px">{{ $d['titulo'] }}</div>
    <table>
        <thead>
            <tr>
                <th>{{ $d['header'] }}</th>
                <th style="width:60px" class="center">Nuevas</th>
                <th style="width:110px" class="numeric">Monto nuevas</th>
                <th style="width:55px" class="center">Pagos</th>
                <th style="width:110px" class="numeric">Cobrado</th>
                <th style="width:110px" class="numeric">Adeuda hoy</th>
            </tr>
        </thead>
        <tbody>
            @forelse($d['filas'] as $fila)
                <tr>
                    <td>{{ $fila['label'] }}</td>
                    <td class="center">{{ $fila['nuevas'] }}</td>
                    <td class="numeric">{{ $plata($fila['monto_nuevas']) }}</td>
                    <td class="center">{{ $fila['pagos'] }}</td>
                    <td class="numeric verde">{{ $plata($fila['cobrado']) }}</td>
                    <td class="numeric rojo">{{ $plata($fila['adeuda']) }}</td>
                </tr>
            @empty
                <tr><td colspan="6" class="vacio">Sin movimiento.</td></tr>
            @endforelse
        </tbody>
    </table>
@endforeach

{{-- Multas nuevas --}}
<div class="section-title" style="margin-top:20px">
    Multas nuevas ({{ count($r['nuevas']) }})
</div>
<table>
    <thead>
        <tr>
            <th style="width:70px">Patente</th>
            <th style="width:110px">Chofer</th>
            <th style="width:50px" class="center">Jurisd.</th>
            <th style="width:90px">Acta</th>
            <th>Motivo</th>
            <th style="width:70px">Infracción</th>
            <th style="width:70px">Vencimiento</th>
            <th style="width:100px" class="numeric">Monto</th>
        </tr>
    </thead>
    <tbody>
        @forelse($r['nuevas'] as $a)
            <tr>
                <td><strong>{{ $a['patente'] }}</strong></td>
                <td>{{ $a['conductor'] ?? 'Sin chofer' }}</td>
                <td class="center">{{ $a['jurisdiccion'] }}</td>
                <td>{{ $a['acta'] ?? '—' }}</td>
                <td>{{ $a['motivo'] ?? '—' }}</td>
                <td>{{ $fecha($a['fecha_infraccion']) }}</td>
                <td>{{ $fecha($a['fecha_vencimiento']) }}</td>
                <td class="numeric">{{ $a['monto'] === null ? '—' : $plata($a['monto']) }}</td>
            </tr>
        @empty
            <tr><td colspan="8" class="vacio">Esta sincronización no trajo multas nuevas.</td></tr>
        @endforelse
    </tbody>
</table>

{{-- Pagadas al organismo --}}
<div class="section-title" style="margin-top:20px">
    Pagadas al organismo ({{ count($r['resueltas']) }})
</div>
<table>
    <thead>
        <tr>
            <th style="width:70px">Patente</th>
            <th style="width:110px">Chofer</th>
            <th style="width:50px" class="center">Jurisd.</th>
            <th style="width:90px">Acta</th>
            <th>Motivo</th>
            <th style="width:70px">Infracción</th>
            <th style="width:100px" class="numeric">Monto</th>
        </tr>
    </thead>
    <tbody>
        @forelse($r['resueltas'] as $a)
            <tr>
                <td><strong>{{ $a['patente'] }}</strong></td>
                <td>{{ $a['conductor'] ?? 'Sin chofer' }}</td>
                <td class="center">{{ $a['jurisdiccion'] }}</td>
                <td>{{ $a['acta'] ?? '—' }}</td>
                <td>{{ $a['motivo'] ?? '—' }}</td>
                <td>{{ $fecha($a['fecha_infraccion']) }}</td>
                <td class="numeric">{{ $a['monto'] === null ? '—' : $plata($a['monto']) }}</td>
            </tr>
        @empty
            <tr><td colspan="7" class="vacio">Ninguna multa desapareció del feed en esta sincronización.</td></tr>
        @endforelse
    </tbody>
</table>

{{-- Cobros a choferes --}}
<div class="section-title" style="margin-top:20px">
    Cobros a choferes en el período ({{ count($r['cobros']) }})
</div>
<table>
    <thead>
        <tr>
            <th style="width:70px">Fecha</th>
            <th style="width:70px">Patente</th>
            <th>Chofer</th>
            <th style="width:80px" class="center">Método</th>
            <th style="width:110px" class="numeric">Monto</th>
        </tr>
    </thead>
    <tbody>
        @forelse($r['cobros'] as $c)
            <tr>
                <td>{{ $fecha($c['fecha']) }}</td>
                <td><strong>{{ $c['patente'] ?? '—' }}</strong></td>
                <td>{{ $c['conductor'] ?? 'Sin chofer' }}</td>
                <td class="center">{{ $c['es_transferencia'] ? 'Transferencia' : 'Efectivo' }}</td>
                <td class="numeric verde">{{ $plata($c['monto']) }}</td>
            </tr>
        @empty
            <tr><td colspan="5" class="vacio">Sin cobros registrados en el período.</td></tr>
        @endforelse
        @if(count($r['cobros']) > 0)
            <tr class="total-row">
                <td colspan="4">Total cobrado</td>
                <td class="numeric">{{ $plata($t['cobrado']) }}</td>
            </tr>
        @endif
    </tbody>
</table>

</body>
</html>
