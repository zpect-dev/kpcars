<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cobros Pendientes</title>
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
            margin-top: 4px;
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

        .inversion-section {
            margin-bottom: 24px;
            page-break-inside: avoid;
        }

        .inversion-title {
            background-color: #f3f4f6;
            border-left: 4px solid #F48E00;
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 700;
            color: #111827;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }

        th, td {
            padding: 8px 12px;
            border-bottom: 1px solid #e5e7eb;
        }

        th {
            text-align: left;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            color: #6b7280;
            letter-spacing: 0.5px;
            background-color: #ffffff;
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
            padding: 10px 12px;
            text-align: right;
            font-size: 12px;
            font-weight: 700;
            color: #111827;
            background-color: #ffffff;
            border-bottom: 2px solid #e5e7eb;
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
        <h1>Cobros Pendientes</h1>
        <div class="meta">
            Generado el <span>{{ now()->format('d/m/Y H:i') }}</span>
        </div>
    </div>

    <div class="body">
        @if($inversiones->isEmpty())
            <p>No hay cobros pendientes para mostrar.</p>
        @else
            @foreach($inversiones as $nombre => $cobros)
                @php
                    $nombreFormateado = preg_replace('/^INV_(\d+)$/i', 'Inversión $1', $nombre);
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
                            @php $total = 0; @endphp
                            @foreach($cobros as $cobro)
                                @php $total += $cobro->subtotal; @endphp
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
                        Total {{ strtolower($nombreFormateado) }}: ${{ number_format($total, 0, ',', '.') }}
                    </div>
                </div>
            @endforeach
        @endif

        <div class="footer">
            <span>KP Cars — Sistema de Inventario</span>
            <span>Reporte generado el {{ now()->format('d/m/Y') }}</span>
        </div>
    </div>
</body>
</html>
