<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cierre de Inversión #{{ $cierre->id }}</title>
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
        .text-center { text-align: center; }

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
        .badge-deuda    { color: #d97706; }
        .badge-cero     { color: #9ca3af; }
    </style>
</head>
<body>

<div class="header">
    <h1>Cierre de Inversión #{{ $cierre->id }}</h1>
    <div class="meta">
        Fecha: <span>{{ $cierre->periodo_fin->format('d/m/Y') }}</span>
        @if($cierre->periodo_inicio)
            &nbsp;·&nbsp; Desde: <span>{{ $cierre->periodo_inicio->format('d/m/Y') }}</span>
        @endif
        &nbsp;·&nbsp; Ejecutado por: <span>{{ $cierre->ejecutadoPor?->name ?? '—' }}</span>
        @if($cierre->tasa)
            &nbsp;·&nbsp; Tasa: <span>{{ number_format($cierre->tasa, 2, ',', '.') }} ARS/USD</span>
        @endif
        &nbsp;·&nbsp; Generado: <span>{{ now()->format('d/m/Y H:i') }}</span>
    </div>
</div>

<div class="body">

    {{-- KPIs --}}
    <div class="kpi-grid">
        <div class="kpi-cell">
            <div class="kpi-label">Recaudado ARS</div>
            <div class="kpi-value">$ {{ number_format($cierre->total_recaudado, 2, ',', '.') }}</div>
        </div>
        @if($cierre->tasa)
        <div class="kpi-cell">
            <div class="kpi-label">Recaudado USD</div>
            <div class="kpi-value">USD {{ number_format($cierre->total_recaudado / $cierre->tasa, 2, '.', ',') }}</div>
        </div>
        @endif
        <div class="kpi-cell">
            <div class="kpi-label">Distribuido ARS</div>
            <div class="kpi-value">$ {{ number_format($cierre->total_distribuido, 2, ',', '.') }}</div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-label">Inversores</div>
            <div class="kpi-value">{{ $porInversor->count() }}</div>
            <div class="kpi-sub">con cobro en este cierre</div>
        </div>
    </div>

    {{-- Recaudaciones --}}
    <div class="section-title">Recaudado por inversión</div>
    <table>
        <thead>
            <tr>
                <th>Inversión</th>
                <th class="text-right">Monto ARS</th>
                @if($cierre->tasa)<th class="text-right">Monto USD</th>@endif
            </tr>
        </thead>
        <tbody>
            @php $totalRec = 0; @endphp
            @foreach($recaudaciones as $r)
                @php $totalRec += $r->monto; @endphp
                <tr>
                    <td>{{ $r->inversion?->nombre ?? '—' }}</td>
                    <td class="text-right">$ {{ number_format($r->monto, 2, ',', '.') }}</td>
                    @if($cierre->tasa)
                        <td class="text-right">USD {{ number_format($r->monto / $cierre->tasa, 2, '.', ',') }}</td>
                    @endif
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td>Total recaudado</td>
                <td class="text-right">$ {{ number_format($totalRec, 2, ',', '.') }}</td>
                @if($cierre->tasa)
                    <td class="text-right">USD {{ number_format($totalRec / $cierre->tasa, 2, '.', ',') }}</td>
                @endif
            </tr>
        </tfoot>
    </table>

    {{-- Sueldo por inversor --}}
    @php
        $flotaConceptos = ['parte_completa', 'media_parte_deudor', 'cero_deudor'];
    @endphp
    <div class="section-title">Sueldo por inversor</div>
    <table>
        <thead>
            <tr>
                <th>Inversor</th>
                <th class="text-right">Flota ARS</th>
                @if($cierre->tasa)<th class="text-right">Flota USD</th>@endif
                <th class="text-right">Financiación ARS</th>
                @if($cierre->tasa)<th class="text-right">Financiación USD</th>@endif
                <th class="text-right">Total ARS</th>
                @if($cierre->tasa)<th class="text-right">Total USD</th>@endif
            </tr>
        </thead>
        <tbody>
            @php $totalFlota = 0; $totalFinanc = 0; @endphp
            @foreach($porInversor as $row)
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
                    @if($cierre->tasa)
                        <td class="text-right badge-flota">USD {{ number_format($flota / $cierre->tasa, 2, '.', ',') }}</td>
                    @endif
                    <td class="text-right badge-financ">
                        @if($financ > 0)$ {{ number_format($financ, 2, ',', '.') }}@else—@endif
                    </td>
                    @if($cierre->tasa)
                        <td class="text-right badge-financ">
                            @if($financ > 0)USD {{ number_format($financ / $cierre->tasa, 2, '.', ',') }}@else—@endif
                        </td>
                    @endif
                    <td class="text-right"><strong>$ {{ number_format($total, 2, ',', '.') }}</strong></td>
                    @if($cierre->tasa)
                        <td class="text-right"><strong>USD {{ number_format($total / $cierre->tasa, 2, '.', ',') }}</strong></td>
                    @endif
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td>Total distribuido</td>
                <td class="text-right">$ {{ number_format($totalFlota, 2, ',', '.') }}</td>
                @if($cierre->tasa)<td class="text-right">USD {{ number_format($totalFlota / $cierre->tasa, 2, '.', ',') }}</td>@endif
                <td class="text-right">$ {{ number_format($totalFinanc, 2, ',', '.') }}</td>
                @if($cierre->tasa)<td class="text-right">USD {{ number_format($totalFinanc / $cierre->tasa, 2, '.', ',') }}</td>@endif
                <td class="text-right">$ {{ number_format($totalFlota + $totalFinanc, 2, ',', '.') }}</td>
                @if($cierre->tasa)<td class="text-right">USD {{ number_format(($totalFlota + $totalFinanc) / $cierre->tasa, 2, '.', ',') }}</td>@endif
            </tr>
        </tfoot>
    </table>

    <div class="footer">
        <span>KP Cars — Sistema de Inversiones</span>
        <span>Reporte generado el {{ now()->format('d/m/Y H:i') }}</span>
    </div>
</div>
</body>
</html>
