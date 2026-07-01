<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Multas — {{ $titulo }}</title>
    @include('pdf._styles')
    <style>
        .badge-pr { display:inline-block; width:8px; height:8px; border-radius:50%; background:#dc2626; }
        .verde { color: #16a34a; font-weight:700; }
        .rojo { color: #dc2626; font-weight:700; }
        .summary-grid { width:100%; margin-top:16px; border-collapse:collapse; }
        .summary-grid td { border:1px solid #000; padding:6px 10px; width:33.33%; }
        .summary-label { font-size:9px; color:#6b7280; text-transform:uppercase; letter-spacing:0.4px; }
        .summary-value { font-size:14px; font-weight:700; margin-top:2px; }
    </style>
</head>
<body>

<div class="section-title">
    Reporte de Multas — {{ $titulo }}
    &nbsp;&nbsp;·&nbsp;&nbsp; Generado el {{ now()->format('d/m/Y H:i') }}
</div>

{{-- Resumen global --}}
<table class="summary-grid">
    <tr>
        <td>
            <div class="summary-label">Total</div>
            <div class="summary-value">${{ number_format($totalMonto, 2, ',', '.') }}</div>
        </td>
        <td>
            <div class="summary-label">Pagado por choferes</div>
            <div class="summary-value verde">${{ number_format($pagadoChoferes, 2, ',', '.') }}</div>
        </td>
        <td>
            <div class="summary-label">Total adeudado</div>
            <div class="summary-value rojo">${{ number_format($sinCobrar, 2, ',', '.') }}</div>
        </td>
    </tr>
</table>

@php
    /** Macro reutilizable para renderizar una tabla de multas */
    function tablaMultas($ms, $tipo) {
        $colExtra = $tipo === 'vehiculo' ? 'Conductor' : 'Patente';
        $filas = '';
        foreach ($ms as $m) {
            $monto = $m['punto_rojo'] ? '—' : '$' . number_format($m['monto_efectivo'], 2, ',', '.');
            $vto   = $m['fecha_vencimiento'] ?? '—';
            $extra = $tipo === 'vehiculo' ? ($m['conductor'] ?? 'Sin chofer') : '<strong>' . $m['patente'] . '</strong>';
            $pr    = $m['punto_rojo'] ? '<span class="badge-pr"></span> ' : '';
            $juris = $m['jurisdiccion'] ?? '';
            $pag   = $m['cobrado'] ? '<span class="verde">✓</span>' : '<span class="rojo">✗</span>';
            $filas .= "<tr>
                <td>{$m['fecha']}</td>
                <td>{$vto}</td>
                <td class='center'>{$pr}{$juris}</td>
                <td>{$extra}</td>
                <td>{$m['descripcion']}</td>
                <td class='numeric'>{$monto}</td>
                <td class='center'>{$pag}</td>
            </tr>";
        }
        if (!$filas) $filas = "<tr><td colspan='7' style='text-align:center;color:#6b7280'>Sin multas.</td></tr>";
        return "
        <table style='margin-top:10px'>
            <thead><tr>
                <th style='width:70px'>Fecha inf.</th>
                <th style='width:70px'>Vencimiento</th>
                <th style='width:44px' class='center'>Jurisd.</th>
                <th style='width:110px'>{$colExtra}</th>
                <th>Descripción</th>
                <th style='width:90px' class='numeric'>Monto</th>
                <th style='width:64px' class='center'>Pagada</th>
            </tr></thead>
            <tbody>{$filas}</tbody>
        </table>";
    }
@endphp

@if($esGlobal)
    {{-- Export global: una sección por grupo --}}
    @foreach($grupos as $g)
        <div class="section-title" style="margin-top:20px; display:flex; justify-content:space-between;">
            <span>{{ $g['label'] }}</span>
            <span style="font-size:9px; font-weight:400; margin-left:12px;">
                {{ $g['multas']->count() }} multa{{ $g['multas']->count() !== 1 ? 's' : '' }}
                &nbsp;·&nbsp; Total ${{ number_format($g['total'], 2, ',', '.') }}
                &nbsp;·&nbsp; Adeuda ${{ number_format($g['adeudado'], 2, ',', '.') }}
            </span>
        </div>
        {!! tablaMultas($g['multas'], $tipo) !!}
    @endforeach
@else
    {{-- Export individual: tabla plana --}}
    {!! tablaMultas($multas, $tipo) !!}

    {{-- Desglose secundario (solo si hay múltiples grupos con más de 1 multa cada uno) --}}
    @php
        if ($tipo === 'vehiculo') {
            $desglose = $multas->groupBy('conductor')->map(fn($ms) => [
                'label'    => $ms->first()['conductor'] ?? 'Sin chofer',
                'cantidad' => $ms->count(),
                'total'    => $ms->where('punto_rojo', false)->sum('monto_efectivo'),
                'pagado'   => $ms->where('punto_rojo', false)->sum('monto_cobrado'),
                'adeudado' => $ms->where('punto_rojo', false)->sum('adeudado'),
            ])->values();
            $desgloseHeader = 'Conductor';
            $desgloseTitulo = 'Desglose por conductor';
        } else {
            $desglose = $multas->groupBy('patente')->map(fn($ms) => [
                'label'    => $ms->first()['patente'],
                'cantidad' => $ms->count(),
                'total'    => $ms->where('punto_rojo', false)->sum('monto_efectivo'),
                'pagado'   => $ms->where('punto_rojo', false)->sum('monto_cobrado'),
                'adeudado' => $ms->where('punto_rojo', false)->sum('adeudado'),
            ])->values();
            $desgloseHeader = 'Vehículo';
            $desgloseTitulo = 'Desglose por vehículo';
        }
    @endphp
    @if($desglose->count() > 1 && $multas->count() > $desglose->count())
        <div class="section-title" style="margin-top:20px">{{ $desgloseTitulo }}</div>
        <table>
            <thead>
                <tr>
                    <th>{{ $desgloseHeader }}</th>
                    <th style="width:60px" class="center">Multas</th>
                    <th style="width:110px" class="numeric">Total</th>
                    <th style="width:110px" class="numeric">Pagado</th>
                    <th style="width:110px" class="numeric">Adeudado</th>
                </tr>
            </thead>
            <tbody>
                @foreach($desglose as $fila)
                    <tr>
                        <td>{{ $fila['label'] }}</td>
                        <td class="center">{{ $fila['cantidad'] }}</td>
                        <td class="numeric">${{ number_format($fila['total'], 2, ',', '.') }}</td>
                        <td class="numeric verde">${{ number_format($fila['pagado'], 2, ',', '.') }}</td>
                        <td class="numeric rojo">${{ number_format($fila['adeudado'], 2, ',', '.') }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
@endif

</body>
</html>
