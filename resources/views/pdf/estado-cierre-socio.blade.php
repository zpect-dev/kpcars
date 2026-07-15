<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Estado del cierre #{{ $estado['cierre']['id'] }}</title>
    @include('pdf._styles')
</head>
<body>
    @php
        $conceptoLabels = [
            'parte_completa' => 'Parte completa',
            'media_parte_deudor' => 'Media parte (deudor)',
            'cero_deudor' => 'Cero (deudor)',
            'redistribucion_financiador' => 'Redistribución (financiador)',
        ];
        $fmt = fn ($n) => '$'.number_format((float) $n, 0, ',', '.');
        $fecha = $estado['cierre']['fecha']
            ? \Illuminate\Support\Carbon::parse($estado['cierre']['fecha'])->format('d/m/Y H:i')
            : '—';
        $tasa = (float) $estado['cierre']['tasa'];
    @endphp

    <div class="section-title">
        Estado del cierre #{{ $estado['cierre']['id'] }} — {{ $estado['socio']['name'] }}
    </div>
    <p style="font-size:11px;color:#555;margin:0 0 8px">
        {{ $fecha }} · Tasa {{ $fmt($tasa) }} / USD
    </p>

    {{-- Resumen arriba --}}
    <table>
        <tbody>
            <tr class="total-row">
                <td style="width:60%">Recaudado (mis inversiones)</td>
                <td class="numeric" style="width:40%">{{ $fmt($estado['totales']['recaudado']) }}</td>
            </tr>
            <tr class="total-row">
                <td>Gastos (mi parte)</td>
                <td class="numeric">{{ $fmt($estado['totales']['gastos']) }}</td>
            </tr>
            <tr class="total-row">
                <td>Mi sueldo del cierre</td>
                <td class="numeric">{{ $fmt($estado['totales']['sueldo']) }}
                    @if($tasa > 0) (USD {{ number_format($estado['totales']['sueldo'] / $tasa, 0, ',', '.') }}) @endif
                </td>
            </tr>
        </tbody>
    </table>

    @foreach($estado['empresas'] as $e)
        <div class="section-title">{{ $e['empresa_nombre'] }}</div>

        {{-- Recaudación --}}
        <table>
            <thead>
                <tr>
                    <th style="width:70%">Recaudación por inversión</th>
                    <th class="numeric" style="width:30%">Monto</th>
                </tr>
            </thead>
            <tbody>
                @foreach($e['inversiones'] as $inv)
                    <tr>
                        <td>{{ preg_replace('/^INV_(\d+)$/i', 'Inversión $1', $inv['inversion_nombre']) }}{{ $inv['es_financiador'] ? ' (financiador)' : '' }}</td>
                        <td class="numeric">{{ $fmt($inv['recaudado']) }}</td>
                    </tr>
                @endforeach
                <tr class="total-row">
                    <td>Total mis inversiones</td>
                    <td class="numeric">{{ $fmt($e['mi_recaudacion']) }}</td>
                </tr>
                <tr>
                    <td>Total recaudado por la empresa (represento el {{ number_format($e['mi_fraccion'] * 100, 1, ',', '.') }}%)</td>
                    <td class="numeric">{{ $fmt($e['recaudacion_empresa']) }}</td>
                </tr>
            </tbody>
        </table>

        {{-- Gastos --}}
        <table>
            <thead>
                <tr>
                    <th style="width:70%">Gastos — {{ $fmt($e['gastos']['total']) }}</th>
                    <th class="numeric" style="width:30%">Monto</th>
                </tr>
            </thead>
            <tbody>
                @forelse($e['gastos']['flota'] as $f)
                    <tr>
                        <td>Flota · {{ $f['patente'] }}{{ $f['vehiculo'] ? ' — '.$f['vehiculo'] : '' }}</td>
                        <td class="numeric">{{ $fmt($f['monto']) }}</td>
                    </tr>
                @empty
                    <tr><td>Flota · sin gastos</td><td class="numeric">{{ $fmt(0) }}</td></tr>
                @endforelse
                <tr class="total-row">
                    <td>Subtotal flota</td>
                    <td class="numeric">{{ $fmt($e['gastos']['flota_total']) }}</td>
                </tr>
                <tr>
                    <td>Galpón / Taller / Oficina — mi parte ({{ $fmt($e['gastos']['globales_empresa']) }} de la empresa)</td>
                    <td class="numeric">{{ $fmt($e['gastos']['globales_mi_parte']) }}</td>
                </tr>
            </tbody>
        </table>

        {{-- Sueldo --}}
        <table>
            <thead>
                <tr>
                    <th style="width:45%">Mi sueldo</th>
                    <th style="width:30%">Concepto</th>
                    <th class="numeric" style="width:25%">Monto</th>
                </tr>
            </thead>
            <tbody>
                @foreach($e['sueldo']['detalle'] as $d)
                    <tr>
                        <td>{{ preg_replace('/^INV_(\d+)$/i', 'Inversión $1', $d['inversion']) }}</td>
                        <td>{{ $conceptoLabels[$d['concepto']] ?? $d['concepto'] }}</td>
                        <td class="numeric">{{ $fmt($d['monto']) }}</td>
                    </tr>
                @endforeach
                <tr class="total-row">
                    <td colspan="2">Total sueldo {{ $e['empresa_nombre'] }}</td>
                    <td class="numeric">{{ $fmt($e['sueldo']['total']) }}</td>
                </tr>
            </tbody>
        </table>
    @endforeach
</body>
</html>
