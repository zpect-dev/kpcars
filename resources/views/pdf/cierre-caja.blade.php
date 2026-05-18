<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cierre de Caja #{{ $cierre->id }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            color: #1a1a1a;
            background: #fff;
        }

        .header {
            padding: 24px 32px 16px;
            border-bottom: 3px solid #F48E00;
            margin-bottom: 20px;
        }

        .header h1 {
            font-size: 20px;
            font-weight: 700;
            color: #1a1a1a;
            letter-spacing: -0.3px;
        }

        .header .meta {
            margin-top: 6px;
            font-size: 10px;
            color: #6b7280;
        }

        .header .meta span {
            color: #F48E00;
            font-weight: 600;
        }

        .body {
            padding: 0 32px 32px;
        }

        .empresa-section {
            margin-bottom: 28px;
        }

        .empresa-title {
            background-color: #1f2937;
            color: #fff;
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.3px;
            text-transform: uppercase;
        }

        .inversion-section {
            margin-top: 12px;
            page-break-inside: avoid;
        }

        .inversion-title {
            background-color: #f3f4f6;
            border-left: 4px solid #F48E00;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 700;
            color: #111827;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }

        th, td {
            padding: 7px 12px;
            border-bottom: 1px solid #e5e7eb;
        }

        th {
            text-align: left;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            color: #6b7280;
            letter-spacing: 0.5px;
        }

        td {
            font-size: 11px;
            color: #374151;
        }

        .col-articulo { width: 45%; }
        .col-cant { width: 10%; text-align: center; }
        .col-patente { width: 20%; text-align: center; }
        .col-monto { width: 25%; text-align: right; }

        .inversion-total {
            padding: 8px 12px;
            text-align: right;
            font-size: 11px;
            font-weight: 700;
            color: #111827;
            border-bottom: 2px solid #e5e7eb;
        }

        .empresa-total {
            margin-top: 6px;
            padding: 8px 12px;
            text-align: right;
            font-size: 12px;
            font-weight: 700;
            color: #111827;
            background-color: #fef3c7;
        }

        .grand-total {
            margin-top: 24px;
            padding: 12px 16px;
            background-color: #F48E00;
            color: #fff;
            font-size: 14px;
            font-weight: 700;
            display: flex;
            justify-content: space-between;
        }

        .footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
            font-size: 9px;
            color: #9ca3af;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Cierre de Caja #{{ $cierre->id }}</h1>
        <div class="meta">
            Fecha del cierre: <span>{{ $cierre->created_at->format('d/m/Y H:i') }}</span><br>
            Ejecutado por: <span>{{ $cierre->user?->name ?? 'N/A' }}</span><br>
            Generado el: <span>{{ now()->format('d/m/Y H:i') }}</span>
        </div>
    </div>

    <div class="body">
        @php $grandTotal = 0; @endphp

        @if($empresas->isEmpty())
            <p>No hay detalles para este cierre.</p>
        @else
            @foreach($empresas as $empresaNombre => $inversiones)
                @php $empresaTotal = 0; @endphp
                <div class="empresa-section">
                    <div class="empresa-title">{{ $empresaNombre }}</div>

                    @foreach($inversiones as $inversionNombre => $cobros)
                        @php
                            $nombreFormateado = preg_replace('/^INV_(\d+)$/i', 'Inversión $1', $inversionNombre);
                            $inversionTotal = 0;
                        @endphp
                        <div class="inversion-section">
                            <div class="inversion-title">{{ $nombreFormateado }}</div>

                            <table>
                                <thead>
                                    <tr>
                                        <th class="col-articulo">Artículo</th>
                                        <th class="col-cant">Cant.</th>
                                        <th class="col-patente">Patente</th>
                                        <th class="col-monto">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($cobros as $cobro)
                                        @php
                                            $inversionTotal += $cobro->subtotal;
                                            $empresaTotal += $cobro->subtotal;
                                            $grandTotal += $cobro->subtotal;
                                        @endphp
                                        <tr>
                                            <td class="col-articulo">{{ $cobro->articulo_descripcion }}</td>
                                            <td class="col-cant">{{ $cobro->cantidad }}</td>
                                            <td class="col-patente">{{ $cobro->patente ?: 'N/A' }}</td>
                                            <td class="col-monto">${{ number_format($cobro->subtotal, 0, ',', '.') }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>

                            <div class="inversion-total">
                                Total {{ strtolower($nombreFormateado) }}: ${{ number_format($inversionTotal, 0, ',', '.') }}
                            </div>
                        </div>
                    @endforeach

                    <div class="empresa-total">
                        Total {{ $empresaNombre }}: ${{ number_format($empresaTotal, 0, ',', '.') }}
                    </div>
                </div>
            @endforeach

            <div class="grand-total">
                <span>Total del cierre</span>
                <span>${{ number_format($grandTotal, 0, ',', '.') }}</span>
            </div>
        @endif

        <div class="footer">
            <span>KP Cars — Sistema de Inventario</span>
            <span>Reporte generado el {{ now()->format('d/m/Y') }}</span>
        </div>
    </div>
</body>
</html>
