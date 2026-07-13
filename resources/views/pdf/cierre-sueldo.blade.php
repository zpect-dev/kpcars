<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cierre de Sueldos #{{ $cierre->id }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }

        .header { padding: 24px 32px 16px; border-bottom: 3px solid #F48E00; margin-bottom: 20px; }
        .header h1 { font-size: 20px; font-weight: 700; color: #1a1a1a; }
        .header .meta { margin-top: 6px; font-size: 10px; color: #6b7280; line-height: 1.6; }
        .header .meta span { color: #F48E00; font-weight: 600; }

        .body { padding: 0 32px 32px; }

        .section-title {
            background-color: #1f2937;
            color: #fff;
            padding: 7px 12px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            margin-bottom: 0;
        }

        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { padding: 7px 10px; background: #f3f4f6; border-bottom: 2px solid #e5e7eb;
             font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280;
             letter-spacing: 0.4px; text-align: left; }
        td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #374151; }
        .text-right { text-align: right; }

        .total-row td { font-weight: 700; color: #111827; background: #fef3c7; border-top: 2px solid #e5e7eb; }

        .kpi-grid { display: table; width: 100%; margin-bottom: 20px; }
        .kpi-cell { display: table-cell; width: 25%; padding: 12px; border: 1px solid #e5e7eb;
                    border-right: none; vertical-align: top; }
        .kpi-cell:last-child { border-right: 1px solid #e5e7eb; }
        .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase;
                     color: #9ca3af; letter-spacing: 0.5px; }
        .kpi-value { font-size: 16px; font-weight: 700; color: #111827; margin-top: 4px; }
        .kpi-sub { font-size: 9px; color: #9ca3af; margin-top: 2px; }

        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb;
                  font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }

        .badge-flota    { color: #059669; font-weight: 600; }
        .badge-financ   { color: #7c3aed; font-weight: 600; }
    </style>
</head>
<body>

@php
    $tasa = (float) $cierre->tasa;
    $flotaConceptos = ['parte_completa', 'media_parte_deudor', 'cero_deudor'];
    $totalRecaudado = $empresas->sum('recaudado');
    $totalDistribuido = $empresas->sum('distribuido');
    $totalAbonado = $abonos->sum(fn ($a) => (float) $a->monto);
@endphp

<div class="header">
    <h1>Cierre de Sueldos #{{ $cierre->id }}</h1>
    <div class="meta">
        Fecha: <span>{{ $cierre->created_at->format('d/m/Y H:i') }}</span>
        &nbsp;·&nbsp; Ejecutado por: <span>{{ $cierre->ejecutadoPor?->name ?? '—' }}</span>
        &nbsp;·&nbsp; Tasa: <span>{{ number_format($tasa, 2, ',', '.') }} ARS/USD</span>
        &nbsp;·&nbsp; Generado: <span>{{ now()->format('d/m/Y H:i') }}</span>
    </div>
</div>

<div class="body">

    {{-- KPIs consolidados --}}
    <div class="kpi-grid">
        <div class="kpi-cell">
            <div class="kpi-label">Recaudado ARS</div>
            <div class="kpi-value">$ {{ number_format($totalRecaudado, 2, ',', '.') }}</div>
            <div class="kpi-sub">ambas empresas</div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-label">Recaudado USD</div>
            <div class="kpi-value">USD {{ $tasa > 0 ? number_format($totalRecaudado / $tasa, 2, '.', ',') : '—' }}</div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-label">Distribuido ARS</div>
            <div class="kpi-value">$ {{ number_format($totalDistribuido, 2, ',', '.') }}</div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-label">Abonos de deuda</div>
            <div class="kpi-value">$ {{ number_format($totalAbonado, 2, ',', '.') }}</div>
            <div class="kpi-sub">descontados en este cierre</div>
        </div>
    </div>

    {{-- Desglose por empresa --}}
    @foreach($empresas as $empresa)
        <div class="section-title">{{ $empresa['nombre'] }} — Recaudado por inversión</div>
        <table>
            <thead>
                <tr>
                    <th>Inversión</th>
                    <th class="text-right">Monto ARS</th>
                    <th class="text-right">Monto USD</th>
                </tr>
            </thead>
            <tbody>
                @forelse($empresa['recaudaciones'] as $r)
                    <tr>
                        <td>{{ $r->nombre }}</td>
                        <td class="text-right">$ {{ number_format($r->total, 2, ',', '.') }}</td>
                        <td class="text-right">USD {{ $tasa > 0 ? number_format($r->total / $tasa, 2, '.', ',') : '—' }}</td>
                    </tr>
                @empty
                    <tr><td colspan="3">Sin recaudaciones en el período.</td></tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr class="total-row">
                    <td>Total {{ $empresa['nombre'] }}</td>
                    <td class="text-right">$ {{ number_format($empresa['recaudado'], 2, ',', '.') }}</td>
                    <td class="text-right">USD {{ $tasa > 0 ? number_format($empresa['recaudado'] / $tasa, 2, '.', ',') : '—' }}</td>
                </tr>
            </tfoot>
        </table>

        <div class="section-title">{{ $empresa['nombre'] }} — Sueldo por socio</div>
        <table>
            <thead>
                <tr>
                    <th>Socio</th>
                    <th class="text-right">Flota ARS</th>
                    <th class="text-right">Flota USD</th>
                    <th class="text-right">Financiación ARS</th>
                    <th class="text-right">Financiación USD</th>
                    <th class="text-right">Total ARS</th>
                    <th class="text-right">Total USD</th>
                </tr>
            </thead>
            <tbody>
                @php $totalFlota = 0; $totalFinanc = 0; @endphp
                @forelse($empresa['porInversor'] as $row)
                    @php
                        $flota  = $row['pagos']->filter(fn($p) => in_array($p->concepto, $flotaConceptos))->sum('monto');
                        $financ = $row['pagos']->filter(fn($p) => $p->concepto === 'redistribucion_financiador')->sum('monto');
                        $total  = $flota + $financ;
                        $totalFlota  += $flota;
                        $totalFinanc += $financ;
                    @endphp
                    <tr>
                        <td>{{ $row['user']->name }}</td>
                        <td class="text-right badge-flota">$ {{ number_format($flota, 2, ',', '.') }}</td>
                        <td class="text-right badge-flota">USD {{ $tasa > 0 ? number_format($flota / $tasa, 2, '.', ',') : '—' }}</td>
                        <td class="text-right badge-financ">
                            @if($financ > 0)$ {{ number_format($financ, 2, ',', '.') }}@else—@endif
                        </td>
                        <td class="text-right badge-financ">
                            @if($financ > 0 && $tasa > 0)USD {{ number_format($financ / $tasa, 2, '.', ',') }}@else—@endif
                        </td>
                        <td class="text-right"><strong>$ {{ number_format($total, 2, ',', '.') }}</strong></td>
                        <td class="text-right"><strong>USD {{ $tasa > 0 ? number_format($total / $tasa, 2, '.', ',') : '—' }}</strong></td>
                    </tr>
                @empty
                    <tr><td colspan="7">Sin pagos en esta empresa.</td></tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr class="total-row">
                    <td>Total distribuido</td>
                    <td class="text-right">$ {{ number_format($totalFlota, 2, ',', '.') }}</td>
                    <td class="text-right">USD {{ $tasa > 0 ? number_format($totalFlota / $tasa, 2, '.', ',') : '—' }}</td>
                    <td class="text-right">$ {{ number_format($totalFinanc, 2, ',', '.') }}</td>
                    <td class="text-right">USD {{ $tasa > 0 ? number_format($totalFinanc / $tasa, 2, '.', ',') : '—' }}</td>
                    <td class="text-right">$ {{ number_format($totalFlota + $totalFinanc, 2, ',', '.') }}</td>
                    <td class="text-right">USD {{ $tasa > 0 ? number_format(($totalFlota + $totalFinanc) / $tasa, 2, '.', ',') : '—' }}</td>
                </tr>
            </tfoot>
        </table>
    @endforeach

    {{-- Abonos de deuda --}}
    <div class="section-title">Abonos de deuda registrados en este cierre</div>
    <table>
        <thead>
            <tr>
                <th>Socio</th>
                <th>Inversión</th>
                <th class="text-right">Monto ARS</th>
            </tr>
        </thead>
        <tbody>
            @forelse($abonos as $a)
                <tr>
                    <td>{{ $a->user?->name ?? '—' }}</td>
                    <td>{{ $a->inversion?->nombre ?? '—' }}</td>
                    <td class="text-right">$ {{ number_format($a->monto, 2, ',', '.') }}</td>
                </tr>
            @empty
                <tr><td colspan="3">Ningún socio abonó deuda en este cierre.</td></tr>
            @endforelse
        </tbody>
        @if($abonos->isNotEmpty())
            <tfoot>
                <tr class="total-row">
                    <td colspan="2">Total abonado</td>
                    <td class="text-right">$ {{ number_format($totalAbonado, 2, ',', '.') }}</td>
                </tr>
            </tfoot>
        @endif
    </table>

    <div class="footer">
        <span>KP Cars — Sistema de Inversiones</span>
        <span>Reporte generado el {{ now()->format('d/m/Y H:i') }}</span>
    </div>
</div>
</body>
</html>
