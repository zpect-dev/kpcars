<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Mi Cuenta — {{ $user->name }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }

        .header { padding: 24px 32px 16px; border-bottom: 3px solid #F48E00; margin-bottom: 20px; }
        .header h1 { font-size: 20px; font-weight: 700; }
        .header .meta { margin-top: 6px; font-size: 10px; color: #6b7280; line-height: 1.6; }
        .header .meta span { color: #F48E00; font-weight: 600; }

        .body { padding: 0 32px 32px; }

        .section-title {
            background-color: #1f2937; color: #fff;
            padding: 7px 12px; font-size: 11px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 0;
        }

        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { padding: 7px 10px; background: #f3f4f6; border-bottom: 2px solid #e5e7eb;
             font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280;
             letter-spacing: 0.4px; text-align: left; }
        td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #374151; }
        .text-right { text-align: right; }

        .total-row td { font-weight: 700; color: #111827; background: #fef3c7; border-top: 2px solid #e5e7eb; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 9px; font-size: 9px; font-weight: 700; }
        .badge-ok     { background: #d1fae5; color: #065f46; }
        .badge-deuda  { background: #fee2e2; color: #991b1b; }
        .badge-financ { background: #ede9fe; color: #5b21b6; }

        .flota-color  { color: #059669; font-weight: 600; }
        .financ-color { color: #7c3aed; font-weight: 600; }
        .deuda-color  { color: #dc2626; font-weight: 600; }

        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb;
                  font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
    </style>
</head>
<body>

<div class="header">
    <h1>Mi Cuenta — {{ $user->name }}</h1>
    <div class="meta">
        DNI: <span>{{ $user->dni }}</span>
        &nbsp;·&nbsp; Generado: <span>{{ now()->format('d/m/Y H:i') }}</span>
        @if($tasaActual)
            &nbsp;·&nbsp; Tasa actual: <span>{{ number_format($tasaActual, 2, ',', '.') }} ARS/USD</span>
        @endif
    </div>
</div>

<div class="body">

    {{-- Inversiones --}}
    <div class="section-title">Inversiones activas</div>
    <table>
        <thead>
            <tr>
                <th>Inversión</th>
                <th>Estado</th>
                <th class="text-right">Saldo deuda ARS</th>
                @if($tasaActual)<th class="text-right">Saldo deuda USD</th>@endif
            </tr>
        </thead>
        <tbody>
            @foreach($inversiones as $inv)
                <tr>
                    <td>{{ $inv['nombre'] }}</td>
                    <td>
                        @if($inv['deuda'] > 0)
                            <span class="badge badge-deuda">En deuda</span>
                        @elseif($inv['es_financiador'])
                            <span class="badge badge-financ">Financia</span>
                        @else
                            <span class="badge badge-ok">Al día</span>
                        @endif
                    </td>
                    <td class="text-right @if($inv['deuda'] > 0) deuda-color @endif">
                        @if($inv['deuda'] > 0)
                            $ {{ number_format($inv['deuda'], 2, ',', '.') }}
                        @else
                            —
                        @endif
                    </td>
                    @if($tasaActual)
                        <td class="text-right @if($inv['deuda'] > 0) deuda-color @endif">
                            @if($inv['deuda'] > 0)
                                USD {{ number_format($inv['deuda'] / $tasaActual, 2, '.', ',') }}
                            @else
                                —
                            @endif
                        </td>
                    @endif
                </tr>
            @endforeach
        </tbody>
    </table>

    {{-- Historial de cierres --}}
    @php
        $flotaConceptos = ['parte_completa', 'media_parte_deudor', 'cero_deudor'];
        $totalHistFlota  = 0;
        $totalHistFinanc = 0;
    @endphp

    @if($cierres->isNotEmpty())
        <div class="section-title">Historial de cierres</div>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th class="text-right">Flota ARS</th>
                    @if($tasaActual)<th class="text-right">Flota USD</th>@endif
                    <th class="text-right">Financiación ARS</th>
                    @if($tasaActual)<th class="text-right">Financiación USD</th>@endif
                    <th class="text-right">Total ARS</th>
                    @if($tasaActual)<th class="text-right">Total USD</th>@endif
                </tr>
            </thead>
            <tbody>
                @foreach($cierres as $c)
                    @php
                        $tasa   = $c['tasa'] ?? $tasaActual;
                        $flota  = collect($c['detalles'])->filter(fn($d) => in_array($d['concepto'], $flotaConceptos))->sum('monto');
                        $financ = collect($c['detalles'])->filter(fn($d) => $d['concepto'] === 'redistribucion_financiador')->sum('monto');
                        $total  = $flota + $financ;
                        $totalHistFlota  += $flota;
                        $totalHistFinanc += $financ;
                    @endphp
                    <tr>
                        <td>{{ $c['id'] }}</td>
                        <td>{{ \Carbon\Carbon::parse($c['fecha'])->format('d/m/Y') }}</td>
                        <td class="text-right flota-color">$ {{ number_format($flota, 2, ',', '.') }}</td>
                        @if($tasaActual)
                            <td class="text-right flota-color">
                                @if($tasa) USD {{ number_format($flota / $tasa, 2, '.', ',') }} @else — @endif
                            </td>
                        @endif
                        <td class="text-right financ-color">
                            @if($financ > 0) $ {{ number_format($financ, 2, ',', '.') }} @else — @endif
                        </td>
                        @if($tasaActual)
                            <td class="text-right financ-color">
                                @if($financ > 0 && $tasa) USD {{ number_format($financ / $tasa, 2, '.', ',') }} @else — @endif
                            </td>
                        @endif
                        <td class="text-right"><strong>$ {{ number_format($total, 2, ',', '.') }}</strong></td>
                        @if($tasaActual)
                            <td class="text-right">
                                @if($tasa)<strong>USD {{ number_format($total / $tasa, 2, '.', ',') }}</strong>@else—@endif
                            </td>
                        @endif
                    </tr>
                @endforeach
            </tbody>
            <tfoot>
                <tr class="total-row">
                    <td colspan="2">Total histórico ({{ $cierres->count() }} cierres)</td>
                    <td class="text-right">$ {{ number_format($totalHistFlota, 2, ',', '.') }}</td>
                    @if($tasaActual)<td>—</td>@endif
                    <td class="text-right">$ {{ number_format($totalHistFinanc, 2, ',', '.') }}</td>
                    @if($tasaActual)<td>—</td>@endif
                    <td class="text-right">$ {{ number_format($totalHistFlota + $totalHistFinanc, 2, ',', '.') }}</td>
                    @if($tasaActual)<td>—</td>@endif
                </tr>
            </tfoot>
        </table>
    @endif

    <div class="footer">
        <span>KP Cars — Sistema de Inversiones</span>
        <span>Reporte generado el {{ now()->format('d/m/Y H:i') }}</span>
    </div>
</div>
</body>
</html>
