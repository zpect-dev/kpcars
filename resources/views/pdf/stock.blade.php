<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stock de Artículos</title>
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

        table {
            width: 100%;
            border-collapse: collapse;
        }

        thead tr {
            background-color: #F48E00;
        }

        thead th {
            padding: 9px 12px;
            text-align: left;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #ffffff;
        }

        tbody tr:nth-child(even) {
            background-color: #fafafa;
        }

        tbody tr.low-stock {
            background-color: #fee2e2;
        }

        tbody td {
            padding: 8px 12px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
        }

        .td-descripcion {
            font-weight: 500;
            color: #111827;
        }

        .td-descripcion.low {
            color: #991b1b;
            font-weight: 600;
        }

        .stock-value {
            font-weight: 600;
            color: #111827;
        }

        .stock-value.low {
            color: #dc2626;
        }

        .badge-low {
            display: inline-block;
            background: #dc2626;
            color: #fff;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
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

        .summary {
            margin-bottom: 16px;
            display: flex;
            gap: 24px;
        }

        .summary-card {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px 16px;
        }

        .summary-card .label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
            font-weight: 600;
        }

        .summary-card .value {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            margin-top: 2px;
        }

        .summary-card .value.alert {
            color: #dc2626;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Stock de Artículos</h1>
        <div class="meta">
            Generado el <span>{{ now()->format('d/m/Y H:i') }}</span>
        </div>
    </div>

    <div class="body">
        <table>
            <thead>
                <tr>
                    <th style="width:80%">Descripción</th>
                    <th style="width:20%; text-align:center">Stock Actual</th>
                </tr>
            </thead>
            <tbody>
                @foreach($articulos as $articulo)
                    <tr>
                        <td class="td-descripcion">
                            {{ $articulo->descripcion }}
                        </td>
                        <td style="text-align:center">
                            <span class="stock-value">
                                {{ $articulo->stock }}
                            </span>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <div class="footer">
            <span>KP Cars — Sistema de Inventario</span>
            <span>Stock al {{ now()->format('d/m/Y') }}</span>
        </div>
    </div>
</body>
</html>
